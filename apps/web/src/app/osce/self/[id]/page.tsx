"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Spinner } from "@med/ui";
import { CLINICAL_SPECIALTY_LABELS, type OsceSelfStation, type OsceSelfView } from "@med/shared";
import {
  chatOsceSelf,
  finishOsceSelfStation,
  getOsceSelf,
  startOsceSelf,
} from "@/lib/osce";
import { fetchProfile } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";

function Countdown({ endsAt, onExpire }: { endsAt: string; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 1000));
  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const over = remaining === 0;
  return (
    <span className={`font-mono text-2xl font-bold ${over ? "text-red-600" : "text-slate-900"}`}>
      {over ? "00:00 ⏱" : `${mm}:${ss}`}
    </span>
  );
}

export default function OsceSelfPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [view, setView] = useState<OsceSelfView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then(async () => {
        const v = await getOsceSelf(id);
        setView(v);
        if (v.completed) router.replace(`/osce/debrief/${id}`);
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else router.replace("/osce");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  const station: OsceSelfStation | undefined =
    view?.stations.find((s) => s.state === "ACTIVE") ??
    (view && view.currentIndex >= 0 ? view.stations[view.currentIndex] : undefined);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [station?.chat.length]);

  const start = async () => {
    setBusy(true);
    try {
      setView(await startOsceSelf(id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось начать экзамен");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = message.trim();
    if (!text || !station || sending) return;
    setSending(true);
    setMessage("");
    try {
      setView(await chatOsceSelf(id, station.stationId, text));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось отправить сообщение");
      setMessage(text);
    } finally {
      setSending(false);
    }
  };

  const finish = useCallback(
    async (auto = false) => {
      if (!station || finishing) return;
      if (!auto && !confirm("Завершить эту станцию? Вернуться к ней будет нельзя.")) return;
      setFinishing(true);
      try {
        const v = await finishOsceSelfStation(id, station.stationId);
        setView(v);
        if (v.completed) router.replace(`/osce/debrief/${id}`);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Не удалось завершить станцию");
      } finally {
        setFinishing(false);
      }
    },
    [id, station, finishing, router],
  );

  const onExpire = useCallback(() => finish(true), [finish]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (!view) return <p className="text-slate-500">Экзамен не найден.</p>;

  const notStarted = view.status === "SCHEDULED" || view.currentIndex < 0;
  const doneCount = view.stations.filter((s) => s.state === "DONE").length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/osce" className="text-sm text-brand-600 hover:underline">
            ← ОСКЭ
          </Link>
          <h1 className="text-xl font-bold">{view.examTitle}</h1>
          <p className="text-sm text-slate-500">
            {CLINICAL_SPECIALTY_LABELS[view.specialty]?.ru ?? view.specialty} · самостоятельный режим
          </p>
        </div>
        <Badge tone="amber">
          станций пройдено: {doneCount}/{view.stationCount}
        </Badge>
      </div>

      {/* Station progress */}
      <div className="flex flex-wrap gap-2">
        {view.stations.map((s, i) => (
          <span
            key={s.stationId}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
              s.state === "ACTIVE"
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : s.state === "DONE"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-500"
            }`}
          >
            <span>{i + 1}</span>
            {s.state === "DONE" && <span>✓</span>}
            {s.state === "ACTIVE" && <span>●</span>}
          </span>
        ))}
      </div>

      {notStarted ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <h2 className="text-lg font-semibold">Готовы начать экзамен?</h2>
            <p className="max-w-md text-sm text-slate-500">
              На каждой станции вы общаетесь с виртуальным пациентом в чате. У станции есть таймер — когда
              он закончится, вы автоматически перейдёте к следующей станции. После последней станции
              появится разбор с баллами.
            </p>
            <Button size="lg" isLoading={busy} onClick={start}>
              Начать экзамен
            </Button>
          </CardContent>
        </Card>
      ) : !station ? (
        <p className="text-slate-500">Активная станция не найдена.</p>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Станция {station.order + 1}: {station.title}
                </h2>
                <Badge tone={station.state === "ACTIVE" ? "amber" : "green"}>
                  {station.state === "ACTIVE" ? "идёт приём" : "станция завершена"}
                </Badge>
              </div>
              {station.state === "ACTIVE" && station.endsAt && (
                <Countdown endsAt={station.endsAt} onExpire={onExpire} />
              )}
            </div>

            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {station.scenario}
            </p>

            {/* AI patient chat */}
            <div
              ref={scrollRef}
              className="flex max-h-[45vh] min-h-[200px] flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3"
            >
              {station.chat.length === 0 ? (
                <p className="m-auto text-center text-sm text-slate-400">
                  Начните приём — поздоровайтесь и соберите анамнез у пациента.
                </p>
              ) : (
                station.chat.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      m.role === "student"
                        ? "ml-auto bg-brand-500 text-white"
                        : "mr-auto bg-slate-100 text-slate-800"
                    }`}
                  >
                    {m.role === "patient" && (
                      <span className="mb-0.5 block text-xs font-medium text-slate-500">Пациент</span>
                    )}
                    {m.content}
                  </div>
                ))
              )}
              {sending && (
                <div className="mr-auto flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
                  <Spinner size={14} /> пациент печатает…
                </div>
              )}
            </div>

            {station.state === "ACTIVE" && (
              <>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    placeholder="Спросите пациента или опишите действие…"
                    value={message}
                    disabled={sending || finishing}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <Button onClick={send} isLoading={sending} disabled={!message.trim()}>
                    Отправить
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" isLoading={finishing} onClick={() => finish(false)}>
                    Завершить станцию →
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
