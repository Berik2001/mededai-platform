"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTY_LABELS,
  type PublicUser,
  type TestDetail,
  type TestMeta,
} from "@med/shared";
import { deleteTest, getTest, startSession } from "@/lib/tests";
import { fetchProfile } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";
import { difficultyLabel, contentStatusLabel } from "@/lib/labels";

export default function TestIntro() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<TestMeta | TestDetail | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = user && test && (user.role === "ADMIN" || user.id === test.authorId);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    Promise.all([getTest(id), fetchProfile().catch(() => null)])
      .then(([t, u]) => {
        setTest(t);
        setUser(u);
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить тест");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function begin() {
    setStarting(true);
    try {
      const session = await startSession(id);
      router.push(`/test-sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать");
      setStarting(false);
    }
  }

  async function onDelete() {
    if (!confirm("Удалить этот тест?")) return;
    try {
      await deleteTest(id);
      router.push("/tests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (error && !test) return <p className="text-red-600">{error}</p>;
  if (!test) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/tests" className="text-sm text-brand-600 hover:underline">
        ← Все тесты
      </Link>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{CLINICAL_SPECIALTY_LABELS[test.specialty].ru}</Badge>
            <Badge tone="neutral">{difficultyLabel(test.difficulty)}</Badge>
            {test.status !== "PUBLISHED" && <Badge tone="amber">{contentStatusLabel(test.status)}</Badge>}
          </div>
          <CardTitle className="mt-2 text-2xl">{test.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {test.description && <p className="text-slate-700">{test.description}</p>}
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Вопросы" value={test.questionCount} />
            <Stat label="Ограничение времени" value={`${test.timeLimitMinutes} мин`} />
            <Stat label="Проходной балл" value={`${test.passingScore}%`} />
          </dl>
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            ⏱ Таймер запускается сразу после начала и автоматически завершает тест по истечении времени.
          </div>
          <div className="flex gap-2">
            <Button size="lg" onClick={begin} isLoading={starting}>
              Начать тест
            </Button>
            {canEdit && (
              <>
                <Link href={`/tests/${id}/edit`}>
                  <Button size="lg" variant="outline">
                    Редактировать
                  </Button>
                </Link>
                <Button size="lg" variant="danger" onClick={onDelete}>
                  Удалить
                </Button>
              </>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}
