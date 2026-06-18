import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "@med/shared";
import type { AppConfig } from "../config/configuration";
import { AuditService } from "./audit.service";

/** Paths that would only add noise to the audit trail. */
const IGNORED_PATHS = ["/api/health", "/api/docs", "/favicon.ico"];

/**
 * Records every request to the audit log.
 *
 * Middleware runs *before* the auth guards, so `req.user` is not populated yet.
 * We therefore best-effort verify the bearer token ourselves to attribute the
 * action to a user. The row is written on `res.finish` so we can capture the
 * final status code, and writing is fire-and-forget to avoid adding latency.
 */
@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  private readonly accessSecret: string;
  private readonly enabled: boolean;

  constructor(
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.accessSecret = config.get("jwt", { infer: true }).accessSecret;
    this.enabled = config.get("audit", { infer: true }).enabled;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.enabled || this.shouldIgnore(req)) {
      return next();
    }

    const userId = this.extractUserId(req);
    const ip = req.ip;
    const userAgent = req.headers["user-agent"] ?? null;
    const method = req.method;
    const path = req.originalUrl.split("?")[0];

    res.on("finish", () => {
      void this.audit.record({
        userId,
        action: `${method} ${path}`,
        method,
        path,
        statusCode: res.statusCode,
        ip,
        userAgent,
      });
    });

    next();
  }

  private shouldIgnore(req: Request): boolean {
    if (req.method === "OPTIONS") return true;
    const path = req.originalUrl.split("?")[0];
    return IGNORED_PATHS.some((p) => path.startsWith(p));
  }

  private extractUserId(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    try {
      const payload = this.jwt.verify<JwtPayload>(header.slice(7), {
        secret: this.accessSecret,
      });
      return payload.sub ?? null;
    } catch {
      // Expired/invalid token — still log the attempt, just unattributed.
      return null;
    }
  }
}
