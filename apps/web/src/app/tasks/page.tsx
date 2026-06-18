"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent, Spinner } from "@med/ui";
import type { StudentTask, SubmissionStatus } from "@med/shared";
import { myTasks, submitTask } from "@/lib/assignments";
import { launchCase } from "@/lib/cases";
import { startSession } from "@/lib/tests";
import { getToken, ApiRequestError } from "@/lib/api";

const statusTone: Record<SubmissionStatus, "neutral" | "amber" | "green" | "red"> = {
  ASSIGNED: "neutral",
  IN_PROGRESS: "amber",
  SUBMITTED: "green",
  GRADED: "green",
  LATE: "red",
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await myTasks());
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
      else setError(err instanceof Error ? err.message : "Не удалось загрузить задания");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void load();
  }, [load, router]);

  async function start(t: StudentTask) {
    setBusy(t.submissionId);
    try {
      if (t.targetType === "CASE" && t.caseId) {
        const { sessionId } = await launchCase(t.caseId);
        router.push(`/virtual-patient/${sessionId}`);
      } else if (t.targetType === "TEST" && t.testId) {
        const session = await startSession(t.testId);
        router.push(`/test-sessions/${session.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать");
      setBusy(null);
    }
  }

  async function submit(t: StudentTask) {
    setBusy(t.submissionId);
    setError(null);
    try {
      await submitTask(t.submissionId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Мои задания</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {tasks.length === 0 ? (
        <p className="text-slate-500">Пока нет назначенных заданий.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((t) => {
            const overdue = t.status === "LATE";
            const done = t.status === "SUBMITTED" || t.status === "GRADED";
            const due = new Date(t.dueAt);
            return (
              <Card key={t.submissionId} className={overdue ? "border-red-300" : ""}>
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{t.targetType === "CASE" ? "Случай" : "Тест"}</Badge>
                        <Badge tone={statusTone[t.status]}>{t.status.replace("_", " ")}</Badge>
                      </div>
                      <p className="mt-1 font-semibold">{t.title}</p>
                      <p className="text-sm text-slate-500">
                        {t.targetTitle} · преподаватель {t.teacherName}
                      </p>
                      {t.instructions && <p className="mt-1 text-sm text-slate-600">{t.instructions}</p>}
                    </div>
                    <div className="text-right text-sm">
                      <p className={overdue ? "font-medium text-red-600" : "text-slate-600"}>
                        Срок {due.toLocaleString()}
                      </p>
                      {typeof t.score === "number" && <p className="text-slate-500">Балл: {t.score}%</p>}
                      {typeof t.grade === "number" && <p className="font-medium">Оценка: {t.grade}/100</p>}
                    </div>
                  </div>

                  {t.status === "GRADED" && t.feedback && (
                    <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                      <span className="font-medium">Обратная связь: </span>
                      {t.feedback}
                    </div>
                  )}

                  {!done && (
                    <div className="flex gap-2">
                      <Button onClick={() => start(t)} isLoading={busy === t.submissionId}>
                        {t.targetType === "CASE" ? "Открыть пациента" : "Начать тест"}
                      </Button>
                      <Button variant="outline" onClick={() => submit(t)} disabled={busy === t.submissionId}>
                        Отправить результат
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-400">
        Совет: откройте задание, выполните его, затем нажмите «Отправить результат» — ваша последняя
        завершённая попытка прикрепится автоматически.
      </p>
    </div>
  );
}
