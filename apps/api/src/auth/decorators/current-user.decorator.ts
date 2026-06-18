import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "@med/shared";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: JwtPayload["role"];
}

/** Injects the authenticated user (as set by JwtStrategy.validate) into a handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    return data ? user?.[data] : user;
  },
);
