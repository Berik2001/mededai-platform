"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Spinner } from "@med/ui";
import type { ChatMessage } from "@med/shared";
import { getToken, ApiRequestError } from "@/lib/api";
import { tutorChat } from "@/lib/tutor";

const SUGGESTIONS = [
  "С чего мне начать сегодня?",
  "Разбери мою последнюю ошибку",
  "Дай подсказку по слабой теме",
  "Как улучшить клиническое мышление?",
];

export default function TutorPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Привет! Я твой ИИ-наставник. Помогу разобрать ошибки и подтянуть слабые темы — но не буду давать готовые ответы, а буду вести тебя вопросами. С чего начнём?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setError(null);
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setSending(true);
    try {
      const res = await tutorChat(next);
      setMessages((m) => [...m, res.message]);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Не удалось получить ответ наставника");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">ИИ-наставник</h1>
        <p className="text-sm text-slate-500">
          Сократический наставник, который ведёт твоё клиническое мышление вопросами и подсказками.
        </p>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardContent className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] whitespace-pre-wrap rounded-2xl bg-brand-600 px-4 py-2 text-white"
                    : "max-w-[80%] whitespace-pre-wrap rounded-2xl bg-slate-100 px-4 py-2 text-slate-800"
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-4 py-2">
                <Spinner size={18} />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </CardContent>
      </Card>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напиши наставнику… (например: разбери, где я ошибся в диагнозе)"
          className="h-11 flex-1 rounded-lg border border-slate-300 px-3"
          disabled={sending}
        />
        <Button type="submit" isLoading={sending} disabled={!input.trim()}>
          Отправить
        </Button>
      </form>
    </div>
  );
}
