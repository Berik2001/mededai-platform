"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTIES,
  CLINICAL_SPECIALTY_LABELS,
  type CaseStatus,
  type ClinicalSpecialty,
  type CreateOsceExamInput,
  type OsceChecklistItemInput,
  type OsceStationInput,
} from "@med/shared";
import { createOsceExam } from "@/lib/osce";
import { fetchProfile } from "@/lib/auth";
import { getToken } from "@/lib/api";

const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

const emptyItem = (): OsceChecklistItemInput => ({ label: "", points: 1, critical: false });
const emptyStation = (): OsceStationInput => ({
  title: "",
  scenario: "",
  durationSec: 300,
  expectedDiagnosis: "",
  correctPathway: "",
  examinerBrief: "",
  checklist: [emptyItem()],
});

export default function NewOsceExamPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [specialty, setSpecialty] = useState<ClinicalSpecialty>(CLINICAL_SPECIALTIES[0]);
  const [status, setStatus] = useState<CaseStatus>("DRAFT");
  const [passScore, setPassScore] = useState(60);
  const [stations, setStations] = useState<OsceStationInput[]>([emptyStation()]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then((u) => {
        if (u.role !== "TEACHER" && u.role !== "ADMIN") {
          router.replace("/osce");
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  function patchStation(i: number, patch: Partial<OsceStationInput>) {
    setStations((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function patchItem(si: number, ci: number, patch: Partial<OsceChecklistItemInput>) {
    setStations((prev) =>
      prev.map((s, idx) =>
        idx === si
          ? { ...s, checklist: s.checklist.map((c, j) => (j === ci ? { ...c, ...patch } : c)) }
          : s,
      ),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Укажите название");
    for (const [i, s] of stations.entries()) {
      if (!s.title.trim() || !s.scenario.trim())
        return setError(`Станция ${i + 1}: укажите название и задание`);
      if (s.checklist.length === 0 || s.checklist.some((c) => !c.label.trim()))
        return setError(`Станция ${i + 1}: у каждого пункта чек-листа должно быть описание`);
    }
    setSaving(true);
    setError(null);
    const payload: CreateOsceExamInput = {
      title,
      description: description || undefined,
      specialty,
      status,
      passScore,
      stations: stations.map((s) => ({
        ...s,
        expectedDiagnosis: s.expectedDiagnosis || undefined,
        correctPathway: s.correctPathway || undefined,
        examinerBrief: s.examinerBrief || undefined,
        checklist: s.checklist.map((c) => ({
          label: c.label,
          points: Number(c.points) || 0,
          critical: c.critical,
          category: c.category || undefined,
        })),
      })),
    };
    try {
      const exam = await createOsceExam(payload);
      router.push(`/osce/${exam.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать экзамен");
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
    <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-bold">Новый экзамен ОСКЭ</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Сведения об экзамене</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input name="title" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Описание</span>
            <textarea
              className={`${fieldClass} min-h-[60px]`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Специальность</span>
              <select
                className={fieldClass}
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value as ClinicalSpecialty)}
              >
                {CLINICAL_SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {CLINICAL_SPECIALTY_LABELS[s].ru}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Статус</span>
              <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value as CaseStatus)}>
                <option value="DRAFT">Черновик</option>
                <option value="PUBLISHED">Опубликован</option>
                <option value="ARCHIVED">В архиве</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Проходной балл (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                className={fieldClass}
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value))}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {stations.map((station, si) => (
        <Card key={si}>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Станция {si + 1}</CardTitle>
            {stations.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStations((p) => p.filter((_, idx) => idx !== si))}
              >
                ✕ Удалить
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <Input
                name={`st-${si}-title`}
                label="Название станции"
                value={station.title}
                onChange={(e) => patchStation(si, { title: e.target.value })}
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Длительность (сек)</span>
                <input
                  type="number"
                  min={30}
                  max={3600}
                  className={fieldClass}
                  value={station.durationSec}
                  onChange={(e) => patchStation(si, { durationSec: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Задание (видит студент)</span>
              <textarea
                className={`${fieldClass} min-h-[60px]`}
                value={station.scenario}
                onChange={(e) => patchStation(si, { scenario: e.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                name={`st-${si}-dx`}
                label="Ожидаемый диагноз (скрыто)"
                value={station.expectedDiagnosis ?? ""}
                onChange={(e) => patchStation(si, { expectedDiagnosis: e.target.value })}
              />
              <Input
                name={`st-${si}-brief`}
                label="Инструктаж экзаменатора (скрыто)"
                value={station.examinerBrief ?? ""}
                onChange={(e) => patchStation(si, { examinerBrief: e.target.value })}
              />
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Правильная клиническая тактика (скрыто)</span>
              <textarea
                className={`${fieldClass} min-h-[50px]`}
                value={station.correctPathway ?? ""}
                onChange={(e) => patchStation(si, { correctPathway: e.target.value })}
              />
            </label>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">Чек-лист</p>
              <div className="flex flex-col gap-2">
                {station.checklist.map((item, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <input
                      className={`${fieldClass} flex-1`}
                      placeholder="Пункт чек-листа"
                      value={item.label}
                      onChange={(e) => patchItem(si, ci, { label: e.target.value })}
                    />
                    <input
                      type="number"
                      min={0}
                      title="Баллы"
                      className={`${fieldClass} w-16`}
                      value={item.points}
                      onChange={(e) => patchItem(si, ci, { points: Number(e.target.value) })}
                    />
                    <label className="flex items-center gap-1 whitespace-nowrap text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.critical ?? false}
                        onChange={(e) => patchItem(si, ci, { critical: e.target.checked })}
                      />
                      критический
                    </label>
                    {station.checklist.length > 1 && (
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-600"
                        onClick={() =>
                          patchStation(si, { checklist: station.checklist.filter((_, j) => j !== ci) })
                        }
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => patchStation(si, { checklist: [...station.checklist, emptyItem()] })}
              >
                + Добавить пункт
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => setStations((p) => [...p, emptyStation()])}
        className="w-fit"
      >
        + Добавить станцию
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="lg" isLoading={saving}>
          Создать экзамен
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => router.push("/osce")}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
