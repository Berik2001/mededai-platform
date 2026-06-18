"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTIES,
  CLINICAL_SPECIALTY_LABELS,
  type ClinicalSpecialty,
  type PublicUser,
  type TestMeta,
} from "@med/shared";
import { listTests } from "@/lib/tests";
import { fetchProfile } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";
import { difficultyLabel, contentStatusLabel } from "@/lib/labels";

const difficultyTone = { BEGINNER: "green", INTERMEDIATE: "amber", ADVANCED: "red" } as const;

export default function TestsBrowser() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [tests, setTests] = useState<TestMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState("");

  const isStaff = user?.role === "TEACHER" || user?.role === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTests({ specialty });
      setTests(res.items);
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
      else setError(err instanceof Error ? err.message : "Не удалось загрузить тесты");
    } finally {
      setLoading(false);
    }
  }, [specialty, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile().then(setUser).catch(() => undefined);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Тесты</h1>
          <p className="text-slate-600">Тесты на время с автоматической проверкой.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/test-sessions">
            <Button variant="outline">Мои результаты</Button>
          </Link>
          {isStaff && (
            <>
              <Link href="/questions">
                <Button variant="outline">Банк вопросов</Button>
              </Link>
              <Link href="/tests/new">
                <Button>+ Новый тест</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Специальность</span>
            <select
              className="h-10 rounded-lg border border-slate-300 px-3"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            >
              <option value="">Все</option>
              {CLINICAL_SPECIALTIES.map((s: ClinicalSpecialty) => (
                <option key={s} value={s}>
                  {CLINICAL_SPECIALTY_LABELS[s].ru}
                </option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={30} />
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : tests.length === 0 ? (
        <p className="text-slate-500">Нет доступных тестов.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => (
            <Link key={t.id} href={`/tests/${t.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{CLINICAL_SPECIALTY_LABELS[t.specialty].ru}</Badge>
                    <Badge tone={difficultyTone[t.difficulty]}>{difficultyLabel(t.difficulty)}</Badge>
                    {t.status !== "PUBLISHED" && <Badge tone="amber">{contentStatusLabel(t.status)}</Badge>}
                  </div>
                  <CardTitle className="mt-2 text-base">{t.title}</CardTitle>
                  <CardDescription>
                    {t.questionCount} вопр. · {t.timeLimitMinutes} мин · проходной {t.passingScore}%
                  </CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
