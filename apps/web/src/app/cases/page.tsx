"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from "@med/ui";
import {
  CLINICAL_SPECIALTIES,
  CLINICAL_SPECIALTY_LABELS,
  type ClinicalCaseMeta,
  type ClinicalSpecialty,
  type PublicUser,
} from "@med/shared";
import { listCases } from "@/lib/cases";
import { fetchProfile } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";
import { difficultyLabel, contentStatusLabel } from "@/lib/labels";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const difficultyTone = { BEGINNER: "green", INTERMEDIATE: "amber", ADVANCED: "red" } as const;
const statusTone = { PUBLISHED: "green", DRAFT: "amber", ARCHIVED: "neutral" } as const;

export default function CasesBrowser() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [cases, setCases] = useState<ClinicalCaseMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [specialty, setSpecialty] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");

  const isStaff = user?.role === "TEACHER" || user?.role === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCases({ specialty, difficulty, search });
      setCases(res.items);
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
      else setError(err instanceof Error ? err.message : "Не удалось загрузить случаи");
    } finally {
      setLoading(false);
    }
  }, [specialty, difficulty, search, router]);

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Клинические кейсы</h1>
          <p className="text-slate-600">Просматривайте случаи и запускайте сценарий с виртуальным пациентом.</p>
        </div>
        {isStaff && (
          <Link href="/cases/new">
            <Button>+ Новый случай</Button>
          </Link>
        )}
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Сложность</span>
            <select
              className="h-10 rounded-lg border border-slate-300 px-3"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">Любая</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {difficultyLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Поиск</span>
            <input
              className="h-10 rounded-lg border border-slate-300 px-3"
              placeholder="Название…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={30} />
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : cases.length === 0 ? (
        <p className="text-slate-500">Нет случаев, соответствующих фильтрам.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{CLINICAL_SPECIALTY_LABELS[c.specialty].ru}</Badge>
                    <Badge tone={difficultyTone[c.difficulty]}>{difficultyLabel(c.difficulty)}</Badge>
                    {c.status !== "PUBLISHED" && (
                      <Badge tone={statusTone[c.status]}>{contentStatusLabel(c.status)}</Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2 text-base">{c.title}</CardTitle>
                  {c.summary && (
                    <CardDescription className="line-clamp-2">{c.summary}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-400">
                    {c.authorName ? `Автор: ${c.authorName}` : ""}
                    {c.estimatedMinutes ? ` · ~${c.estimatedMinutes} мин` : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
