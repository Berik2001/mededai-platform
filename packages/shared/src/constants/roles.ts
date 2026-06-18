/**
 * Role-based access control roles shared across the API and web app.
 * Keep in sync with the Prisma `Role` enum in apps/api/prisma/schema.prisma.
 */
export enum Role {
  /** Full system management. */
  ADMIN = "ADMIN",
  /** Create content, assign tasks, review students. */
  TEACHER = "TEACHER",
  /** Access learning modules, take tests and exams. */
  STUDENT = "STUDENT",
  /** Conduct OSCE (objective structured clinical examination) exams. */
  EXAMINER = "EXAMINER",
}

export const ALL_ROLES: Role[] = [Role.ADMIN, Role.TEACHER, Role.STUDENT, Role.EXAMINER];

/** Roles considered "staff" (can manage content / conduct exams). */
export const STAFF_ROLES: Role[] = [Role.ADMIN, Role.TEACHER, Role.EXAMINER];

/**
 * Rough capability hierarchy. A higher number implies broader access.
 * TEACHER and EXAMINER are peers (different responsibilities, similar privilege).
 * Used for convenience checks like `roleRank[user.role] >= roleRank[Role.TEACHER]`.
 */
export const roleRank: Record<Role, number> = {
  [Role.STUDENT]: 0,
  [Role.EXAMINER]: 1,
  [Role.TEACHER]: 1,
  [Role.ADMIN]: 2,
};

export function hasAtLeastRole(userRole: Role, required: Role): boolean {
  return roleRank[userRole] >= roleRank[required];
}
