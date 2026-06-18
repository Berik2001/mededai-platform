"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, CardContent, Spinner } from "@med/ui";
import type { AssignmentMeta, PublicUser } from "@med/shared";
import { listAssignments } from "@/lib/assignments";
import { fetchProfile } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";

export default function AssignmentsDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [rows, setRows] = useState<AssignmentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then((u) => {
        if (u.role !== "TEACHER" && u.role !== "ADMIN") {
          router.replace("/tasks"); // students use the task dashboard
          return;
        }
        setUser(u);
        return listAssignments().then(setRows);
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
        else setError(err instanceof Error ? err.message : "Не удалось загрузить");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Задания</h1>
        <div className="flex gap-2">
          <Link href="/groups">
            <Button variant="outline">Группы</Button>
          </Link>
          <Link href="/assignments/new">
            <Button>+ Новое задание</Button>
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {rows.length === 0 ? (
        <p className="text-slate-500">Заданий пока нет.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((a) => {
            const due = new Date(a.dueAt);
            const overdue = due.getTime() < Date.now();
            return (
              <Link key={a.id} href={`/assignments/${a.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="brand">{a.targetType === "CASE" ? "Случай" : "Тест"}</Badge>
                        <span className="font-semibold">{a.title}</span>
                      </div>
                      <p className="text-sm text-slate-500">{a.targetTitle}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-600">
                        {a.submittedCount}/{a.submissionCount} отправлено · {a.gradedCount} оценено
                      </span>
                      <span className={overdue ? "text-red-600" : "text-slate-600"}>
                        Срок: {due.toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
