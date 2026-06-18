"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from "@med/ui";
import type { CohortAnalytics, GroupView } from "@med/shared";
import { cohortAnalytics, downloadReport } from "@/lib/analytics";
import { listGroups } from "@/lib/assignments";
import { ErrorsBarChart, MasteryDistributionChart, SpecialtyChart } from "./charts";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function CohortView() {
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [data, setData] = useState<CohortAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listGroups()
      .then(setGroups)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    cohortAnalytics(groupId || undefined)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [groupId]);

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadReport("group", { groupId: groupId || undefined });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Аналитика группы</h1>
          <p className="text-sm text-slate-500">Результаты когорты по всем учебным модулям.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">Все студенты</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.memberCount})
              </option>
            ))}
          </select>
          <Button variant="outline" isLoading={exporting} onClick={exportCsv}>
            Экспорт в CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      ) : !data ? (
        <p className="text-slate-500">Не удалось загрузить аналитику.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Студенты" value={`${data.activeStudentCount}/${data.studentCount}`} />
            <Stat label="Средний уровень освоения" value={`${data.averages.masteryScore}/100`} />
            <Stat label="Средняя точность диагностики" value={`${data.averages.diagnosticAccuracy}%`} />
            <Stat label="Средняя точность" value={`${data.averages.overallAccuracy}%`} />
            <Stat
              label="Средняя скорость"
              value={
                data.averages.avgSecondsPerQuestion
                  ? `${data.averages.avgSecondsPerQuestion} с/вопрос`
                  : "—"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">Распределение уровня освоения</CardTitle>
              </CardHeader>
              <CardContent>
                <MasteryDistributionChart data={data.masteryDistribution} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">Ошибки по категориям</CardTitle>
              </CardHeader>
              <CardContent>
                {data.errorsByCategory.length > 0 ? (
                  <ErrorsBarChart data={data.errorsByCategory} />
                ) : (
                  <p className="py-10 text-center text-sm text-slate-400">Ошибок не зафиксировано.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">Точность по специальностям</CardTitle>
              </CardHeader>
              <CardContent>
                {data.accuracyBySpecialty.length > 0 ? (
                  <SpecialtyChart data={data.accuracyBySpecialty} />
                ) : (
                  <p className="py-10 text-center text-sm text-slate-400">Нет данных по специальностям.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Студенты</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Студент</th>
                    <th className="px-3">Освоение</th>
                    <th className="px-3">Диагностика</th>
                    <th className="px-3">Точность</th>
                    <th className="px-3">Ошибки</th>
                    <th className="px-3">Слабейшая</th>
                    <th className="px-3">Активность</th>
                    <th className="px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.studentId} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-800">{s.studentName}</td>
                      <td className="px-3">{s.masteryScore}</td>
                      <td className="px-3">{s.diagnosticAccuracy}%</td>
                      <td className="px-3">{s.overallAccuracy}%</td>
                      <td className="px-3">
                        {s.totalErrors > 0 ? <Badge tone="amber">{s.totalErrors}</Badge> : "0"}
                      </td>
                      <td className="px-3 text-slate-600">{s.weakestSpecialty ?? "—"}</td>
                      <td className="px-3 text-slate-500">{s.activityCount}</td>
                      <td className="px-3">
                        <Link href={`/analytics/students/${s.studentId}`} className="text-brand-600 hover:underline">
                          Открыть →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {data.students.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400">
                        В этой когорте нет студентов.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
