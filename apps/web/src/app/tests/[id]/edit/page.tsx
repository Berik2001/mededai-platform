"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@med/ui";
import type { TestDetail } from "@med/shared";
import { getTest } from "@/lib/tests";
import { getToken, ApiRequestError } from "@/lib/api";
import TestForm from "../../TestForm";

export default function EditTestPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [test, setTest] = useState<TestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getTest(id)
      .then((t) => {
        // Only the author/admin receives a TestDetail (with questionIds).
        if (!("questionIds" in t)) {
          router.replace(`/tests/${id}`);
          return;
        }
        setTest(t);
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить тест");
      });
  }, [id, router]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!test) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  return <TestForm initial={test} />;
}
