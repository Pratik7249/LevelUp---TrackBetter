"use client";

import { TrackerProvider } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  return <TrackerProvider>{children}</TrackerProvider>;
}
