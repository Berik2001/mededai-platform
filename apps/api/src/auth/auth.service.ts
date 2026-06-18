import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { User as PrismaUser } from "@prisma/client";
import { AuthResponse, JwtPayload, PublicUser, Role } from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AppConfig } from "../config/configuration";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_BYTES = 48;

/** Request metadata captured alongside an issued session, for audit/forensics. */
export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto, meta: SessionMeta = {}): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: (dto.role as Role) ?? Role.STUDENT,
        institution: dto.institution,
      },
    });

    return this.buildAuthResponse(user, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta = {}): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.buildAuthResponse(user, meta);
  }

  /**
   * Rotate a refresh token: validate it, revoke it, and issue a fresh pair.
   * If a token that was already revoked is presented, we treat it as theft and
   * revoke the user's entire active token family.
   */
  async refresh(rawToken: string, meta: SessionMeta = {}): Promise<AuthResponse> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (record.revokedAt) {
      // Reuse of a revoked token → likely stolen. Revoke everything for this user.
      await this.revokeAllForUser(record.userId);
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account is no longer active");
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.buildAuthResponse(user, meta);
  }

  /** Revoke a single refresh token, or every session when `allDevices` is set. */
  async logout(
    userId: string,
    rawToken?: string,
    allDevices = false,
  ): Promise<{ success: true }> {
    if (allDevices) {
      await this.revokeAllForUser(userId);
      return { success: true };
    }

    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash: this.hashToken(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async buildAuthResponse(user: PrismaUser, meta: SessionMeta): Promise<AuthResponse> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id, meta);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get("jwt", { infer: true }).accessExpiresIn,
      user: toPublicUser(user),
    };
  }

  private signAccessToken(user: PrismaUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
    };
    return this.jwt.sign(payload);
  }

  private async issueRefreshToken(userId: string, meta: SessionMeta): Promise<string> {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    const days = this.config.get("jwt", { infer: true }).refreshExpiresInDays;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 255),
      },
    });
    return raw;
  }

  /** Refresh tokens are high-entropy, so a fast SHA-256 digest is sufficient. */
  private hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}

export function toPublicUser(user: PrismaUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as Role,
    institution: user.institution,
    yearOfStudy: user.yearOfStudy,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
