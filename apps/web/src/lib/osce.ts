import type {
  CreateOsceExamInput,
  CreateOsceSessionInput,
  OsceCheckInput,
  OsceDebrief,
  OsceExamDetail,
  OsceExamMeta,
  OsceExamPublic,
  OsceLiveView,
  OsceSelfView,
  OsceSessionSummary,
  OsceSessionView,
  UpdateOsceExamInput,
} from "@med/shared";
import { api } from "./api";

// ─── Exams (blueprints) ───
export const listOsceExams = (query: { specialty?: string; status?: string; search?: string } = {}) => {
  const qs = new URLSearchParams(
    Object.entries(query).filter(([, v]) => v != null && v !== "") as [string, string][],
  ).toString();
  return api<OsceExamMeta[]>(`/osce/exams${qs ? `?${qs}` : ""}`);
};
export const getOsceExam = (id: string) => api<OsceExamDetail | OsceExamPublic>(`/osce/exams/${id}`);
export const createOsceExam = (input: CreateOsceExamInput) =>
  api<OsceExamDetail>("/osce/exams", { method: "POST", body: input });
export const updateOsceExam = (id: string, input: UpdateOsceExamInput) =>
  api<OsceExamDetail>(`/osce/exams/${id}`, { method: "PATCH", body: input });
export const deleteOsceExam = (id: string) =>
  api<{ deleted: boolean }>(`/osce/exams/${id}`, { method: "DELETE" });

// ─── Sessions (conduct) ───
export const listOsceSessions = () => api<OsceSessionSummary[]>("/osce/sessions");
export const createOsceSession = (input: CreateOsceSessionInput) =>
  api<OsceSessionView>("/osce/sessions", { method: "POST", body: input });
export const getOsceSession = (id: string) => api<OsceSessionView>(`/osce/sessions/${id}`);
export const getOsceLive = (id: string) => api<OsceLiveView>(`/osce/sessions/${id}/live`);
export const getOsceDebrief = (id: string) => api<OsceDebrief>(`/osce/sessions/${id}/debrief`);

export const startOsceStation = (id: string, stationId: string) =>
  api<OsceSessionView>(`/osce/sessions/${id}/stations/${stationId}/start`, { method: "POST" });
export const checkOsceStation = (id: string, stationId: string, input: OsceCheckInput) =>
  api<OsceSessionView>(`/osce/sessions/${id}/stations/${stationId}/check`, {
    method: "PATCH",
    body: input,
  });
export const endOsceStation = (id: string, stationId: string) =>
  api<OsceSessionView>(`/osce/sessions/${id}/stations/${stationId}/end`, { method: "POST" });
export const aiGradeOsceStation = (id: string, stationId: string, transcript: string) =>
  api<OsceSessionView>(`/osce/sessions/${id}/stations/${stationId}/ai-grade`, {
    method: "PATCH",
    body: { transcript },
  });
export const completeOsceSession = (id: string) =>
  api<OsceSessionView>(`/osce/sessions/${id}/complete`, { method: "POST" });

// ─── Self-conduct (student-driven, AI patient) ───
export const getOsceSelf = (id: string) => api<OsceSelfView>(`/osce/sessions/${id}/self`);
export const startOsceSelf = (id: string) =>
  api<OsceSelfView>(`/osce/sessions/${id}/self/start`, { method: "POST" });
export const chatOsceSelf = (id: string, stationId: string, message: string) =>
  api<OsceSelfView>(`/osce/sessions/${id}/self/stations/${stationId}/chat`, {
    method: "POST",
    body: { message },
  });
export const finishOsceSelfStation = (id: string, stationId: string) =>
  api<OsceSelfView>(`/osce/sessions/${id}/self/stations/${stationId}/finish`, { method: "POST" });
