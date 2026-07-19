"use client";

import { useState, type ReactNode } from "react";

export function Card({ title, eyebrow, action, className = "", children }: { title?: string; eyebrow?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || eyebrow || action) && (
        <header className="card-header">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function CollapsibleCard({
  title,
  eyebrow,
  className = "",
  defaultOpen = true,
  open,
  onOpenChange,
  children
}: {
  title: string;
  eyebrow?: string;
  className?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const displayedOpen = controlled ? Boolean(open) : internalOpen;

  return (
    <details
      className={`card collapsible-card ${className}`}
      open={displayedOpen}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        if (!controlled) setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
    >
      <summary className="card-header collapsible-summary">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        <span className="collapse-icon" aria-hidden="true">⌄</span>
      </summary>
      <div className="collapsible-content">{children}</div>
    </details>
  );
}

export function MetricCard({ label, value, change, helper, icon }: { label: string; value: string; change?: string; helper?: string; icon: string }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper && <small className="money-words">{helper}</small>}
        {change && <small className={change.trim().startsWith("+") ? "positive" : change.trim().startsWith("-") ? "negative" : "muted"}>{change}</small>}
      </div>
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{text}</span></div>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "purple" | "orange" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
