"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@med/ui";
import type { PublicUser, StudentAnalytics } from "@med/shared";
import { myAnalytics } from "@/lib/analytics";
import { fetchProfile } from "@/lib/auth";
import { getToken, ApiRequestError } from "@/lib/api";
import StudentAnalyticsView from "./StudentAnalyticsView";
import CohortView from "./CohortView";

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then(async (u) => {
        setUser(u);
        if (u.role !== "TEACHER" && u.role !== "ADMIN") {
          setAnalytics(await myAnalytics());
        }
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && err.status === 401) router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  if (user?.role === "TEACHER" || user?.role === "ADMIN") {
    return <CohortView />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Моя аналитика</h1>
        <p className="text-sm text-slate-500">Ваши результаты по тестам, виртуальным пациентам и ОСКЭ.</p>
      </div>
      {analytics && <StudentAnalyticsView a={analytics} />}
    </div>
  );
}
