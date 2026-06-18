"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTY_LABELS,
  type OsceExamMeta,
  type OsceSessionStatus,
  type OsceSessionSummary,
  type PublicUser,
} from "@med/shared";
import { listOsceExams, listOsceSessions } from "@/lib/osce";
import { fetchProfile } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";

const statusTone: Record<OsceSessionStatus, "neutral" | "brand" | "green" | "amber"> = {
  SCHEDULED: "neutral",
  IN_PROGRESS: "amber",
  COMPLETED: "green",
  CANCELLED: "neutral",
};

export default function OscePage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [exams, setExams] = useState<OsceExamMeta[]>([]);
  const [sessions, setSessions] = useState<OsceSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then(async (u) => {
        setUser(u);
        const [e, s] = await Promise.all([listOsceExams(), listOsceSessions()]);
        setExams(e);
        setSessions(s);
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  const isStaff = user?.role === "TEACHER" || user?.role === "ADMIN";
  const isExaminer = user?.role === "EXAMINER" || isStaff;
  const isStudent = user?.role === "STUDENT";

  function sessionHref(s: OsceSessionSummary): string {
    if (s.status === "COMPLETED") return `/osce/debrief/${s.id}`;
    if (isStudent) return s.selfConduct ? `/osce/self/${s.id}` : `/osce/exam/${s.id}`;
    return `/osce/conduct/${s.id}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ОСКЭ</h1>
          <p className="text-sm text-slate-500">Объективный структурированный клинический экзамен</p>
        </div>
        <div className="flex gap-2">
          {isExaminer && (
            <Link href="/osce/sessions/new">
              <Button variant="outline">Провести экзамен</Button>
            </Link>
          )}
          {isStaff && (
            <Link href="/osce/new">
              <Button>Новый экзамен</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Sessions */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {isStudent ? "Мои экзамены" : "Сессии, которые я провожу"}
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">Пока нет сессий.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.map((s) => (
              <Link key={s.id} href={sessionHref(s)}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-2 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.examTitle}</span>
                      <Badge tone={statusTone[s.status]}>{s.status.replace("_", " ").toLowerCase()}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {CLINICAL_SPECIALTY_LABELS[s.specialty]?.ru ?? s.specialty} · станций: {s.stationCount}
                    </p>
                    <p className="text-xs text-slate-400">
                      {isStudent ? `Экзаменатор: ${s.examinerName}` : `Студент: ${s.studentName}`}
                      {s.status === "COMPLETED" && ` · ${s.percent}%`}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Exams catalogue */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Шаблоны экзаменов</h2>
        {exams.length === 0 ? (
          <p className="text-sm text-slate-500">Нет доступных экзаменов.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((e) => (
              <Card key={e.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{e.title}</CardTitle>
                    <Badge tone={e.status === "PUBLISHED" ? "green" : "neutral"}>
                      {e.status.toLowerCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="text-xs text-slate-500">
                    {CLINICAL_SPECIALTY_LABELS[e.specialty]?.ru ?? e.specialty} · станций: {e.stationCount} ·{" "}
                    {Math.round(e.totalDurationSec / 60)} мин · {e.maxScore} баллов
                  </p>
                  {e.description && <p className="line-clamp-2 text-sm text-slate-600">{e.description}</p>}
                  <div className="mt-auto flex gap-2">
                    {isStaff && (
                      <Link href={`/osce/${e.id}`} className="text-sm text-brand-600 hover:underline">
                        Управление →
                      </Link>
                    )}
                    {isExaminer && e.status === "PUBLISHED" && (
                      <Link
                        href={`/osce/sessions/new?examId=${e.id}`}
                        className="text-sm text-brand-600 hover:underline"
                      >
                        Провести →
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
