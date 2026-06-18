"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTY_LABELS,
  QUESTION_TYPE_META,
  QUESTION_TYPES,
  type Question,
  type QuestionType,
} from "@med/shared";
import { deleteQuestion, listQuestions } from "@/lib/tests";
import { fetchProfile } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";
import { contentStatusLabel } from "@/lib/labels";

export default function QuestionBank() {
  const router = useRouter();
  const [rows, setRows] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listQuestions({ type });
      setRows(res.items);
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403))
        router.replace("/tests");
      else setError(err instanceof Error ? err.message : "Не удалось загрузить");
    } finally {
      setLoading(false);
    }
  }, [type, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then((u) => {
        if (u.role !== "TEACHER" && u.role !== "ADMIN") router.replace("/tests");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete(id: string) {
    if (!confirm("Удалить этот вопрос?")) return;
    await deleteQuestion(id).catch(() => undefined);
    void load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Банк вопросов</h1>
        <div className="flex gap-2">
          <Link href="/tests">
            <Button variant="outline">← Тесты</Button>
          </Link>
          <Link href="/questions/new">
            <Button>+ Новый вопрос</Button>
          </Link>
        </div>
      </div>

      <select
        className="h-10 w-64 rounded-lg border border-slate-300 px-3 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="">Все типы</option>
        {QUESTION_TYPES.map((t: QuestionType) => (
          <option key={t} value={t}>
            {QUESTION_TYPE_META[t].ru}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={30} />
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">Пока нет вопросов.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((q) => (
            <Card key={q.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{QUESTION_TYPE_META[q.type].ru}</Badge>
                    <Badge tone="neutral">{CLINICAL_SPECIALTY_LABELS[q.specialty].ru}</Badge>
                    {q.status !== "PUBLISHED" && <Badge tone="amber">{contentStatusLabel(q.status)}</Badge>}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-800">{q.stem}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`/questions/${q.id}/edit`}>
                    <Button variant="outline" size="sm">
                      Редактировать
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(q.id)}>
                    ✕
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
