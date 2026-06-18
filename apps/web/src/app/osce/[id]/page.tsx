"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTY_LABELS,
  type CaseStatus,
  type OsceExamDetail,
} from "@med/shared";
import { deleteOsceExam, getOsceExam, updateOsceExam } from "@/lib/osce";
import { fetchProfile } from "@/lib/auth";
import { getToken } from "@/lib/api";

function isDetail(e: OsceExamDetail | { stations: unknown[] }): e is OsceExamDetail {
  return Array.isArray((e as OsceExamDetail).stations) &&
    (e as OsceExamDetail).stations.every((s) => "checklist" in (s as object));
}

export default function OsceExamManagePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [exam, setExam] = useState<OsceExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then(async (u) => {
        if (u.role !== "TEACHER" && u.role !== "ADMIN") {
          router.replace("/osce");
          return;
        }
        const e = await getOsceExam(id);
        if (isDetail(e)) setExam(e);
      })
      .catch(() => router.replace("/osce"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function setStatus(status: CaseStatus) {
    if (!exam) return;
    setBusy(true);
    try {
      const updated = await updateOsceExam(exam.id, { status });
      setExam(updated);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!exam || !confirm(`Удалить «${exam.title}»?`)) return;
    await deleteOsceExam(exam.id);
    router.push("/osce");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (!exam) return <p className="text-slate-500">Экзамен не найден.</p>;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/osce" className="text-sm text-brand-600 hover:underline">
        ← ОСКЭ
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          <p className="text-sm text-slate-500">
            {CLINICAL_SPECIALTY_LABELS[exam.specialty]?.ru ?? exam.specialty} · {exam.stationCount} station(s) ·{" "}
            {Math.round(exam.totalDurationSec / 60)} мин · {exam.maxScore} баллов · проходной {exam.passScore}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={exam.status === "PUBLISHED" ? "green" : "neutral"}>{exam.status.toLowerCase()}</Badge>
          {exam.status !== "PUBLISHED" ? (
            <Button size="sm" isLoading={busy} onClick={() => setStatus("PUBLISHED")}>
              Опубликовать
            </Button>
          ) : (
            <Button size="sm" variant="outline" isLoading={busy} onClick={() => setStatus("DRAFT")}>
              Снять с публикации
            </Button>
          )}
          <Link href={`/osce/sessions/new?examId=${exam.id}`}>
            <Button size="sm" variant="outline">
              Провести
            </Button>
          </Link>
          <Button size="sm" variant="danger" onClick={remove}>
            Удалить
          </Button>
        </div>
      </div>

      {exam.description && <p className="text-slate-600">{exam.description}</p>}

      {exam.stations.map((s) => (
        <Card key={s.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                {s.order + 1}. {s.title}
              </CardTitle>
              <span className="text-xs text-slate-500">
                {Math.round(s.durationSec / 60)} мин · {s.maxScore} баллов
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-slate-700">{s.scenario}</p>
            {s.expectedDiagnosis && (
              <p>
                <span className="font-medium text-slate-700">Ожидаемый диагноз:</span>{" "}
                <span className="text-slate-600">{s.expectedDiagnosis}</span>
              </p>
            )}
            {s.correctPathway && (
              <p>
                <span className="font-medium text-slate-700">Тактика:</span>{" "}
                <span className="text-slate-600">{s.correctPathway}</span>
              </p>
            )}
            <div>
              <p className="mb-1 font-medium text-slate-700">Чек-лист</p>
              <ul className="flex flex-col gap-1">
                {s.checklist.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-slate-600">
                    <span className="text-slate-400">•</span>
                    <span className="flex-1">{c.label}</span>
                    {c.critical && <Badge tone="red">критический</Badge>}
                    <span className="text-xs text-slate-400">{c.points} балл.</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
