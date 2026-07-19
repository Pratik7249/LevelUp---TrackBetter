"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTracker } from "@/lib/store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { authReady, cloudEnabled, user } = useTracker();

  useEffect(() => {
    if (authReady && cloudEnabled && !user) router.replace("/login");
  }, [authReady, cloudEnabled, router, user]);

  if (!authReady || (cloudEnabled && !user)) {
    return <div className="center-screen"><div className="loader" /><p>Checking your account…</p></div>;
  }

  return children;
}
