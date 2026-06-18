"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from "@med/ui";
import type { AssignmentDetail, SubmissionStatus, SubmissionView } from "@med/shared";
import { deleteAssignment, getAssignment, reviewSubmission } from "@/lib/assignments";
import { getToken, ApiRequestError } from "@/lib/api";

const statusTone: Record<SubmissionStatus, "neutral" | "amber" | "green" | "red"> = {
  ASSIGNED: "neutral",
  IN_PROGRESS: "amber",
  SUBMITTED: "green",
  GRADED: "green",
  LATE: "red",
};

const statusLabel: Record<SubmissionStatus, string> = {
  ASSIGNED: "назначено",
  IN_PROGRESS: "в процессе",
  SUBMITTED: "отправлено",
  GRADED: "оценено",
  LATE: "просрочено",
};

export default function AssignmentDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setA(await getAssignment(id));
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403))
        router.replace("/assignments");
      else setError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void load();
  }, [load, router]);

  async function onDelete() {
    if (!confirm("Удалить это задание и все ответы по нему?")) return;
    await deleteAssignment(id).catch(() => undefined);
    router.push("/assignments");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (error && !a) return <p className="text-red-600">{error}</p>;
  if (!a) return null;

  const resultHref = (s: SubmissionView) =>
    s.resultRef
      ? a.targetType === "CASE"
        ? `/virtual-patient/${s.resultRef}`
        : `/test-sessions/${s.resultRef}`
      : null;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/assignments" className="text-sm text-brand-600 hover:underline">
        ← Все задания
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{a.targetType === "CASE" ? "Случай" : "Тест"}</Badge>
            <span className="text-sm text-slate-500">{a.targetTitle}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold">{a.title}</h1>
          {a.instructions && <p className="mt-1 text-slate-600">{a.instructions}</p>}
          <p className="mt-1 text-sm text-slate-500">Срок: {new Date(a.dueAt).toLocaleString()}</p>
        </div>
        <Button variant="danger" onClick={onDelete}>
          Удалить
        </Button>
      </div>

      <h2 className="text-lg font-semibold">
        Ответы ({a.submittedCount}/{a.submissionCount} отправлено)
      </h2>
      <div className="flex flex-col gap-3">
        {a.submissions.map((s) => (
          <SubmissionRow key={s.id} s={s} resultHref={resultHref(s)} onReviewed={load} statusTone={statusTone} />
        ))}
      </div>
    </div>
  );
}

function SubmissionRow({
  s,
  resultHref,
  onReviewed,
  statusTone,
}: {
  s: SubmissionView;
  resultHref: string | null;
  onReviewed: () => void;
  statusTone: Record<SubmissionStatus, "neutral" | "amber" | "green" | "red">;
}) {
  const [grade, setGrade] = useState(s.grade?.toString() ?? "");
  const [feedback, setFeedback] = useState(s.feedback ?? "");
  const [saving, setSaving] = useState(false);
  const reviewable = s.status === "SUBMITTED" || s.status === "GRADED";

  async function save() {
    setSaving(true);
    try {
      await reviewSubmission(s.id, {
        grade: grade === "" ? undefined : Number(grade),
        feedback: feedback || undefined,
      });
      onReviewed();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">{s.studentName}</CardTitle>
        <div className="flex items-center gap-2 text-sm">
          {typeof s.score === "number" && <span className="text-slate-500">Балл {s.score}%</span>}
          <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {s.submittedAt && (
          <p className="text-xs text-slate-400">
            Отправлено {new Date(s.submittedAt).toLocaleString()}
            {resultHref && (
              <>
                {" · "}
                <Link href={resultHref} className="text-brand-600 hover:underline">
                  Посмотреть результат
                </Link>
              </>
            )}
          </p>
        )}
        {reviewable ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Оценка /100</span>
              <input
                type="number"
                min={0}
                max={100}
                className="h-9 w-24 rounded-lg border border-slate-300 px-2 text-sm"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </label>
            <input
              className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="Отзыв / комментарий"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <Button size="sm" onClick={save} isLoading={saving}>
              {s.status === "GRADED" ? "Обновить" : "Сохранить оценку"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Ещё не отправлено.</p>
        )}
      </CardContent>
    </Card>
  );
}
