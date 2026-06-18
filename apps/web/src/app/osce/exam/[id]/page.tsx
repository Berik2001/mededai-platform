"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Spinner } from "@med/ui";
import { CLINICAL_SPECIALTY_LABELS, type OsceLiveView } from "@med/shared";
import { getOsceLive } from "@/lib/osce";
import { getToken, ApiRequestError } from "@/lib/api";

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
    <div className={`font-mono text-5xl font-bold ${over ? "text-red-600" : "text-slate-900"}`}>
      {over ? "00:00" : `${mm}:${ss}`}
    </div>
  );
}

export default function OsceLivePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [live, setLive] = useState<OsceLiveView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const l = await getOsceLive(id);
        if (!cancelled) setLive(l);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    poll();
    const t = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (!live) return <p className="text-slate-500">Экзамен не найден.</p>;

  if (live.completed) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Экзамен завершён</h1>
        <p className="text-slate-500">Экзаменатор завершил оценивание этого ОСКЭ.</p>
        <Link href={`/osce/debrief/${id}`}>
          <Button size="lg">Открыть разбор →</Button>
        </Link>
      </div>
    );
  }

  const s = live.currentStation;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{live.examTitle}</h1>
          <p className="text-sm text-slate-500">
            {CLINICAL_SPECIALTY_LABELS[live.specialty]?.ru ?? live.specialty}
            {live.currentIndex >= 0 && ` · Станция ${live.currentIndex + 1} из ${live.stationCount}`}
          </p>
        </div>
        <Badge tone={live.status === "IN_PROGRESS" ? "amber" : "neutral"}>
          {live.status.replace("_", " ").toLowerCase()}
        </Badge>
      </div>

      {!s || s.state === "PENDING" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Spinner size={28} />
            <p className="font-medium text-slate-700">Ожидание, пока экзаменатор начнёт следующую станцию…</p>
            <p className="text-sm text-slate-500">Экран обновится автоматически.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-5 py-8 text-center">
            <h2 className="text-lg font-semibold">
              Станция {s.order + 1}: {s.title}
            </h2>
            {s.state === "ACTIVE" && s.endsAt ? (
              <Countdown endsAt={s.endsAt} />
            ) : (
              <Badge tone="green">станция завершена</Badge>
            )}
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-left text-slate-800">
              {s.scenario}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
