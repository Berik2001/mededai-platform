"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from "@med/ui";
import type { VirtualPatientSessionView, VPCondition, VPMessage, VPStability } from "@med/shared";
import {
  finalizeSession,
  getSession,
  orderExam,
  streamMessage,
  streamTreatment,
  submitDiagnosis,
} from "@/lib/virtualPatient";
import { getToken, ApiRequestError } from "@/lib/api";
import { difficultyLabel, specialtyLabel, stabilityLabel, sexLabel } from "@/lib/labels";

const stabilityTone: Record<VPStability, "green" | "amber" | "red"> = {
  STABLE: "green",
  IMPROVING: "green",
  DETERIORATING: "amber",
  CRITICAL: "red",
};

function bubbleClasses(m: VPMessage): string {
  if (m.role === "student") return "ml-auto bg-brand-600 text-white";
  if (m.role === "patient") return "mr-auto bg-white border border-slate-200 text-slate-900";
  return "mx-auto bg-slate-100 text-slate-600 text-sm italic"; // narrator
}

export default function VirtualPatientRoom() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<VirtualPatientSessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // action inputs
  const [examName, setExamName] = useState("");
  const [txName, setTxName] = useState("");
  const [txDose, setTxDose] = useState("");
  const [dxValue, setDxValue] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getSession(id)
      .then(setSession)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить сессию");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session?.messages.length, streamText]);

  const active = session?.status === "ACTIVE";

  function pushLocal(message: VPMessage) {
    setSession((s) => (s ? { ...s, messages: [...s.messages, message] } : s));
  }

  async function refresh(condition?: VPCondition) {
    try {
      const fresh = await getSession(id);
      setSession(fresh);
    } catch {
      if (condition) setSession((s) => (s ? { ...s, condition } : s));
    }
  }

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setInput("");
    pushLocal({ role: "student", kind: "chat", content, createdAt: new Date().toISOString() });
    setStreaming(true);
    setStreamText("");
    await streamMessage(id, content, {
      onDelta: (t) => setStreamText((prev) => prev + t),
      onDone: async () => {
        setStreaming(false);
        setStreamText("");
        await refresh();
      },
      onError: (msg) => {
        setStreaming(false);
        setStreamText("");
        pushLocal({
          role: "narrator",
          kind: "chat",
          content: `⚠️ ${msg}`,
          createdAt: new Date().toISOString(),
        });
      },
    });
  }

  async function prescribe() {
    const name = txName.trim();
    if (!name || streaming) return;
    setTxName("");
    const dosage = txDose.trim() || undefined;
    setTxDose("");
    pushLocal({
      role: "narrator",
      kind: "treatment",
      content: `💊 Назначение ${name}${dosage ? ` (${dosage})` : ""}…`,
      createdAt: new Date().toISOString(),
    });
    setStreaming(true);
    setStreamText("");
    await streamTreatment(id, { name, dosage }, {
      onDelta: (t) => setStreamText((prev) => prev + t),
      onDone: async () => {
        setStreaming(false);
        setStreamText("");
        await refresh();
      },
      onError: (msg) => {
        setStreaming(false);
        setStreamText("");
        pushLocal({ role: "narrator", kind: "treatment", content: `⚠️ ${msg}`, createdAt: new Date().toISOString() });
      },
    });
  }

  async function exam() {
    const name = examName.trim();
    if (!name) return;
    // A real investigation has letters — reject stray numbers so they don't
    // create bogus "no abnormality" entries in the transcript.
    if (name.length < 2 || !/\p{L}/u.test(name)) {
      setError("Укажите название обследования словами (например: ЭКГ, рентген, ОАК), а не число.");
      return;
    }
    setError(null);
    setExamName("");
    setBusy("exam");
    try {
      const { session: s } = await orderExam(id, name);
      setSession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось назначить обследование");
    } finally {
      setBusy(null);
    }
  }

  async function diagnose() {
    const value = dxValue.trim();
    if (!value) return;
    setBusy("dx");
    try {
      const { session: s } = await submitDiagnosis(id, value);
      setSession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить диагноз");
    } finally {
      setBusy(null);
    }
  }

  async function finalize() {
    setBusy("finalize");
    try {
      const { session: s } = await finalizeSession(id);
      setSession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось завершить приём");
    } finally {
      setBusy(null);
    }
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

  const { scenario, condition } = session;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/virtual-patient" className="text-sm text-brand-600 hover:underline">
← Все приёмы
          </Link>
          <h1 className="text-xl font-bold">{scenario.title}</h1>
          <p className="text-sm text-slate-500">
            {scenario.patient.name}, {scenario.patient.age} лет, {sexLabel(scenario.patient.sex)} ·{" "}
            {specialtyLabel(scenario.specialty)} · {difficultyLabel(scenario.difficulty)}
          </p>
        </div>
        <Badge tone={stabilityTone[condition.stability]}>{stabilityLabel(condition.stability)}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Transcript + composer */}
        <Card className="flex h-[60vh] flex-col">
          <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {session.messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${bubbleClasses(m)}`}
              >
                {m.content}
              </div>
            ))}
            {streaming && (
              <div className="mr-auto max-w-[80%] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-900">
                {streamText || <span className="text-slate-400">…</span>}
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t border-slate-200 p-3">
            <input
              className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              placeholder={active ? "Спросите пациента… (например: Когда началась боль?)" : "Приём завершён"}
              value={input}
              disabled={!active || streaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Button onClick={send} disabled={!active} isLoading={streaming}>
              Отправить
            </Button>
          </div>
        </Card>

        {/* Side panel: condition + actions */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Состояние пациента</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="mb-2 text-slate-600">{condition.narrative}</p>
              <dl className="grid grid-cols-2 gap-1 text-slate-700">
                <Vital label="ЧСС" value={condition.vitals.heartRate && `${condition.vitals.heartRate} уд/мин`} />
                <Vital label="АД" value={condition.vitals.bloodPressure} />
                <Vital label="ЧДД" value={condition.vitals.respiratoryRate} />
                <Vital label="Темп." value={condition.vitals.temperatureC && `${condition.vitals.temperatureC}°C`} />
                <Vital label="SpO₂" value={condition.vitals.oxygenSaturation && `${condition.vitals.oxygenSaturation}%`} />
              </dl>
            </CardContent>
          </Card>

          {active ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Клинические действия</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-700">Назначить обследование</span>
                  <div className="flex gap-2">
                    <Input
                      name="exam"
                      placeholder="например: ЭКГ, тропонин"
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && exam()}
                    />
                    <Button variant="outline" onClick={exam} isLoading={busy === "exam"}>
                      Назначить
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-700">Назначить лечение</span>
                  <Input name="tx" placeholder="Препарат / вмешательство" value={txName} onChange={(e) => setTxName(e.target.value)} />
                  <div className="flex gap-2">
                    <Input name="dose" placeholder="Дозировка (необязательно)" value={txDose} onChange={(e) => setTxDose(e.target.value)} />
                    <Button variant="outline" onClick={prescribe} disabled={streaming}>
                      Назначить
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-700">Поставить диагноз</span>
                  <div className="flex gap-2">
                    <Input
                      name="dx"
                      placeholder="Ваш диагноз"
                      value={dxValue}
                      onChange={(e) => setDxValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && diagnose()}
                    />
                    <Button variant="outline" onClick={diagnose} isLoading={busy === "dx"}>
                      Отправить
                    </Button>
                  </div>
                  {session.diagnosis && (
                    <p className={`mt-1 text-xs ${session.diagnosis.correct ? "text-emerald-600" : "text-amber-600"}`}>
                      {session.diagnosis.feedback}
                    </p>
                  )}
                </div>

                <Button variant="danger" onClick={finalize} isLoading={busy === "finalize"}>
                  Завершить приём
                </Button>
              </CardContent>
            </Card>
          ) : (
            session.debrief && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Разбор · {session.debrief.score}/100</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <p className="text-slate-700">{session.debrief.summary}</p>
                  <p>
                    <span className="font-medium">Правильный диагноз:</span>{" "}
                    {session.debrief.correctDiagnosis}
                  </p>
                  <p>
                    <span className="font-medium">Рекомендовано:</span>{" "}
                    {session.debrief.recommendedTreatments.join(", ") || "—"}
                  </p>
                  {session.debrief.whatWentWell.length > 0 && (
                    <div>
                      <span className="font-medium text-emerald-700">Что прошло хорошо</span>
                      <ul className="ml-4 list-disc text-slate-600">
                        {session.debrief.whatWentWell.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {session.debrief.missedRedFlags.length > 0 && (
                    <div>
                      <span className="font-medium text-amber-700">Пропущенные тревожные признаки</span>
                      <ul className="ml-4 list-disc text-slate-600">
                        {session.debrief.missedRedFlags.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          )}

          {session.orderedExams.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Исследования</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {session.orderedExams.map((e, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <span className="font-medium text-slate-700">{e.name}</span>
                    <span className={e.abnormal ? "text-right text-red-600" : "text-right text-slate-500"}>
                      {e.result}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Vital({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </>
  );
}
