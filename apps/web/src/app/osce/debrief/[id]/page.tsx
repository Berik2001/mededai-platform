"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from "@med/ui";
import type { OsceDebrief, OsceStationDebrief } from "@med/shared";
import { getOsceDebrief } from "@/lib/osce";
import { getToken, ApiRequestError } from "@/lib/api";

function List({ title, items, tone }: { title: string; items: string[]; tone?: "red" }) {
  if (items.length === 0) return null;
  return (
    <div>
      {title && <p className="mb-1 text-sm font-semibold text-slate-700">{title}</p>}
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i} className={`flex gap-2 text-sm ${tone === "red" ? "text-red-700" : "text-slate-600"}`}>
            <span className="text-slate-400">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StationCard({ s }: { s: OsceStationDebrief }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{s.title}</CardTitle>
          <div className="flex items-center gap-2">
            {s.criticalFailed && <Badge tone="red">критическая ошибка</Badge>}
            <Badge tone={s.passed ? "green" : "amber"}>
              {s.score}/{s.maxScore} · {s.percent}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {s.diagnosisCorrect !== null && (
          <Badge tone={s.diagnosisCorrect ? "green" : "red"}>
            {s.diagnosisCorrect ? "Диагноз верный" : "Диагноз неверный"}
          </Badge>
        )}
        {s.expectedDiagnosis && (
          <p className="text-sm">
            <span className="font-medium text-slate-700">Правильный диагноз:</span>{" "}
            <span className="text-slate-600">{s.expectedDiagnosis}</span>
          </p>
        )}
        {s.correctPathway && (
          <p className="text-sm">
            <span className="font-medium text-slate-700">Правильная тактика:</span>{" "}
            <span className="text-slate-600">{s.correctPathway}</span>
          </p>
        )}
        {s.checklistResults.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">Чек-лист</p>
            <ul className="flex flex-col gap-1">
              {s.checklistResults.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className={it.checked ? "text-slate-700" : "text-slate-400"}>
                    {it.checked ? "✅" : "⬜"} {it.label}
                    {it.critical && <span className="ml-1 text-red-500">(критич.)</span>}
                  </span>
                  <span className={it.checked ? "text-emerald-600" : "text-slate-400"}>
                    {it.checked ? `+${it.points}` : `0/${it.points}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <List title="Пропущенные критические действия" items={s.missedCritical} tone="red" />
        <List
          title="Пропущенные шаги"
          items={s.missedItems.filter((m) => !s.missedCritical.includes(m))}
        />
        <List title="Анализ ошибок" items={s.errors} />
        <List title="Рекомендации" items={s.recommendations} />
        {s.examinerComment && (
          <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Экзаменатор:</span> {s.examinerComment}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function OsceDebriefPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [debrief, setDebrief] = useState<OsceDebrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getOsceDebrief(id)
      .then(setDebrief)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить разбор");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (error || !debrief) return <p className="text-slate-500">{error ?? "Разбор недоступен."}</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/osce" className="text-sm text-brand-600 hover:underline">
        ← ОСКЭ
      </Link>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm uppercase tracking-wide text-slate-500">Результат ОСКЭ</p>
          <div className="text-5xl font-bold">{debrief.score}%</div>
          <div className="flex items-center gap-2">
            <Badge tone={debrief.passed ? "green" : "red"}>{debrief.passed ? "СДАНО" : "НЕ СДАНО"}</Badge>
            {debrief.diagnosisCorrect !== null && (
              <Badge tone={debrief.diagnosisCorrect ? "green" : "red"}>
                {debrief.diagnosisCorrect ? "Диагноз верный" : "Диагноз неверный"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {debrief.totalScore}/{debrief.maxScore} баллов
          </p>
          <p className="max-w-xl text-slate-700">{debrief.summary}</p>
        </CardContent>
      </Card>

      {debrief.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Общие рекомендации</CardTitle>
          </CardHeader>
          <CardContent>
            <List title="" items={debrief.recommendations} />
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold">Разбор по станциям</h2>
      <div className="flex flex-col gap-4">
        {debrief.stations.map((s) => (
          <StationCard key={s.stationId} s={s} />
        ))}
      </div>
    </div>
  );
}
