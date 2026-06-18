import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Prisma, Role as PrismaRole, User as PrismaUser } from "@prisma/client";
import { AdminUserView, PaginatedResult, Role, paginate } from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AdminCreateUserDto, AdminListUsersDto, AdminUpdateUserDto } from "./dto/admin.dto";

const SALT_ROUNDS = 10;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminListUsersDto): Promise<PaginatedResult<AdminUserView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const and: Prisma.UserWhereInput[] = [];
    if (query.role) and.push({ role: query.role as PrismaRole });
    if (query.status === "active") and.push({ isActive: true });
    if (query.status === "blocked") and.push({ isActive: false });
    if (query.search) {
      and.push({
        OR: [
          { email: { contains: query.search, mode: "insensitive" } },
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows.map((u) => this.toView(u)), total, page, limit);
  }

  async getOne(id: string): Promise<AdminUserView> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    return this.toView(user);
  }

  async create(dto: AdminCreateUserDto): Promise<AdminUserView> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("A user with this email already exists");

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role as PrismaRole,
        institution: dto.institution,
        yearOfStudy: dto.yearOfStudy,
      },
    });
    return this.toView(user);
  }

  async update(id: string, dto: AdminUpdateUserDto, requesterId: string): Promise<AdminUserView> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    // Self-protection: an admin cannot lock themselves out or drop their own admin role.
    if (id === requesterId) {
      if (dto.isActive === false) throw new BadRequestException("You cannot block your own account");
      if (dto.role && dto.role !== Role.ADMIN) {
        throw new BadRequestException("You cannot change your own admin role");
      }
    }

    const wasActive = user.isActive;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role as PrismaRole | undefined,
        institution: dto.institution,
        yearOfStudy: dto.yearOfStudy,
        isActive: dto.isActive,
      },
    });

    // Blocking a user kills their active sessions (refresh tokens) immediately.
    if (wasActive && dto.isActive === false) {
      await this.revokeSessions(id);
    }
    return this.toView(updated);
  }

  /** Block / unblock shortcut. */
  async setActive(id: string, active: boolean, requesterId: string): Promise<AdminUserView> {
    if (id === requesterId && !active) {
      throw new ForbiddenException("You cannot block your own account");
    }
    const result = await this.update(id, { isActive: active }, requesterId);
    return result;
  }

  private async revokeSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toView(u: PrismaUser): AdminUserView {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role as Role,
      institution: u.institution,
      yearOfStudy: u.yearOfStudy,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }
}
