// Admin Panel — types for user management, system statistics, content
// moderation, the audit-log viewer and backup management.

import type { Role } from "../constants/roles";
import type { CaseStatus } from "../constants/specialties";

// ─── User management ───
export interface AdminUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  institution?: string | null;
  yearOfStudy?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  institution?: string;
  yearOfStudy?: number;
}

export interface AdminUpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: Role;
  institution?: string | null;
  yearOfStudy?: number | null;
  isActive?: boolean;
}

export type AdminUserStatusFilter = "all" | "active" | "blocked";

export interface AdminUserQuery {
  page?: number;
  limit?: number;
  role?: Role;
  search?: string;
  status?: AdminUserStatusFilter;
}

// ─── System statistics ───
export interface StatusBreakdown {
  total: number;
  draft: number;
  published: number;
  archived: number;
}

export interface RoleCount {
  role: Role;
  count: number;
}

export interface SystemStats {
  generatedAt: string;
  users: {
    total: number;
    active: number;
    blocked: number;
    newLast7Days: number;
    byRole: RoleCount[];
  };
  content: {
    cases: StatusBreakdown;
    tests: StatusBreakdown;
    questions: number;
    osceExams: number;
  };
  activity: {
    testSessions: number;
    testSessionsCompleted: number;
    vpSessions: number;
    vpCompleted: number;
    osceSessions: number;
    osceCompleted: number;
    assignments: number;
    submissions: number;
  };
  results: {
    avgTestScore: number | null; // percent
    testsPassed: number;
    testsFailed: number;
  };
}

// ─── Content moderation ───
export type ModerationType = "CASE" | "TEST";

export interface ModerationItem {
  id: string;
  type: ModerationType;
  title: string;
  authorName?: string;
  specialty: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationQuery {
  type?: ModerationType | "ALL";
  status?: CaseStatus;
}

export type ModerationDecision = "APPROVE" | "REJECT" | "UNPUBLISH";

// ─── Audit log viewer ───
export interface AuditLogView {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  createdAt: string;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  userId?: string;
  method?: string;
  search?: string;
  statusCode?: number;
}

// ─── Backup management ───
export interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupSettings {
  enabled: boolean;
  cron: string;
  dir: string;
  retentionDays: number;
}

export interface BackupStatus {
  settings: BackupSettings;
  backups: BackupInfo[];
}
