"use client";

import { useEffect, useState } from "react";
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
import type { Difficulty, MedicalSpecialty, VPSessionSummary } from "@med/shared";
import { createSession, listSessions } from "@/lib/virtualPatient";
import { getToken, ApiRequestError } from "@/lib/api";
import { difficultyLabel, specialtyLabel, vpSessionStatusLabel } from "@/lib/labels";

const SPECIALTIES: MedicalSpecialty[] = [
  "EMERGENCY",
  "CARDIOLOGY",
  "NEUROLOGY",
  "PEDIATRICS",
  "INTERNAL_MEDICINE",
  "SURGERY",
];
const DIFFICULTIES: Difficulty[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

const statusTone = { ACTIVE: "amber", COMPLETED: "green", ABANDONED: "neutral" } as const;

export default function VirtualPatientHome() {
  const router = useRouter();
  const [sessions, setSessions] = useState<VPSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState<MedicalSpecialty>("EMERGENCY");
  const [difficulty, setDifficulty] = useState<Difficulty>("INTERMEDIATE");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    listSessions()
      .then(setSessions)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить сессии");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function start() {
    setCreating(true);
    setError(null);
    try {
      const session = await createSession({ specialty, difficulty });
      router.push(`/virtual-patient/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать сессию");
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Виртуальный пациент</h1>
        <p className="mt-1 text-slate-600">
          Опросите смоделированного пациента, назначьте исследования, проведите лечение и поставьте диагноз.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Начать новый приём</CardTitle>
          <CardDescription>Сценарий генерируется для выбранной специальности.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Специальность</span>
            <select
              className="h-10 rounded-lg border border-slate-300 px-3"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value as MedicalSpecialty)}
            >
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {specialtyLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Сложность</span>
            <select
              className="h-10 rounded-lg border border-slate-300 px-3"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {difficultyLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={start} isLoading={creating} size="lg">
            Начать приём
          </Button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Недавние сессии</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner size={28} />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-slate-500">Пока нет сессий — начните первый приём выше.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <Link key={s.id} href={`/virtual-patient/${s.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="brand">{specialtyLabel(s.specialty)}</Badge>
                      <Badge tone={statusTone[s.status]}>{vpSessionStatusLabel(s.status)}</Badge>
                    </div>
                    <CardTitle className="mt-2 text-base">{s.title}</CardTitle>
                    <CardDescription>
                      {difficultyLabel(s.difficulty)}
                      {typeof s.score === "number" ? ` · Балл ${s.score}/100` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
