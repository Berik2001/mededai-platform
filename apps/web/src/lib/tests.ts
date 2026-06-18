import type {
  CreateQuestionInput,
  CreateTestInput,
  PaginatedResult,
  Question,
  TestDetail,
  TestMeta,
  TestSessionSummary,
  TestSessionView,
  UpdateQuestionInput,
  UpdateTestInput,
  UploadResult,
} from "@med/shared";
import { api, getToken } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function qs(filters: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== "") p.set(k, String(v));
  return p.toString() ? `?${p}` : "";
}

/** Absolute URL for a stored upload path like `/uploads/abc.png`. */
export function mediaUrl(path: string): string {
  if (!path) return path;
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

// ─── Questions (staff) ───
export const listQuestions = (f: Record<string, unknown> = {}) =>
  api<PaginatedResult<Question>>(`/questions${qs(f)}`);
export const getQuestion = (id: string) => api<Question>(`/questions/${id}`);
export const createQuestion = (input: CreateQuestionInput) =>
  api<Question>("/questions", { method: "POST", body: input });
export const updateQuestion = (id: string, input: UpdateQuestionInput) =>
  api<Question>(`/questions/${id}`, { method: "PATCH", body: input });
export const deleteQuestion = (id: string) =>
  api<{ deleted: boolean }>(`/questions/${id}`, { method: "DELETE" });

// ─── Tests ───
export const listTests = (f: Record<string, unknown> = {}) =>
  api<PaginatedResult<TestMeta>>(`/tests${qs(f)}`);
export const getTest = (id: string) => api<TestDetail | TestMeta>(`/tests/${id}`);
export const createTest = (input: CreateTestInput) =>
  api<TestDetail>("/tests", { method: "POST", body: input });
export const updateTest = (id: string, input: UpdateTestInput) =>
  api<TestDetail>(`/tests/${id}`, { method: "PATCH", body: input });
export const deleteTest = (id: string) =>
  api<{ deleted: boolean }>(`/tests/${id}`, { method: "DELETE" });

// ─── Sessions (students) ───
export const startSession = (testId: string) =>
  api<TestSessionView>(`/tests/${testId}/sessions`, { method: "POST" });
export const getSession = (id: string) => api<TestSessionView>(`/test-sessions/${id}`);
export const saveAnswers = (id: string, answers: Record<string, number[]>) =>
  api<{ ok: true }>(`/test-sessions/${id}/answers`, { method: "PATCH", body: { answers } });
export const submitSession = (id: string, answers: Record<string, number[]>) =>
  api<TestSessionView>(`/test-sessions/${id}/submit`, { method: "POST", body: { answers } });
export const listSessions = () => api<TestSessionSummary[]>("/test-sessions");

// ─── Image upload ───
export async function uploadImage(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/api/uploads/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    body: form,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).message ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg);
  }
  return res.json();
}
