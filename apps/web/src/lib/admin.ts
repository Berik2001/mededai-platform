import type {
  AdminCreateUserInput,
  AdminUpdateUserInput,
  AdminUserQuery,
  AdminUserView,
  AuditLogQuery,
  AuditLogView,
  BackupStatus,
  ModerationDecision,
  ModerationItem,
  ModerationQuery,
  ModerationType,
  PaginatedResult,
  SystemStats,
} from "@med/shared";
import { api } from "./api";

function qs(filters: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== "") p.set(k, String(v));
  return p.toString() ? `?${p}` : "";
}

// ─── Users ───
export const adminListUsers = (q: AdminUserQuery = {}) =>
  api<PaginatedResult<AdminUserView>>(`/admin/users${qs(q as Record<string, unknown>)}`);
export const adminCreateUser = (input: AdminCreateUserInput) =>
  api<AdminUserView>("/admin/users", { method: "POST", body: input });
export const adminUpdateUser = (id: string, input: AdminUpdateUserInput) =>
  api<AdminUserView>(`/admin/users/${id}`, { method: "PATCH", body: input });
export const adminBlockUser = (id: string) =>
  api<AdminUserView>(`/admin/users/${id}/block`, { method: "POST" });
export const adminUnblockUser = (id: string) =>
  api<AdminUserView>(`/admin/users/${id}/unblock`, { method: "POST" });

// ─── Stats ───
export const adminStats = () => api<SystemStats>("/admin/stats");

// ─── Moderation ───
export const adminModerationQueue = (q: ModerationQuery = {}) =>
  api<ModerationItem[]>(`/admin/moderation${qs(q as Record<string, unknown>)}`);
export const adminModerate = (type: ModerationType, id: string, decision: ModerationDecision) =>
  api<ModerationItem>(`/admin/moderation/${type.toLowerCase()}/${id}`, {
    method: "POST",
    body: { decision },
  });

// ─── Audit ───
export const adminAuditLogs = (q: AuditLogQuery = {}) =>
  api<PaginatedResult<AuditLogView>>(`/audit-logs${qs(q as Record<string, unknown>)}`);

// ─── Backups ───
export const adminBackupStatus = () => api<BackupStatus>("/admin/backups");
export const adminRunBackup = () => api<{ ok: true; file: string }>("/admin/backups", { method: "POST" });
export const adminDeleteBackup = (filename: string) =>
  api<{ deleted: boolean }>(`/admin/backups/${encodeURIComponent(filename)}`, { method: "DELETE" });
