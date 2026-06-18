"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@med/ui";
import type { ClinicalCaseFull } from "@med/shared";
import { getCase } from "@/lib/cases";
import { getToken, ApiRequestError } from "@/lib/api";
import CaseForm from "../../CaseForm";

export default function EditCasePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ClinicalCaseFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getCase(id)
      .then((full) => {
        if (!full.canEdit) {
          router.replace(`/cases/${id}`);
          return;
        }
        setData(full);
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить случай");
      });
  }, [id, router]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  return <CaseForm initial={data} />;
}
