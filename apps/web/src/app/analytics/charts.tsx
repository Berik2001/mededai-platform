"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActivityPoint,
  ErrorCategoryCount,
  MasteryBucket,
  SpecialtyAccuracy,
} from "@med/shared";

const BRAND = "#2563eb";
const CATEGORY_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#14b8a6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
];

const sourceLabel: Record<ActivityPoint["source"], string> = {
  TEST: "Тест",
  VIRTUAL_PATIENT: "Виртуальный пациент",
  OSCE: "ОСКЭ",
  CASE: "Клинический случай",
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function ProgressLineChart({ data }: { data: ActivityPoint[] }) {
  const points = data.map((p, i) => ({
    idx: i + 1,
    date: shortDate(p.date),
    score: p.score,
    label: `${sourceLabel[p.source]}: ${p.label}`,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" fontSize={12} stroke="#94a3b8" />
        <YAxis domain={[0, 100]} fontSize={12} stroke="#94a3b8" />
        <Tooltip
          formatter={(v: number) => [`${v}%`, "Балл"]}
          labelFormatter={(_l, payload) => payload?.[0]?.payload?.label ?? ""}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line type="monotone" dataKey="score" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SpecialtyChart({ data }: { data: SpecialtyAccuracy[] }) {
  if (data.length >= 3) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="label" fontSize={11} stroke="#64748b" />
          <PolarRadiusAxis domain={[0, 100]} fontSize={10} stroke="#cbd5e1" />
          <Tooltip formatter={(v: number) => [`${v}%`, "Точность"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Radar dataKey="accuracy" stroke={BRAND} fill={BRAND} fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} fontSize={12} stroke="#94a3b8" />
        <YAxis type="category" dataKey="label" fontSize={12} width={90} stroke="#94a3b8" />
        <Tooltip formatter={(v: number) => [`${v}%`, "Точность"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="accuracy" fill={BRAND} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ErrorsBarChart({ data }: { data: ErrorCategoryCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" fontSize={11} stroke="#94a3b8" interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} fontSize={12} stroke="#94a3b8" />
        <Tooltip formatter={(v: number) => [v, "Ошибки"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MasteryDistributionChart({ data }: { data: MasteryBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="bucket" fontSize={12} stroke="#94a3b8" />
        <YAxis allowDecimals={false} fontSize={12} stroke="#94a3b8" />
        <Tooltip formatter={(v: number) => [v, "Студенты"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="count" fill={BRAND} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
