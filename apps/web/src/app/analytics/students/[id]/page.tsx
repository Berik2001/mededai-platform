"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Spinner } from "@med/ui";
import type { StudentAnalytics } from "@med/shared";
import { downloadReport, studentAnalytics } from "@/lib/analytics";
import { fetchProfile } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";
import StudentAnalyticsView from "../../StudentAnalyticsView";

export default function StudentDrilldownPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then(async (u) => {
        if (u.role !== "TEACHER" && u.role !== "ADMIN") {
          router.replace("/analytics");
          return;
        }
        setAnalytics(await studentAnalytics(id));
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadReport("student", { studentId: id });
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (error || !analytics) return <p className="text-slate-500">{error ?? "Не найдено."}</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/analytics" className="text-sm text-brand-600 hover:underline">
        ← Аналитика группы
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{analytics.studentName}</h1>
          <p className="text-sm text-slate-500">Детальный разбор индивидуальных результатов.</p>
        </div>
        <Button variant="outline" isLoading={exporting} onClick={exportCsv}>
          Экспорт в CSV
        </Button>
      </div>
      <StudentAnalyticsView a={analytics} />
    </div>
  );
}
