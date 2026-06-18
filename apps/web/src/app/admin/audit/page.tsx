"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, Spinner } from "@med/ui";
import type { AuditLogView } from "@med/shared";
import { adminAuditLogs } from "@/lib/admin";

const fieldClass = "h-9 rounded-lg border border-slate-300 px-2 text-sm";

function statusTone(code?: number | null): "green" | "amber" | "red" | "neutral" {
  if (!code) return "neutral";
  if (code < 300) return "green";
  if (code < 400) return "amber";
  return "red";
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogView[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAuditLogs({
        page,
        limit: 50,
        search: search || undefined,
        method: method || undefined,
      });
      setRows(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search, method]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Журнал аудита</h1>
          <p className="text-sm text-slate-500">{total} записей</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className={`${fieldClass} min-w-[180px]`}
            placeholder="Поиск по действию или пути…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <select className={fieldClass} value={method} onChange={(e) => { setPage(1); setMethod(e.target.value); }}>
            <option value="">Все методы</option>
            {["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size={28} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Время</th>
                  <th className="px-3">Пользователь</th>
                  <th className="px-3">Метод</th>
                  <th className="px-3">Путь</th>
                  <th className="px-3">Статус</th>
                  <th className="px-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 text-slate-700">{r.userEmail ?? <span className="text-slate-400">аноним</span>}</td>
                    <td className="px-3 font-mono text-xs text-slate-600">{r.method}</td>
                    <td className="max-w-[280px] truncate px-3 font-mono text-xs text-slate-600" title={r.path ?? ""}>
                      {r.path}
                    </td>
                    <td className="px-3">
                      {r.statusCode ? <Badge tone={statusTone(r.statusCode)}>{r.statusCode}</Badge> : "—"}
                    </td>
                    <td className="px-3 text-xs text-slate-500">{r.ip ?? "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Нет записей аудита.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-3">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ← Назад
        </Button>
        <span className="text-sm text-slate-500">
          Стр. {page} / {totalPages}
        </span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Вперёд →
        </Button>
      </div>
    </div>
  );
}
