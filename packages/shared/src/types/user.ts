import { Role } from "../constants/roles";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  institution?: string | null;
  /** Year of study for students, null for staff. */
  yearOfStudy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** User shape that is safe to expose to clients (never includes the password hash). */
export type PublicUser = Omit<User, never>;

export interface UpdateUserProfileInput {
  firstName?: string;
  lastName?: string;
  institution?: string | null;
  yearOfStudy?: number | null;
}
