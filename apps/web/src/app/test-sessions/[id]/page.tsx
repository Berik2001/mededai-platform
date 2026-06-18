"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Spinner } from "@med/ui";
import {
  QUESTION_TYPE_META,
  type PublicQuestion,
  type QuestionResult,
  type TestSessionView,
} from "@med/shared";
import { getSession, mediaUrl, saveAnswers, submitSession } from "@/lib/tests";
import { getToken, ApiRequestError } from "@/lib/api";

type Answers = Record<string, number[]>;

export default function TestRunner() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<TestSessionView | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answersRef = useRef<Answers>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  answersRef.current = answers;

  const submitted = session ? session.status !== "IN_PROGRESS" : false;

  const doSubmit = useCallback(
    async (auto = false) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const result = await submitSession(id, answersRef.current);
        setSession(result);
      } catch (err) {
        if (!auto) setError(err instanceof Error ? err.message : "Не удалось отправить");
      } finally {
        setSubmitting(false);
      }
    },
    [id, submitting],
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getSession(id)
      .then((s) => {
        setSession(s);
        setAnswers(s.answers ?? {});
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить сессию");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  // Countdown timer + auto-submit.
  useEffect(() => {
    if (!session || submitted) return;
    const expires = new Date(session.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.round((expires - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) void doSubmit(true);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [session, submitted, doSubmit]);

  function select(q: PublicQuestion, idx: number) {
    if (submitted) return;
    const multi = QUESTION_TYPE_META[q.type].multi;
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      const next = multi
        ? cur.includes(idx)
          ? cur.filter((i) => i !== idx)
          : [...cur, idx].sort((a, b) => a - b)
        : [idx];
      const updated = { ...prev, [q.id]: next };
      // debounced autosave
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveAnswers(id, updated).catch(() => undefined);
      }, 800);
      return updated;
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (error && !session) return <p className="text-red-600">{error}</p>;
  if (!session) return null;

  if (submitted && session.result) {
    return <Results session={session} />;
  }

  const q = session.questions[current];
  const total = session.questions.length;
  const answeredCount = session.questions.filter((x) => (answers[x.id]?.length ?? 0) > 0).length;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const low = remaining <= 30;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{session.testTitle}</h1>
        <div className={`rounded-lg px-3 py-1 font-mono text-lg ${low ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
          ⏱ {mm}:{ss}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>
            Вопрос {current + 1} / {total}
          </span>
          <span>
            Отвечено: {answeredCount} / {total}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
      </div>

      {/* Question palette */}
      <div className="flex flex-wrap gap-1">
        {session.questions.map((x, i) => {
          const done = (answers[x.id]?.length ?? 0) > 0;
          return (
            <button
              key={x.id}
              onClick={() => setCurrent(i)}
              className={`h-8 w-8 rounded text-sm ${
                i === current
                  ? "bg-brand-600 text-white"
                  : done
                    ? "bg-brand-100 text-brand-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <QuestionCard q={q} selected={answers[q.id] ?? []} onSelect={(i) => select(q, i)} />

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          ← Назад
        </Button>
        {current < total - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)}>Далее →</Button>
        ) : (
          <Button variant="danger" onClick={() => doSubmit(false)} isLoading={submitting}>
            Отправить тест
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ─── Question rendering ───

function QuestionCard({
  q,
  selected,
  onSelect,
  disabled,
  result,
}: {
  q: PublicQuestion;
  selected: number[];
  onSelect?: (idx: number) => void;
  disabled?: boolean;
  result?: QuestionResult;
}) {
  const meta = QUESTION_TYPE_META[q.type];
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center gap-2">
          <Badge tone="brand">{meta.ru}</Badge>
          <span className="text-xs text-slate-400">{q.points} балл.</span>
        </div>

        {meta.vignette && q.caseVignette && (
          <div className="rounded-lg border-l-4 border-brand-400 bg-slate-50 p-3 text-sm text-slate-700">
            {q.caseVignette}
          </div>
        )}

        <p className="font-medium text-slate-900">{q.stem}</p>

        {meta.image && q.imageUrls.length > 0 && <ImageViewer urls={q.imageUrls} />}

        <div className="flex flex-col gap-2">
          {q.options.map((opt, i) => {
            const isSel = selected.includes(i);
            const isCorrect = result?.correctOptions.includes(i);
            const wrongPick = result && isSel && !isCorrect;
            let cls = "border-slate-300";
            if (result) {
              if (isCorrect) cls = "border-emerald-500 bg-emerald-50";
              else if (wrongPick) cls = "border-red-500 bg-red-50";
            } else if (isSel) {
              cls = "border-brand-500 bg-brand-50";
            }
            return (
              <label
                key={i}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${cls} ${
                  disabled ? "cursor-default" : ""
                }`}
              >
                <input
                  type={meta.multi ? "checkbox" : "radio"}
                  name={q.id}
                  checked={isSel}
                  disabled={disabled}
                  onChange={() => onSelect?.(i)}
                />
                <span>{opt}</span>
                {result && isCorrect && <span className="ml-auto text-emerald-600">✓</span>}
                {wrongPick && <span className="ml-auto text-red-600">✗</span>}
              </label>
            );
          })}
        </div>

        {result?.explanation && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-medium">Объяснение: </span>
            {result.explanation}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImageViewer({ urls }: { urls: string[] }) {
  const [zoom, setZoom] = useState<string | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <button key={i} type="button" onClick={() => setZoom(mediaUrl(u))} className="overflow-hidden rounded-lg border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(u)} alt={`figure ${i + 1}`} className="max-h-64 object-contain" />
          </button>
        ))}
      </div>
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="enlarged" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </>
  );
}

// ─── Results ───

function Results({ session }: { session: TestSessionView }) {
  const r = session.result!;
  const byId = new Map(r.questions.map((x) => [x.questionId, x]));
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm uppercase tracking-wide text-slate-500">{session.testTitle}</p>
          <p className="text-5xl font-bold">{r.percent}%</p>
          <p className="text-slate-600">
            {r.score} / {r.maxScore} баллов
          </p>
          <Badge tone={r.passed ? "green" : "red"}>
            {r.passed ? "СДАН" : "НЕ СДАН"} · проходной балл {r.passingScore}%
          </Badge>
          {session.status === "EXPIRED" && (
            <p className="text-sm text-amber-600">⏱ Отправлено после истечения времени.</p>
          )}
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold">Разбор</h2>
      {session.questions.map((q) => (
        <QuestionCard key={q.id} q={q} selected={byId.get(q.id)?.selected ?? []} disabled result={byId.get(q.id)} />
      ))}

      <div className="flex gap-2">
        <Link href="/tests">
          <Button>К тестам</Button>
        </Link>
        <Link href="/test-sessions">
          <Button variant="outline">Мои результаты</Button>
        </Link>
      </div>
    </div>
  );
}
