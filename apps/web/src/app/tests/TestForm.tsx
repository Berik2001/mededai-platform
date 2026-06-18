"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTIES,
  CLINICAL_SPECIALTY_LABELS,
  QUESTION_TYPE_META,
  type ClinicalSpecialty,
  type CreateTestInput,
  type Question,
  type TestDetail,
} from "@med/shared";
import { createTest, listQuestions, updateTest } from "@/lib/tests";
import { difficultyLabel, contentStatusLabel } from "@/lib/labels";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export default function TestForm({ initial }: { initial?: TestDetail }) {
  const router = useRouter();
  const editing = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [specialty, setSpecialty] = useState<ClinicalSpecialty>(
    (initial?.specialty ?? "THERAPY") as ClinicalSpecialty,
  );
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "INTERMEDIATE");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [timeLimit, setTimeLimit] = useState(initial?.timeLimitMinutes?.toString() ?? "20");
  const [passing, setPassing] = useState(initial?.passingScore?.toString() ?? "60");
  const [shuffle, setShuffle] = useState(initial?.shuffle ?? false);
  const [selected, setSelected] = useState<string[]>(initial?.questionIds ?? []);

  const [bank, setBank] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listQuestions({ limit: 200 })
      .then((res) => setBank(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить вопросы"))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Укажите название");
    if (selected.length === 0) return setError("Выберите хотя бы один вопрос");
    setSaving(true);
    setError(null);
    const payload: CreateTestInput = {
      title,
      description: description || undefined,
      specialty,
      difficulty: difficulty as CreateTestInput["difficulty"],
      status: status as CreateTestInput["status"],
      timeLimitMinutes: Number(timeLimit) || 20,
      passingScore: Number(passing) || 60,
      shuffle,
      questionIds: selected,
    };
    try {
      const result = initial ? await updateTest(initial.id, payload) : await createTest(payload);
      router.push(`/tests/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить тест");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-bold">{editing ? "Редактировать тест" : "Новый тест"}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Настройки</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input name="title" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <Input name="description" label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Специальность</span>
            <select className={fieldClass} value={specialty} onChange={(e) => setSpecialty(e.target.value as typeof specialty)}>
              {CLINICAL_SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {CLINICAL_SPECIALTY_LABELS[s].ru}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Сложность</span>
            <select className={fieldClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {difficultyLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <Input name="time" type="number" label="Ограничение времени (мин)" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
          <Input name="pass" type="number" label="Проходной балл (%)" value={passing} onChange={(e) => setPassing(e.target.value)} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Статус</span>
            <select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {contentStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
            Перемешивать порядок вопросов для каждого студента
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Вопросы (выбрано: {selected.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size={24} />
            </div>
          ) : bank.length === 0 ? (
            <p className="text-sm text-slate-500">
              В банке нет вопросов.{" "}
              <a className="text-brand-600 hover:underline" href="/questions/new">
                Создать вопрос
              </a>
              .
            </p>
          ) : (
            bank.map((q) => {
              const idx = selected.indexOf(q.id);
              const picked = idx >= 0;
              return (
                <label
                  key={q.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    picked ? "border-brand-500 bg-brand-50" : "border-slate-200"
                  }`}
                >
                  <input type="checkbox" checked={picked} onChange={() => toggle(q.id)} />
                  {picked && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs text-white">
                      {idx + 1}
                    </span>
                  )}
                  <Badge tone="neutral">{QUESTION_TYPE_META[q.type].ru}</Badge>
                  <span className="min-w-0 flex-1 truncate">{q.stem}</span>
                  <span className="text-xs text-slate-400">{q.points} балл.</span>
                </label>
              );
            })
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="lg" isLoading={saving}>
          {editing ? "Сохранить изменения" : "Создать тест"}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => router.push("/tests")}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
