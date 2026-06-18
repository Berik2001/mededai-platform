"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@med/ui";
import type { PublicUser } from "@med/shared";
import { fetchProfile } from "@/lib/auth";
import { getToken } from "@/lib/api";
import CaseForm from "../CaseForm";

export default function NewCasePage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then((u) => {
        if (u.role !== "TEACHER" && u.role !== "ADMIN") {
          router.replace("/cases");
          return;
        }
        setUser(u);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setReady(true));
  }, [router]);

  if (!ready || !user) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  return <CaseForm />;
}
