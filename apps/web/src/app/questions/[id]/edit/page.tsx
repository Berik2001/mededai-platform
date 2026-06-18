"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@med/ui";
import type { Question } from "@med/shared";
import { getQuestion } from "@/lib/tests";
import { getToken, ApiRequestError } from "@/lib/api";
import QuestionForm from "../../QuestionForm";

export default function EditQuestionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [q, setQ] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getQuestion(id)
      .then(setQ)
      .catch((err) => {
        if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403))
          router.replace("/tests");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить вопрос");
      });
  }, [id, router]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!q) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  return <QuestionForm initial={q} />;
}
