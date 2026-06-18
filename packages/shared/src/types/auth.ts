import { Role } from "../constants/roles";
import { PublicUser } from "./user";

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
  institution?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface LogoutInput {
  refreshToken?: string;
  /** When true, revoke every active session for the user. */
  allDevices?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime (e.g. "15m"). */
  expiresIn: string;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}

/** Decoded JWT access-token payload. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}
