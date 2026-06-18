"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Card, CardContent, Spinner } from "@med/ui";
import type { TestSessionSummary } from "@med/shared";
import { listSessions } from "@/lib/tests";
import { getToken, ApiRequestError } from "@/lib/api";
import { testSessionStatusLabel } from "@/lib/labels";

const statusTone = { IN_PROGRESS: "amber", SUBMITTED: "green", EXPIRED: "neutral" } as const;

export default function SessionHistory() {
  const router = useRouter();
  const [rows, setRows] = useState<TestSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    listSessions()
      .then(setRows)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить историю");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Мои результаты тестов</h1>
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={30} />
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">Пока нет попыток.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((s) => (
            <Link key={s.id} href={`/test-sessions/${s.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">{s.testTitle}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(s.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {typeof s.score === "number" && s.maxScore ? (
                      <span className="text-sm font-semibold">
                        {Math.round((s.score / s.maxScore) * 100)}%
                      </span>
                    ) : null}
                    {s.passed != null && (
                      <Badge tone={s.passed ? "green" : "red"}>{s.passed ? "СДАН" : "НЕ СДАН"}</Badge>
                    )}
                    <Badge tone={statusTone[s.status]}>{testSessionStatusLabel(s.status)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
