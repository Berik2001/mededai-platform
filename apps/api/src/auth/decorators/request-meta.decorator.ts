import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { SessionMeta } from "../auth.service";

/** Extracts client IP and user-agent for session bookkeeping. */
export const ReqMeta = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionMeta => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };
  },
);
