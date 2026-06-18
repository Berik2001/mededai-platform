"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from "@med/ui";
import {
  CLINICAL_SPECIALTY_LABELS,
  type CaseContent,
  type ClinicalCaseFull,
} from "@med/shared";
import { deleteCase, getCase, launchCase } from "@/lib/cases";
import { getToken, ApiRequestError } from "@/lib/api";
import { difficultyLabel, contentStatusLabel, sexLabel } from "@/lib/labels";

export default function CaseDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ClinicalCaseFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getCase(id)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить случай");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function launch() {
    setLaunching(true);
    try {
      const { sessionId } = await launchCase(id);
      router.push(`/virtual-patient/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось запустить");
      setLaunching(false);
    }
  }

  async function onDelete() {
    if (!confirm("Удалить этот случай безвозвратно?")) return;
    try {
      await deleteCase(id);
      router.push("/cases");
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
  if (error && !data) return <p className="text-red-600">{error}</p>;
  if (!data) return null;

  const { meta, content, canEdit } = data;
  const hidden = canEdit ? (content as CaseContent) : null;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/cases" className="text-sm text-brand-600 hover:underline">
        ← Все кейсы
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{CLINICAL_SPECIALTY_LABELS[meta.specialty].ru}</Badge>
            <Badge tone="neutral">{difficultyLabel(meta.difficulty)}</Badge>
            {meta.status !== "PUBLISHED" && <Badge tone="amber">{contentStatusLabel(meta.status)}</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-bold">{meta.title}</h1>
          {meta.summary && <p className="mt-1 text-slate-600">{meta.summary}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          {canEdit && (
            <>
              <Link href={`/cases/${id}/edit`}>
                <Button variant="outline">Редактировать</Button>
              </Link>
              <Button variant="danger" onClick={onDelete}>
                Удалить
              </Button>
            </>
          )}
          <Button onClick={launch} isLoading={launching}>
            ▶ Запустить виртуального пациента
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Пациент и жалоба</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-700">
            <p className="mb-2">
              <span className="font-medium">
                {content.patient.name}, {content.patient.age} лет, {sexLabel(content.patient.sex)}
              </span>
            </p>
            <p className="mb-2">
              <span className="font-medium">Жалоба:</span> {content.initialComplaint}
            </p>
            {content.presentation && <p className="text-slate-600">{content.presentation}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Учебные цели</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {content.learningObjectives.length ? (
              <ul className="ml-4 list-disc text-slate-700">
                {content.learningObjectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400">—</p>
            )}
            {content.references.length > 0 && (
              <div className="mt-3">
                <p className="font-medium text-slate-700">Источники</p>
                <ul className="ml-4 list-disc text-slate-600">
                  {content.references.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Teaching key — only the author/admin sees this */}
      {hidden && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">
              🔒 Ключ для преподавателя (виден только автору/администратору)
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-800 sm:grid-cols-2">
            <div>
              <p className="font-medium">Скрытый диагноз</p>
              <p>{hidden.hiddenDiagnosis}</p>
            </div>
            <div>
              <p className="font-medium">Правильное лечение</p>
              <p>{hidden.correctTreatments.join(", ") || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium">Дифференциальные диагнозы</p>
              <p>{hidden.differentialDiagnoses.join(", ") || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium">Правильный клинический маршрут</p>
              <ol className="ml-4 list-decimal">
                {hidden.clinicalPathway
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((s, i) => (
                    <li key={i}>
                      <span className="font-medium">{s.title}</span>
                      {s.detail ? ` — ${s.detail}` : ""}
                    </li>
                  ))}
              </ol>
            </div>
            <div className="sm:col-span-2">
              <p className="font-medium">Ключевые результаты обследований</p>
              <ul className="ml-4 list-disc">
                {hidden.examFindings.map((f, i) => (
                  <li key={i} className={f.abnormal ? "text-red-700" : ""}>
                    {f.name}: {f.result}
                  </li>
                ))}
              </ul>
            </div>
            {hidden.redFlags.length > 0 && (
              <div className="sm:col-span-2">
                <p className="font-medium">Тревожные признаки</p>
                <p>{hidden.redFlags.join(", ")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
