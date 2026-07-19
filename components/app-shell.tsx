"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { monthLabel, toMonthInput } from "@/lib/analytics";
import { useTracker } from "@/lib/store";

const nav = [
  ["/overview", "Overview"],
  ["/income", "Income"],
  ["/expenses", "Expenses"],
  ["/compare", "Compare"],
  ["/portfolio", "Portfolio"],
  ["/trackers", "Trackers"],
  ["/reports", "Reports"],
  ["/settings", "Settings"]
] as const;

const initials = (name?: string | null) => (name || "User").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { cloudEnabled, ready, user, syncStatus, signOutUser } = useTracker();
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Personal tracker";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand"><span>TB</span><strong>TrackBetter</strong></div>
        <nav>
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-status">
          <div className={`status-dot ${syncStatus === "error" ? "error" : cloudEnabled ? "online" : "demo"}`} />
          <div>
            <strong>{cloudEnabled ? (syncStatus === "syncing" ? "Saving changes" : syncStatus === "error" ? "Sync problem" : "Cloud sync on") : "Local mode"}</strong>
            <span>{ready ? (cloudEnabled ? "Google + Firestore" : "Stored in this browser") : "Loading data…"}</span>
          </div>
        </div>
        <div className="profile-mini">
          {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <div className="avatar">{initials(displayName)}</div>}
          <div className="profile-text"><strong>{displayName}</strong><span>{user?.email || "Local workspace"}</span></div>
          {user && <button className="signout-button" onClick={() => void signOutUser()} title="Sign out">↪</button>}
        </div>
      </aside>
      {open && <button className="backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <div><h1>Hello, {displayName}</h1><p>Your overview for {monthLabel(toMonthInput())}</p></div>
          <div className="top-actions"><ThemeToggle compact /><Link className="icon-button" href="/settings" aria-label="Settings">⚙</Link></div>
        </header>
        <div className="page-content">{ready ? children : <div className="center-panel"><div className="loader" /><p>Loading your tracker…</p></div>}</div>
      </main>
    </div>
  );
}
