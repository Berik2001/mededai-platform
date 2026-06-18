"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from "@med/ui";
import type {
  AssignmentTargetType,
  ClinicalCaseMeta,
  CreateAssignmentInput,
  GroupView,
  StudentListItem,
  TestMeta,
} from "@med/shared";
import { createAssignment, listGroups, listStudents } from "@/lib/assignments";
import { listCases } from "@/lib/cases";
import { listTests } from "@/lib/tests";
import { fetchProfile } from "@/lib/auth";
import { getToken } from "@/lib/api";

const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

export default function NewAssignmentPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cases, setCases] = useState<ClinicalCaseMeta[]>([]);
  const [tests, setTests] = useState<TestMeta[]>([]);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [groups, setGroups] = useState<GroupView[]>([]);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [targetType, setTargetType] = useState<AssignmentTargetType>("CASE");
  const [targetId, setTargetId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then((u) => {
        if (u.role !== "TEACHER" && u.role !== "ADMIN") {
          router.replace("/tasks");
          return;
        }
        return Promise.all([
          listCases({ status: "PUBLISHED", limit: 100 }),
          listTests({ status: "PUBLISHED", limit: 100 }),
          listStudents(),
          listGroups(),
        ]).then(([c, t, s, g]) => {
          setCases(c.items);
          setTests(t.items);
          setStudents(s);
          setGroups(g);
          setReady(true);
        });
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  function toggle(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Укажите название");
    if (!targetId) return setError("Выберите случай или тест");
    if (!dueAt) return setError("Установите срок сдачи");
    if (studentIds.length === 0 && groupIds.length === 0)
      return setError("Назначьте хотя бы одного студента или группу");
    setSaving(true);
    setError(null);
    const payload: CreateAssignmentInput = {
      title,
      instructions: instructions || undefined,
      targetType,
      caseId: targetType === "CASE" ? targetId : undefined,
      testId: targetType === "TEST" ? targetId : undefined,
      dueAt: new Date(dueAt).toISOString(),
      studentIds,
      groupIds,
    };
    try {
      const a = await createAssignment(payload);
      router.push(`/assignments/${a.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  const targets = targetType === "CASE" ? cases : tests;

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-bold">Новое задание</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Задание</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input name="title" label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Инструкции</span>
            <textarea className={`${fieldClass} min-h-[70px]`} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Тип</span>
              <select
                className={fieldClass}
                value={targetType}
                onChange={(e) => {
                  setTargetType(e.target.value as AssignmentTargetType);
                  setTargetId("");
                }}
              >
                <option value="CASE">Клинический случай</option>
                <option value="TEST">Тест</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">{targetType === "CASE" ? "Случай" : "Тест"}</span>
              <select className={fieldClass} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Выберите…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Срок сдачи</span>
            <input type="datetime-local" className={fieldClass} value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Назначить</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Группы</p>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {groups.length === 0 && <p className="text-sm text-slate-400">Нет групп.</p>}
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggle(groupIds, setGroupIds, g.id)} />
                  {g.name} <span className="text-slate-400">({g.memberCount})</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Отдельные студенты</p>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {students.length === 0 && <p className="text-sm text-slate-400">Нет студентов.</p>}
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={studentIds.includes(s.id)} onChange={() => toggle(studentIds, setStudentIds, s.id)} />
                  {s.name} <span className="text-slate-400">{s.email}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="lg" isLoading={saving}>
          Создать задание
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => router.push("/assignments")}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
