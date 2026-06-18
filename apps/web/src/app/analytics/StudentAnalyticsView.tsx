"use client";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@med/ui";
import type {
  AiRecommendation,
  RecommendationPriority,
  SpeedRating,
  StudentAnalytics,
} from "@med/shared";
import { ErrorsBarChart, ProgressLineChart, SpecialtyChart } from "./charts";

const speedLabel: Record<SpeedRating, string> = {
  FAST: "Быстрая",
  MODERATE: "Умеренная",
  DELIBERATE: "Обдуманная",
  UNKNOWN: "—",
};

const priorityTone: Record<RecommendationPriority, "red" | "amber" | "neutral"> = {
  HIGH: "red",
  MEDIUM: "amber",
  LOW: "neutral",
};

const priorityLabel: Record<RecommendationPriority, string> = {
  HIGH: "высокий",
  MEDIUM: "средний",
  LOW: "низкий",
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function trendBadge(trend: StudentAnalytics["progress"]["trend"]) {
  const map = {
    IMPROVING: { tone: "green" as const, text: "↑ рост" },
    DECLINING: { tone: "red" as const, text: "↓ спад" },
    STEADY: { tone: "neutral" as const, text: "→ стабильно" },
    UNKNOWN: { tone: "neutral" as const, text: "—" },
  };
  return map[trend];
}

export default function StudentAnalyticsView({ a }: { a: StudentAnalytics }) {
  if (!a.hasData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-lg font-semibold text-slate-700">Аналитики пока нет</p>
          <p className="max-w-md text-sm text-slate-500">{a.aiSummary}</p>
        </CardContent>
      </Card>
    );
  }

  const tb = trendBadge(a.progress.trend);

  return (
    <div className="flex flex-col gap-6">
      {/* AI insight block */}
      <Card className="border-brand-200 bg-brand-50/40">
        <CardContent className="flex flex-col gap-4 py-4">
          {/* Header: title + AI badge + overall score / level progress */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-brand-700">Персональный разбор ИИ</span>
              <Badge tone={a.aiGenerated ? "brand" : "neutral"}>{a.aiGenerated ? "Gemini" : "эвристика"}</Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">Общий балл</p>
                <p className="text-xl font-bold text-brand-700">{a.insights.overallScore}/100</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-500">Прогресс уровня</p>
                <p className="text-sm font-medium text-slate-700">{a.insights.levelProgress}</p>
              </div>
            </div>
          </div>

          {/* Level progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.max(4, Math.min(100, a.insights.overallScore))}%` }}
            />
          </div>

          {/* Overall summary */}
          <p className="text-sm text-slate-700">{a.insights.summary}</p>

          {/* Strengths + growth zones */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="mb-2 text-sm font-semibold text-emerald-700">💪 Сильные стороны</p>
              {a.insights.strengths.length === 0 ? (
                <p className="text-sm text-slate-500">Пока не выявлены.</p>
              ) : (
                <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-slate-700">
                  {a.insights.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p className="mb-2 text-sm font-semibold text-amber-700">🎯 Зоны роста</p>
              {a.insights.growthZones.length === 0 ? (
                <p className="text-sm text-slate-500">Явных слабых мест нет.</p>
              ) : (
                <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-slate-700">
                  {a.insights.growthZones.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Weekly plan */}
          <div className="rounded-lg border border-brand-200 bg-white p-3">
            <p className="mb-2 text-sm font-semibold text-brand-700">📅 План на эту неделю</p>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-slate-700">
              {a.insights.weeklyPlan.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>

          {/* Motivational insight */}
          {a.insights.insight && (
            <div className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white">
              💡 {a.insights.insight}
            </div>
          )}

          {a.focusAreas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {a.focusAreas.map((f, i) => (
                <Badge key={i} tone="amber">
                  {f}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Уровень освоения" value={`${a.progress.masteryScore}/100`} sub={tb.text} />
        <Stat label="Точность диагностики" value={`${a.diagnosticAccuracy}%`} />
        <Stat label="Общая точность" value={`${a.overallAccuracy}%`} sub="вопросы тестов" />
        <Stat
          label="Скорость принятия решений"
          value={speedLabel[a.decisionSpeed.rating]}
          sub={a.decisionSpeed.avgSecondsPerQuestion != null ? `${a.decisionSpeed.avgSecondsPerQuestion} с / вопрос` : undefined}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Прогресс со временем</CardTitle>
          </CardHeader>
          <CardContent>
            {a.progress.activityTimeline.length >= 2 ? (
              <ProgressLineChart data={a.progress.activityTimeline} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">Недостаточно активности для построения тренда.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Точность по специальностям</CardTitle>
          </CardHeader>
          <CardContent>
            {a.accuracyBySpecialty.length > 0 ? (
              <SpecialtyChart data={a.accuracyBySpecialty} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">Данных по специальностям пока нет.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Errors + weak topics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Ошибки по категориям</CardTitle>
          </CardHeader>
          <CardContent>
            {a.errorsByCategory.length > 0 ? (
              <ErrorsBarChart data={a.errorsByCategory} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">Ошибок не зафиксировано. 🎉</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Слабые темы</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 py-3">
            {a.weakTopics.length === 0 && <p className="text-sm text-slate-400">Слабых мест не выявлено.</p>}
            {a.weakTopics.map((w) => (
              <div key={w.specialty}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{w.label}</span>
                  <span className="text-slate-500">
                    {w.accuracy}% · {w.attempts} акт.
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${w.accuracy < 50 ? "bg-red-500" : w.accuracy < 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.max(4, w.accuracy)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Персональные рекомендации</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 py-3">
          {a.recommendations.length === 0 && <p className="text-sm text-slate-400">Рекомендаций нет.</p>}
          {a.recommendations.map((r: AiRecommendation, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Badge tone={priorityTone[r.priority]}>{priorityLabel[r.priority]}</Badge>
                <span className="font-medium text-slate-800">{r.title}</span>
              </div>
              <p className="text-sm text-slate-600">{r.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
