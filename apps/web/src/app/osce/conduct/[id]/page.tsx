"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Spinner } from "@med/ui";
import type { OsceSessionView, OsceStationScoreView } from "@med/shared";
import {
  aiGradeOsceStation,
  checkOsceStation,
  completeOsceSession,
  endOsceStation,
  getOsceSession,
  startOsceStation,
} from "@/lib/osce";
import { fetchProfile } from "@/lib/auth";
import { getToken } from "@/lib/api";

function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const over = remaining === 0;
  return (
    <span className={`font-mono text-lg font-bold ${over ? "text-red-600" : "text-slate-900"}`}>
      {over ? "00:00 ⏱" : `${mm}:${ss}`}
    </span>
  );
}

export default function OsceConductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [session, setSession] = useState<OsceSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [aiTranscript, setAiTranscript] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then(async (u) => {
        if (u.role === "STUDENT") {
          router.replace(`/osce/exam/${id}`);
          return;
        }
        const s = await getOsceSession(id);
        setSession(s);
        const activeIdx = s.stations.findIndex((st) => st.state === "ACTIVE");
        setActive(activeIdx >= 0 ? activeIdx : 0);
      })
      .catch(() => router.replace("/osce"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const station: OsceStationScoreView | undefined = session?.stations[active];

  useEffect(() => {
    setComment(station?.examinerComment ?? "");
  }, [station?.stationId, station?.examinerComment]);

  const overall = useMemo(() => {
    if (!session) return { score: 0, max: 0 };
    return { score: session.totalScore, max: session.maxScore };
  }, [session]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (!session || !station) return <p className="text-slate-500">Сессия не найдена.</p>;

  const closed = session.status === "COMPLETED" || session.status === "CANCELLED";

  async function act(fn: () => Promise<OsceSessionView>) {
    setBusy(true);
    try {
      setSession(await fn());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось выполнить действие");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (checklistItemId: string, checked: boolean) =>
    act(() => checkOsceStation(id, station.stationId, { items: [{ checklistItemId, checked }] }));

  const saveComment = () =>
    act(() => checkOsceStation(id, station.stationId, { items: [], examinerComment: comment }));

  const aiGrade = () => {
    const t = aiTranscript.trim();
    if (!t) return;
    act(async () => {
      const s = await aiGradeOsceStation(id, station.stationId, t);
      setAiTranscript("");
      return s;
    });
  };

  async function complete() {
    if (!confirm("Завершить экзамен и сформировать разбор?")) return;
    setBusy(true);
    try {
      await completeOsceSession(id);
      router.push(`/osce/debrief/${id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось завершить");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/osce" className="text-sm text-brand-600 hover:underline">
            ← ОСКЭ
          </Link>
          <h1 className="text-xl font-bold">{session.examTitle}</h1>
          <p className="text-sm text-slate-500">
            Студент: {session.studentName} · {session.status.replace("_", " ").toLowerCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Текущий балл</p>
          <p className="text-2xl font-bold">
            {overall.score}
            <span className="text-base font-normal text-slate-400">/{overall.max}</span>
          </p>
        </div>
      </div>

      {/* Station tabs */}
      <div className="flex flex-wrap gap-2">
        {session.stations.map((s, i) => (
          <button
            key={s.stationId}
            onClick={() => setActive(i)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
              i === active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600"
            }`}
          >
            <span>{i + 1}</span>
            {s.state === "DONE" && <span className="text-emerald-600">✓</span>}
            {s.state === "ACTIVE" && <span className="text-amber-600">●</span>}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Станция {station.order + 1}: {station.title}
              </h2>
              <Badge
                tone={station.state === "DONE" ? "green" : station.state === "ACTIVE" ? "amber" : "neutral"}
              >
                {station.state.toLowerCase()}
              </Badge>
            </div>
            <div className="flex flex-col items-end gap-2">
              {station.state === "ACTIVE" && station.endsAt && <Countdown endsAt={station.endsAt} />}
              {!closed && station.state === "PENDING" && (
                <Button size="sm" isLoading={busy} onClick={() => act(() => startOsceStation(id, station.stationId))}>
                  Начать станцию
                </Button>
              )}
              {!closed && station.state === "ACTIVE" && (
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={busy}
                  onClick={() => act(() => endOsceStation(id, station.stationId))}
                >
                  Завершить станцию
                </Button>
              )}
            </div>
          </div>

          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{station.scenario}</p>

          {/* Hidden examiner ground-truth */}
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {station.expectedDiagnosis && (
              <p>
                <span className="font-medium text-slate-700">Ожидаемый диагноз:</span> {station.expectedDiagnosis}
              </p>
            )}
            {station.examinerBrief && (
              <p>
                <span className="font-medium text-slate-700">Инструктаж экзаменатора:</span> {station.examinerBrief}
              </p>
            )}
            {station.correctPathway && (
              <p className="sm:col-span-2">
                <span className="font-medium text-slate-700">Тактика:</span> {station.correctPathway}
              </p>
            )}
          </div>

          {/* Checklist */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-700">Чек-лист</p>
              <span className="text-sm text-slate-500">
                {station.score}/{station.maxScore} баллов
                {station.criticalFailed && <span className="ml-2 text-red-600">пропущен критический пункт</span>}
              </span>
            </div>
            {station.checklist.map((c) => (
              <label
                key={c.checklistItemId}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  disabled={closed || busy}
                  checked={c.checked}
                  onChange={(e) => toggle(c.checklistItemId, e.target.checked)}
                />
                <span className="flex-1">{c.label}</span>
                {c.critical && <Badge tone="red">критический</Badge>}
                <span className="text-xs text-slate-400">{c.points} балл.</span>
              </label>
            ))}
          </div>

          {/* AI auto-grading */}
          {!closed && station.state === "ACTIVE" && (
            <div className="flex flex-col gap-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3 text-sm">
              <span className="font-medium text-brand-700">🤖 ИИ-оценка станции</span>
              <p className="text-xs text-slate-500">
                Опишите, что студент сделал и сказал на станции — ИИ сам отметит чек-лист.
              </p>
              <textarea
                className="min-h-[70px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                placeholder="Напр.: представился, собрал анамнез по SOCRATES, уточнил иррадиацию и красные флаги, измерил АД…"
                value={aiTranscript}
                disabled={busy}
                onChange={(e) => setAiTranscript(e.target.value)}
              />
              <div className="flex justify-end">
                <Button size="sm" isLoading={busy} disabled={!aiTranscript.trim()} onClick={aiGrade}>
                  Оценить через ИИ
                </Button>
              </div>
            </div>
          )}

          {/* Examiner comment */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Комментарий экзаменатора</span>
            <textarea
              className="min-h-[60px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              value={comment}
              disabled={closed}
              onChange={(e) => setComment(e.target.value)}
              onBlur={saveComment}
            />
          </label>
        </CardContent>
      </Card>

      {!closed && (
        <div className="flex justify-end">
          <Button size="lg" isLoading={busy} onClick={complete}>
            Завершить экзамен и разбор
          </Button>
        </div>
      )}
      {closed && (
        <div className="flex justify-end">
          <Link href={`/osce/debrief/${id}`}>
            <Button size="lg" variant="outline">
              Открыть разбор →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
