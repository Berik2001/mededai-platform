import { SetMetadata } from "@nestjs/common";
import { Role } from "@med/shared";

export const ROLES_KEY = "roles";

/** Restricts a route to users holding one of the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
