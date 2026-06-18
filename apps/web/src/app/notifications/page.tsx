"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Spinner } from "@med/ui";
import type { NotificationView } from "@med/shared";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/assignments";
import { getToken, ApiRequestError } from "@/lib/api";

export default function NotificationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setRows(await listNotifications());
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load()
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function open(n: NotificationView) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setRows((r) => r.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) router.push(n.link);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Уведомления</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await markAllNotificationsRead();
            await load();
          }}
        >
Отметить все прочитанными
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-slate-500">Нет уведомлений.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((n) => (
            <Card key={n.id} className={n.read ? "opacity-70" : "border-brand-300"}>
              <CardContent className="flex items-start justify-between gap-3 py-3">
                <button onClick={() => open(n)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                    <span className="font-medium">{n.title}</span>
                  </div>
                  {n.body && <p className="text-sm text-slate-500">{n.body}</p>}
                  <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                </button>
                {n.link && (
                  <Link href={n.link} onClick={() => !n.read && markNotificationRead(n.id)} className="shrink-0 text-sm text-brand-600 hover:underline">
Открыть →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
