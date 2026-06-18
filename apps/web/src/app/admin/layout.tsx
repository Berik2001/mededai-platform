"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@med/ui";
import { fetchProfile } from "@/lib/auth";
import { getToken } from "@/lib/api";

const NAV = [
  { href: "/admin", label: "Обзор", exact: true },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/moderation", label: "Модерация" },
  { href: "/admin/audit", label: "Журнал аудита" },
  { href: "/admin/backups", label: "Резервные копии" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then((u) => {
        if (u.role !== "ADMIN") router.replace("/dashboard");
        else setAllowed(true);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setChecking(false));
  }, [router]);

  if (checking || !allowed) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="md:w-52 md:shrink-0">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">Админ</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
