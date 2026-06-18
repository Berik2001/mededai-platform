"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@med/ui";
import {
  CLINICAL_SPECIALTIES,
  CLINICAL_SPECIALTY_LABELS,
  type CaseContent,
  type CaseExamFinding,
  type ClinicalCaseFull,
  type ClinicalPathwayStep,
  type ClinicalSpecialty,
  type CreateClinicalCaseInput,
} from "@med/shared";
import { createCase, updateCase } from "@/lib/cases";
import { difficultyLabel, contentStatusLabel, sexLabel } from "@/lib/labels";

const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"];

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const commas = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const toLines = (a?: string[]) => (a ?? []).join("\n");
const toCommas = (a?: string[]) => (a ?? []).join(", ");

const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export default function CaseForm({ initial }: { initial?: ClinicalCaseFull }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const c = initial?.content as CaseContent | undefined;

  const [f, setF] = useState({
    title: initial?.meta.title ?? "",
    specialty: (initial?.meta.specialty ?? "THERAPY") as ClinicalSpecialty,
    difficulty: initial?.meta.difficulty ?? "INTERMEDIATE",
    status: initial?.meta.status ?? "DRAFT",
    summary: initial?.meta.summary ?? "",
    estimatedMinutes: initial?.meta.estimatedMinutes?.toString() ?? "",
    tags: toCommas(initial?.meta.tags),
    patientName: c?.patient.name ?? "",
    patientAge: c?.patient.age?.toString() ?? "",
    patientSex: c?.patient.sex ?? "MALE",
    initialComplaint: c?.initialComplaint ?? "",
    presentation: c?.presentation ?? "",
    fullBackground: c?.fullBackground ?? "",
    hr: c?.initialVitals.heartRate?.toString() ?? "",
    bp: c?.initialVitals.bloodPressure ?? "",
    rr: c?.initialVitals.respiratoryRate?.toString() ?? "",
    temp: c?.initialVitals.temperatureC?.toString() ?? "",
    spo2: c?.initialVitals.oxygenSaturation?.toString() ?? "",
    learningObjectives: toLines(c?.learningObjectives),
    references: toLines(c?.references),
    hiddenDiagnosis: c?.hiddenDiagnosis ?? "",
    diagnosisSynonyms: toCommas(c?.diagnosisSynonyms),
    differentialDiagnoses: toLines(c?.differentialDiagnoses),
    correctTreatments: toCommas(c?.correctTreatments),
    contraindicatedTreatments: toCommas(c?.contraindicatedTreatments),
    redFlags: toLines(c?.redFlags),
  });
  const [pathway, setPathway] = useState<Omit<ClinicalPathwayStep, "order">[]>(
    c?.clinicalPathway?.map((s) => ({ title: s.title, detail: s.detail })) ?? [{ title: "", detail: "" }],
  );
  const [findings, setFindings] = useState<CaseExamFinding[]>(
    c?.examFindings ?? [{ name: "", category: "", result: "", abnormal: false }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function buildPayload(): CreateClinicalCaseInput {
    const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
    const content: CaseContent = {
      patient: { name: f.patientName, age: Number(f.patientAge) || 0, sex: f.patientSex as CaseContent["patient"]["sex"] },
      initialComplaint: f.initialComplaint,
      presentation: f.presentation,
      initialVitals: {
        heartRate: num(f.hr),
        bloodPressure: f.bp || undefined,
        respiratoryRate: num(f.rr),
        temperatureC: num(f.temp),
        oxygenSaturation: num(f.spo2),
      },
      learningObjectives: lines(f.learningObjectives),
      references: lines(f.references),
      fullBackground: f.fullBackground,
      hiddenDiagnosis: f.hiddenDiagnosis,
      diagnosisSynonyms: commas(f.diagnosisSynonyms),
      differentialDiagnoses: lines(f.differentialDiagnoses),
      clinicalPathway: pathway
        .filter((s) => s.title.trim())
        .map((s, i) => ({ order: i + 1, title: s.title, detail: s.detail })),
      examFindings: findings.filter((x) => x.name.trim()),
      correctTreatments: commas(f.correctTreatments),
      contraindicatedTreatments: commas(f.contraindicatedTreatments),
      redFlags: lines(f.redFlags),
    };
    return {
      title: f.title,
      specialty: f.specialty,
      difficulty: f.difficulty as CreateClinicalCaseInput["difficulty"],
      status: f.status as CreateClinicalCaseInput["status"],
      summary: f.summary || undefined,
      estimatedMinutes: f.estimatedMinutes ? Number(f.estimatedMinutes) : undefined,
      tags: commas(f.tags),
      content,
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      const result = initial
        ? await updateCase(initial.meta.id, payload)
        : await createCase(payload);
      router.push(`/cases/${result.meta.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить случай");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{editing ? "Редактировать случай" : "Новый клинический случай"}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Метаданные</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input name="title" label="Название" value={f.title} onChange={set("title")} required />
          <Input name="summary" label="Краткое описание" value={f.summary} onChange={set("summary")} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Специальность</span>
            <select className={fieldClass} value={f.specialty} onChange={set("specialty")}>
              {CLINICAL_SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {CLINICAL_SPECIALTY_LABELS[s].ru}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Сложность</span>
            <select className={fieldClass} value={f.difficulty} onChange={set("difficulty")}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {difficultyLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Статус</span>
            <select className={fieldClass} value={f.status} onChange={set("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {contentStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <Input
            name="estimatedMinutes"
            type="number"
            label="Примерное время (мин)"
            value={f.estimatedMinutes}
            onChange={set("estimatedMinutes")}
          />
          <Input name="tags" label="Теги (через запятую)" value={f.tags} onChange={set("tags")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пациент и презентация (видно студентам)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Input name="patientName" label="Имя пациента" value={f.patientName} onChange={set("patientName")} required />
          <Input name="patientAge" type="number" label="Возраст" value={f.patientAge} onChange={set("patientAge")} required />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Пол</span>
            <select className={fieldClass} value={f.patientSex} onChange={set("patientSex")}>
              <option value="MALE">{sexLabel("MALE")}</option>
              <option value="FEMALE">{sexLabel("FEMALE")}</option>
              <option value="OTHER">{sexLabel("OTHER")}</option>
            </select>
          </label>
          <div className="sm:col-span-3">
            <Input name="initialComplaint" label="Первичная жалоба" value={f.initialComplaint} onChange={set("initialComplaint")} required />
          </div>
          <Textarea label="Презентация (показывается студентам)" value={f.presentation} onChange={set("presentation")} />
          <Textarea
            label="Учебные цели (по одной на строку)"
            value={f.learningObjectives}
            onChange={set("learningObjectives")}
          />
          <Textarea label="Источники (по одному на строку)" value={f.references} onChange={set("references")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Исходные витальные показатели</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Input name="hr" label="ЧСС" value={f.hr} onChange={set("hr")} />
          <Input name="bp" label="АД" value={f.bp} onChange={set("bp")} />
          <Input name="rr" label="ЧДД" value={f.rr} onChange={set("rr")} />
          <Input name="temp" label="Темп. °C" value={f.temp} onChange={set("temp")} />
          <Input name="spo2" label="SpO₂ %" value={f.spo2} onChange={set("spo2")} />
        </CardContent>
      </Card>

      <Card className="border-amber-300">
        <CardHeader>
          <CardTitle className="text-base text-amber-900">🔒 Ключ для преподавателя (скрыт от студентов)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Textarea label="Полный анамнез (определяет личность виртуального пациента)" value={f.fullBackground} onChange={set("fullBackground")} />
          </div>
          <Input name="hiddenDiagnosis" label="Скрытый диагноз" value={f.hiddenDiagnosis} onChange={set("hiddenDiagnosis")} required />
          <Input name="diagnosisSynonyms" label="Синонимы диагноза (через запятую)" value={f.diagnosisSynonyms} onChange={set("diagnosisSynonyms")} />
          <Textarea label="Дифференциальные диагнозы (по одному на строку)" value={f.differentialDiagnoses} onChange={set("differentialDiagnoses")} />
          <Textarea label="Тревожные признаки (по одному на строку)" value={f.redFlags} onChange={set("redFlags")} />
          <Input name="correctTreatments" label="Правильное лечение (через запятую)" value={f.correctTreatments} onChange={set("correctTreatments")} />
          <Input name="contraindicatedTreatments" label="Противопоказано (через запятую)" value={f.contraindicatedTreatments} onChange={set("contraindicatedTreatments")} />
        </CardContent>
      </Card>

      <Card className="border-amber-300">
        <CardHeader>
          <CardTitle className="text-base text-amber-900">Правильный клинический маршрут</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pathway.map((step, i) => (
            <div key={i} className="flex gap-2">
              <span className="mt-2 w-6 text-sm text-slate-400">{i + 1}.</span>
              <input
                className={fieldClass}
                placeholder="Название шага"
                value={step.title}
                onChange={(e) =>
                  setPathway((p) => p.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))
                }
              />
              <input
                className={fieldClass}
                placeholder="Описание"
                value={step.detail}
                onChange={(e) =>
                  setPathway((p) => p.map((s, j) => (j === i ? { ...s, detail: e.target.value } : s)))
                }
              />
              <Button type="button" variant="ghost" onClick={() => setPathway((p) => p.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setPathway((p) => [...p, { title: "", detail: "" }])}>
            + Добавить шаг
          </Button>
        </CardContent>
      </Card>

      <Card className="border-amber-300">
        <CardHeader>
          <CardTitle className="text-base text-amber-900">Результаты обследований (раскрываются при назначении)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {findings.map((fd, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className={`${fieldClass} flex-1`}
                placeholder="Название (напр. ЭКГ)"
                value={fd.name}
                onChange={(e) => setFindings((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className={`${fieldClass} w-32`}
                placeholder="Категория"
                value={fd.category ?? ""}
                onChange={(e) => setFindings((p) => p.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
              />
              <input
                className={`${fieldClass} flex-1`}
                placeholder="Результат"
                value={fd.result}
                onChange={(e) => setFindings((p) => p.map((x, j) => (j === i ? { ...x, result: e.target.value } : x)))}
              />
              <label className="flex items-center gap-1 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={fd.abnormal}
                  onChange={(e) => setFindings((p) => p.map((x, j) => (j === i ? { ...x, abnormal: e.target.checked } : x)))}
                />
                отклонение
              </label>
              <Button type="button" variant="ghost" onClick={() => setFindings((p) => p.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setFindings((p) => [...p, { name: "", category: "", result: "", abnormal: false }])}
          >
            + Добавить результат
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" isLoading={saving} size="lg">
          {editing ? "Сохранить изменения" : "Создать случай"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <textarea className={`${fieldClass} min-h-[80px]`} value={value} onChange={onChange} />
    </label>
  );
}
