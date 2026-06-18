"use client";

import { useEffect, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from "@med/ui";
import type { StatusBreakdown, SystemStats } from "@med/shared";
import { adminStats } from "@/lib/admin";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function ContentCard({ title, b }: { title: string; b: StatusBreakdown }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {title} <span className="text-sm font-normal text-slate-400">({b.total})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 py-2">
        <Bar label="Опубликовано" value={b.published} total={b.total} tone="bg-emerald-500" />
        <Bar label="Черновик" value={b.draft} total={b.total} tone="bg-amber-500" />
        <Bar label="В архиве" value={b.archived} total={b.total} tone="bg-slate-400" />
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  if (!stats) return <p className="text-slate-500">Не удалось загрузить статистику.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Обзор системы</h1>
        <p className="text-sm text-slate-500">По состоянию на {new Date(stats.generatedAt).toLocaleString()}</p>
      </div>

      {/* Users */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Пользователи</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Всего" value={stats.users.total} />
          <Stat label="Активные" value={stats.users.active} />
          <Stat label="Заблокированы" value={stats.users.blocked} />
          <Stat label="Новые (7 дней)" value={stats.users.newLast7Days} />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">По ролям</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 py-2 sm:grid-cols-2">
            {stats.users.byRole.map((r) => (
              <Bar key={r.role} label={r.role} value={r.count} total={stats.users.total} tone="bg-brand-600" />
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Content */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Контент</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ContentCard title="Клинические случаи" b={stats.content.cases} />
          <ContentCard title="Тесты" b={stats.content.tests} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat label="Банк вопросов" value={stats.content.questions} />
          <Stat label="Экзамены OSCE" value={stats.content.osceExams} />
        </div>
      </section>

      {/* Activity */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Активность</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Тестовые сессии" value={stats.activity.testSessions} sub={`${stats.activity.testSessionsCompleted} завершено`} />
          <Stat label="Виртуальные пациенты" value={stats.activity.vpSessions} sub={`${stats.activity.vpCompleted} завершено`} />
          <Stat label="Сессии OSCE" value={stats.activity.osceSessions} sub={`${stats.activity.osceCompleted} завершено`} />
          <Stat label="Задания" value={stats.activity.assignments} sub={`${stats.activity.submissions} ответов`} />
        </div>
      </section>

      {/* Results */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Результаты тестов</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Средний балл" value={stats.results.avgTestScore != null ? `${stats.results.avgTestScore}%` : "—"} />
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Сдано</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.results.testsPassed}</p>
              </div>
              <Badge tone="green">сдано</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Не сдано</p>
                <p className="mt-1 text-2xl font-bold text-red-600">{stats.results.testsFailed}</p>
              </div>
              <Badge tone="red">не сдано</Badge>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
