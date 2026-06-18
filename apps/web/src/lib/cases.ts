import type {
  ClinicalCaseFull,
  ClinicalCaseMeta,
  CreateClinicalCaseInput,
  LaunchCaseResult,
  PaginatedResult,
  UpdateClinicalCaseInput,
} from "@med/shared";
import { api } from "./api";

export interface CaseFilters {
  specialty?: string;
  difficulty?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function listCases(filters: CaseFilters = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return api<PaginatedResult<ClinicalCaseMeta>>(`/cases${suffix}`);
}

export function getCase(id: string) {
  return api<ClinicalCaseFull>(`/cases/${id}`);
}

export function createCase(input: CreateClinicalCaseInput) {
  return api<ClinicalCaseFull>("/cases", { method: "POST", body: input });
}

export function updateCase(id: string, input: UpdateClinicalCaseInput) {
  return api<ClinicalCaseFull>(`/cases/${id}`, { method: "PATCH", body: input });
}

export function deleteCase(id: string) {
  return api<{ deleted: boolean }>(`/cases/${id}`, { method: "DELETE" });
}

export function launchCase(id: string) {
  return api<LaunchCaseResult>(`/cases/${id}/launch`, { method: "POST" });
}
