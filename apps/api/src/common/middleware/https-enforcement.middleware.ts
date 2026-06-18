import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../../config/configuration";

/**
 * Rejects plain-HTTP traffic when `forceHttps` is enabled.
 *
 * TLS is expected to be terminated at a reverse proxy / load balancer, which
 * sets `x-forwarded-proto`. `trust proxy` (configured in main.ts) makes
 * `req.secure` reflect that header. Safe methods could be redirected, but for
 * an API we fail closed on every non-TLS request.
 */
@Injectable()
export class HttpsEnforcementMiddleware implements NestMiddleware {
  private readonly enabled: boolean;

  constructor(config: ConfigService<AppConfig, true>) {
    this.enabled = config.get("forceHttps", { infer: true });
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    if (!this.enabled) {
      return next();
    }

    const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
    const isSecure = req.secure || proto === "https";

    if (!isSecure) {
      throw new ForbiddenException("HTTPS is required");
    }
    next();
  }
}
