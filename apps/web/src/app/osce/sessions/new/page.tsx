"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTY_LABELS,
  type OsceExamMeta,
  type StudentListItem,
} from "@med/shared";
import { createOsceSession, listOsceExams } from "@/lib/osce";
import { listStudents } from "@/lib/assignments";
import { fetchProfile } from "@/lib/auth";
import { getToken } from "@/lib/api";

const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export default function NewOsceSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      }
    >
      <NewOsceSessionForm />
    </Suspense>
  );
}

function NewOsceSessionForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [ready, setReady] = useState(false);
  const [exams, setExams] = useState<OsceExamMeta[]>([]);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [examId, setExamId] = useState(search.get("examId") ?? "");
  const [studentId, setStudentId] = useState("");
  const [selfConduct, setSelfConduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then((u) => {
        if (u.role === "STUDENT") {
          router.replace("/osce");
          return;
        }
        return Promise.all([listOsceExams({ status: "PUBLISHED" }), listStudents()]).then(([e, s]) => {
          setExams(e);
          setStudents(s);
          setReady(true);
        });
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!examId) return setError("Выберите экзамен");
    if (!studentId) return setError("Выберите студента");
    setSaving(true);
    setError(null);
    try {
      const session = await createOsceSession({ examId, studentId, selfConduct });
      router.push(`/osce/conduct/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать сессию");
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="text-2xl font-bold">Провести ОСКЭ</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Сессия</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Экзамен</span>
            <select className={fieldClass} value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">Выберите экзамен…</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({CLINICAL_SPECIALTY_LABELS[e.specialty]?.ru ?? e.specialty}, станций: {e.stationCount})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Студент</span>
            <select className={fieldClass} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Выберите студента…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={selfConduct}
              onChange={(e) => setSelfConduct(e.target.checked)}
            />
            <span>
              <span className="font-medium text-slate-700">Самостоятельный режим (ИИ-пациент)</span>
              <span className="block text-xs text-slate-500">
                Студент проходит станции сам: общается с виртуальным ИИ-пациентом в чате, чек-лист
                оценивает ИИ, после последней станции автоматически формируется разбор.
              </span>
            </span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button type="submit" size="lg" isLoading={saving}>
          Начать сессию
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => router.push("/osce")}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
