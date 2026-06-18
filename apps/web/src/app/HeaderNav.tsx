"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PublicUser } from "@med/shared";
import { fetchProfile, logout } from "@/lib/auth";
import { unreadCount } from "@/lib/assignments";
import { getToken } from "@/lib/api";

/** Fired by login/logout so the header updates immediately within the same tab. */
export const AUTH_EVENT = "med-auth-changed";

export default function HeaderNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    if (!getToken()) {
      setUser(null);
      setUnread(0);
      return;
    }
    fetchProfile()
      .then(setUser)
      .catch(() => setUser(null));
    unreadCount()
      .then((r) => setUnread(r.count))
      .catch(() => undefined);
  }, []);

  // Re-evaluate auth on every navigation and on explicit auth events,
  // so the header reflects login/logout without a full page reload.
  useEffect(() => {
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(AUTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh, pathname]);

  function onLogout() {
    logout();
    setUser(null);
    window.dispatchEvent(new Event(AUTH_EVENT));
    router.replace("/login");
  }

  const isStaff = user?.role === "TEACHER" || user?.role === "ADMIN";
  const link = "hover:text-brand-700";

  return (
    <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
      <Link href="/dashboard" className={link}>
        Главная
      </Link>
      <Link href="/cases" className={link}>
        Случаи
      </Link>
      <Link href="/virtual-patient" className={link}>
        Виртуальный пациент
      </Link>
      <Link href="/tests" className={link}>
        Тесты
      </Link>
      <Link href="/osce" className={link}>
        ОСКЭ
      </Link>
      <Link href="/analytics" className={link}>
        Аналитика
      </Link>
      <Link href="/tutor" className={link}>
        Наставник
      </Link>
      {user &&
        (isStaff ? (
          <Link href="/assignments" className={link}>
            Задания
          </Link>
        ) : (
          <Link href="/tasks" className={link}>
            Мои задачи
          </Link>
        ))}
      {user?.role === "ADMIN" && (
        <Link href="/admin" className={`${link} font-semibold text-slate-900`}>
          Админ
        </Link>
      )}
      {user && (
        <Link href="/notifications" className={`relative ${link}`} aria-label="Уведомления">
          🔔
          {unread > 0 && (
            <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">
              {unread}
            </span>
          )}
        </Link>
      )}
      {user ? (
        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
          <span className="hidden text-slate-700 sm:inline" title={user.email}>
            {user.firstName} {user.lastName}
          </span>
          <button
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-50"
          >
            Выйти
          </button>
        </div>
      ) : (
        <Link href="/login" className={`rounded-lg bg-brand-600 px-3 py-1 text-white hover:bg-brand-700`}>
          Войти
        </Link>
      )}
    </nav>
  );
}
