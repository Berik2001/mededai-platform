import type { CohortAnalytics, StudentAnalytics } from "@med/shared";
import { api, getToken } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const myAnalytics = () => api<StudentAnalytics>("/analytics/me");
export const studentAnalytics = (id: string) => api<StudentAnalytics>(`/analytics/students/${id}`);
export const cohortAnalytics = (groupId?: string) =>
  api<CohortAnalytics>(`/analytics/overview${groupId ? `?groupId=${encodeURIComponent(groupId)}` : ""}`);

/** Fetch the CSV export and trigger a browser download. */
export async function downloadReport(
  scope: "group" | "student",
  opts: { studentId?: string; groupId?: string } = {},
): Promise<void> {
  const params = new URLSearchParams({ scope });
  if (opts.studentId) params.set("studentId", opts.studentId);
  if (opts.groupId) params.set("groupId", opts.groupId);

  const res = await fetch(`${API_URL}/api/analytics/export?${params.toString()}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);

  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const filename = cd.match(/filename="(.+?)"/)?.[1] ?? "report.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
