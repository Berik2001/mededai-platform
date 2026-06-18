"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@med/ui";
import { fetchProfile } from "@/lib/auth";
import { getToken } from "@/lib/api";
import TestForm from "../TestForm";

export default function NewTestPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    fetchProfile()
      .then((u) => {
        if (u.role !== "TEACHER" && u.role !== "ADMIN") router.replace("/tests");
        else setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }
  return <TestForm />;
}
