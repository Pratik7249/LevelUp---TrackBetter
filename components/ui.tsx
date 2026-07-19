import type { ReactNode } from "react";

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

export function MetricCard({ label, value, change, icon }: { label: string; value: string; change?: string; icon: string }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
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
