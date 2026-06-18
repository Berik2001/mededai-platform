"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, Spinner } from "@med/ui";
import {
  CLINICAL_SPECIALTY_LABELS,
  type CaseStatus,
  type ClinicalSpecialty,
  type ModerationItem,
} from "@med/shared";
import { adminModerate, adminModerationQueue } from "@/lib/admin";

const fieldClass = "h-9 rounded-lg border border-slate-300 px-2 text-sm";

const statusTone: Record<CaseStatus, "amber" | "green" | "neutral"> = {
  DRAFT: "amber",
  PUBLISHED: "green",
  ARCHIVED: "neutral",
};

function specialtyLabel(s: string): string {
  return CLINICAL_SPECIALTY_LABELS[s as ClinicalSpecialty]?.ru ?? s;
}

export default function ModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("DRAFT");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        await adminModerationQueue({
          type: type as "CASE" | "TEST" | "ALL",
          status: statusFilter as CaseStatus,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [type, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(item: ModerationItem, decision: "APPROVE" | "REJECT" | "UNPUBLISH") {
    setBusy(item.id);
    try {
      await adminModerate(item.type, item.id, decision);
      // Remove from view if it no longer matches the current status filter.
      setItems((list) => list.filter((x) => x.id !== item.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось выполнить действие");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Модерация контента</h1>
          <p className="text-sm text-slate-500">Одобряйте, отклоняйте или снимайте с публикации случаи и тесты.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className={fieldClass} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ALL">Все типы</option>
            <option value="CASE">Случаи</option>
            <option value="TEST">Тесты</option>
          </select>
          <select className={fieldClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="DRAFT">На рассмотрении (черновик)</option>
            <option value="PUBLISHED">Опубликованы</option>
            <option value="ARCHIVED">В архиве</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={28} />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-slate-400">Здесь нечего модерировать. 🎉</CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Card key={`${item.type}-${item.id}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={item.type === "CASE" ? "brand" : "neutral"}>{item.type === "CASE" ? "Случай" : "Тест"}</Badge>
                    <span className="font-medium text-slate-800">{item.title}</span>
                    <Badge tone={statusTone[item.status]}>
                      {item.status === "DRAFT" ? "черновик" : item.status === "PUBLISHED" ? "опубликован" : "в архиве"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {specialtyLabel(item.specialty)}
                    {item.authorName && ` · автор ${item.authorName}`} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.status !== "PUBLISHED" && (
                    <Button size="sm" isLoading={busy === item.id} onClick={() => decide(item, "APPROVE")}>
                      Одобрить
                    </Button>
                  )}
                  {item.status === "PUBLISHED" && (
                    <Button size="sm" variant="outline" isLoading={busy === item.id} onClick={() => decide(item, "UNPUBLISH")}>
                      Снять с публикации
                    </Button>
                  )}
                  {item.status !== "ARCHIVED" && (
                    <Button size="sm" variant="danger" isLoading={busy === item.id} onClick={() => decide(item, "REJECT")}>
                      Отклонить
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
