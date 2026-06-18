"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from "@med/ui";
import type { GroupView, StudentListItem } from "@med/shared";
import {
  addGroupMembers,
  createGroup,
  deleteGroup,
  listGroups,
  listStudents,
  removeGroupMember,
} from "@/lib/assignments";
import { fetchProfile } from "@/lib/auth";
import { getToken } from "@/lib/api";

export default function GroupsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setGroups(await listGroups());
  }

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
        return Promise.all([listGroups(), listStudents()]).then(([g, s]) => {
          setGroups(g);
          setStudents(s);
          setReady(true);
        });
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function create() {
    if (!name.trim()) return setError("Укажите название группы");
    setCreating(true);
    setError(null);
    try {
      await createGroup({ name, memberIds: picked });
      setName("");
      setPicked([]);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
    } finally {
      setCreating(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Группы</h1>
        <Link href="/assignments" className="text-sm text-brand-600 hover:underline">
← Задания
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Новая группа</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input name="name" label="Название группы" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Участники</p>
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.includes(s.id)}
                    onChange={() =>
                      setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))
                    }
                  />
                  {s.name} <span className="text-slate-400">{s.email}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={create} isLoading={creating} className="w-fit">
Создать группу
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <GroupCard key={g.id} group={g} students={students} onChange={reload} />
        ))}
      </div>
    </div>
  );
}

function GroupCard({
  group,
  students,
  onChange,
}: {
  group: GroupView;
  students: StudentListItem[];
  onChange: () => void;
}) {
  const [addId, setAddId] = useState("");
  const memberIds = new Set((group.members ?? []).map((m) => m.id));
  const available = students.filter((s) => !memberIds.has(s.id));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">
          {group.name} <span className="text-sm font-normal text-slate-400">({group.memberCount})</span>
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (confirm(`Удалить группу «${group.name}»?`)) {
              await deleteGroup(group.id);
              onChange();
            }
          }}
        >
          ✕
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {(group.members ?? []).map((m) => (
            <Badge key={m.id} tone="neutral">
              {m.name}
              <button
                className="ml-1 text-slate-400 hover:text-red-600"
                onClick={async () => {
                  await removeGroupMember(group.id, m.id);
                  onChange();
                }}
              >
                ✕
              </button>
            </Badge>
          ))}
          {group.memberCount === 0 && <span className="text-sm text-slate-400">Нет участников.</span>}
        </div>
        {available.length > 0 && (
          <div className="flex gap-2">
            <select
              className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
            >
              <option value="">Добавить студента…</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!addId}
              onClick={async () => {
                await addGroupMembers(group.id, [addId]);
                setAddId("");
                onChange();
              }}
            >
              Добавить
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
