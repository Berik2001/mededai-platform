"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTIES,
  CLINICAL_SPECIALTY_LABELS,
  QUESTION_TYPE_META,
  QUESTION_TYPES,
  type ClinicalSpecialty,
  type CreateQuestionInput,
  type Question,
  type QuestionType,
} from "@med/shared";
import { createQuestion, mediaUrl, updateQuestion, uploadImage } from "@/lib/tests";
import { difficultyLabel, contentStatusLabel } from "@/lib/labels";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];
const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export default function QuestionForm({ initial }: { initial?: Question }) {
  const router = useRouter();
  const editing = Boolean(initial);

  const [type, setType] = useState<QuestionType>(initial?.type ?? "SINGLE_CHOICE");
  const [specialty, setSpecialty] = useState<ClinicalSpecialty>(
    (initial?.specialty ?? "THERAPY") as ClinicalSpecialty,
  );
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "INTERMEDIATE");
  const [status, setStatus] = useState(initial?.status ?? "DRAFT");
  const [stem, setStem] = useState(initial?.stem ?? "");
  const [caseVignette, setCaseVignette] = useState(initial?.caseVignette ?? "");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [points, setPoints] = useState(initial?.points?.toString() ?? "1");
  const [options, setOptions] = useState<string[]>(initial?.options ?? ["", ""]);
  const [correct, setCorrect] = useState<number[]>(initial?.correctOptions ?? []);
  const [imageUrls, setImageUrls] = useState<string[]>(initial?.imageUrls ?? []);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = QUESTION_TYPE_META[type];

  function changeType(next: QuestionType) {
    setType(next);
    // Single-answer types may keep at most one correct option.
    if (!QUESTION_TYPE_META[next].multi && correct.length > 1) setCorrect(correct.slice(0, 1));
  }

  function toggleCorrect(i: number) {
    if (meta.multi) {
      setCorrect((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i].sort((a, b) => a - b)));
    } else {
      setCorrect([i]);
    }
  }

  function setOption(i: number, val: string) {
    setOptions((o) => o.map((x, j) => (j === i ? val : x)));
  }

  function removeOption(i: number) {
    setOptions((o) => o.filter((_, j) => j !== i));
    setCorrect((c) => c.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)));
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadImage(file);
      setImageUrls((u) => [...u, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить изображение");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function validate(): string | null {
    if (!stem.trim()) return "Укажите текст вопроса";
    if (options.filter((o) => o.trim()).length < 2) return "Нужно как минимум два варианта ответа";
    if (correct.length === 0) return "Отметьте верный ответ";
    if (!meta.multi && correct.length !== 1) return "В вопросах с одним ответом нужно отметить ровно один верный вариант";
    if (meta.image && imageUrls.length === 0) return "Для этого типа вопроса требуется изображение";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    const payload: CreateQuestionInput = {
      type,
      specialty,
      difficulty: difficulty as CreateQuestionInput["difficulty"],
      status: status as CreateQuestionInput["status"],
      stem,
      caseVignette: meta.vignette ? caseVignette : undefined,
      options,
      correctOptions: correct,
      imageUrls,
      explanation: explanation || undefined,
      points: Number(points) || 1,
    };
    try {
      if (initial) await updateQuestion(initial.id, payload);
      else await createQuestion(payload);
      router.push("/questions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-bold">{editing ? "Редактировать вопрос" : "Новый вопрос"}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Классификация</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Тип вопроса</span>
            <select className={fieldClass} value={type} onChange={(e) => changeType(e.target.value as QuestionType)}>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_META[t].ru}
                </option>
              ))}
            </select>
          </label>
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
          <Input name="points" type="number" label="Баллы" value={points} onChange={(e) => setPoints(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Вопрос</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {meta.vignette && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Клиническая ситуация</span>
              <textarea className={`${fieldClass} min-h-[100px]`} value={caseVignette} onChange={(e) => setCaseVignette(e.target.value)} />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Текст вопроса</span>
            <textarea className={`${fieldClass} min-h-[70px]`} value={stem} onChange={(e) => setStem(e.target.value)} required />
          </label>

          {meta.image && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                Изображение{type === "ECG_INTERPRETATION" ? " (ЭКГ)" : type === "RADIOLOGY" ? " (рентген)" : ""}
              </span>
              <div className="flex flex-wrap gap-2">
                {imageUrls.map((u, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(u)} alt={`img ${i + 1}`} className="h-24 rounded border border-slate-200 object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrls((arr) => arr.filter((_, j) => j !== i))}
                      className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-red-600 text-xs text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600">
                {uploading ? <Spinner size={16} /> : "⬆"} Загрузить изображение
                <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
              </label>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Варианты — отметьте {meta.multi ? "верные ответы" : "верный ответ"}
            </span>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={meta.multi ? "checkbox" : "radio"}
                  name="correct"
                  checked={correct.includes(i)}
                  onChange={() => toggleCorrect(i)}
                />
                <input className={fieldClass} placeholder={`Вариант ${i + 1}`} value={opt} onChange={(e) => setOption(i, e.target.value)} />
                {options.length > 2 && (
                  <Button type="button" variant="ghost" onClick={() => removeOption(i)}>
                    ✕
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setOptions((o) => [...o, ""])}>
              + Добавить вариант
            </Button>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Объяснение (показывается после проверки)</span>
            <textarea className={`${fieldClass} min-h-[70px]`} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </label>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="lg" isLoading={saving}>
          {editing ? "Сохранить изменения" : "Создать вопрос"}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => router.push("/questions")}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
