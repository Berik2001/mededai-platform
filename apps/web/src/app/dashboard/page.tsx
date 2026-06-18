"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from "@med/ui";
import type { PublicUser } from "@med/shared";
import { fetchProfile, logout } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof Error ? err.message : "Не удалось загрузить профиль");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  function onLogout() {
    logout();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            С возвращением, {user?.firstName} {user?.lastName}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="brand">{user?.role}</Badge>
            {user?.institution && (
              <span className="text-sm text-slate-500">{user.institution}</span>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={onLogout}>
          Выйти
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Продолжить обучение</CardTitle>
            <CardDescription>Вернитесь к тому, на чём остановились.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/cases")}>Перейти к случаям</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ИИ-наставник</CardTitle>
            <CardDescription>Разбирайте клиническое мышление с подсказками.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/tutor")}>Открыть наставника</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ваш прогресс</CardTitle>
            <CardDescription>Отслеживайте пройденные случаи и баллы.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Пока нет активности.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
