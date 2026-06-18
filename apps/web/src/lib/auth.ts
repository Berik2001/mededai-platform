import type {
  AuthResponse,
  LoginInput,
  PublicUser,
  RegisterInput,
} from "@med/shared";
import { api, clearToken, setToken } from "./api";

export async function login(input: LoginInput): Promise<AuthResponse> {
  const res = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: input,
    auth: false,
  });
  setToken(res.accessToken);
  return res;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const res = await api<AuthResponse>("/auth/register", {
    method: "POST",
    body: input,
    auth: false,
  });
  setToken(res.accessToken);
  return res;
}

export async function fetchProfile(): Promise<PublicUser> {
  return api<PublicUser>("/users/me");
}

export function logout(): void {
  clearToken();
}
