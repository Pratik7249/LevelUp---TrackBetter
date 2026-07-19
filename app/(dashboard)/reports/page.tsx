"use client";

import { useEffect, useState } from "react";
import { Card, MetricCard } from "@/components/ui";
import { currency, monthLabel, portfolioTotals, rangeForMonth, toMonthInput, totals } from "@/lib/analytics";
import { useTracker } from "@/lib/store";

export default function ReportsPage() {
  const { state, updateReportSettings, getAuthToken, waitForSync, cloudEnabled, user } = useTracker();
  const range = rangeForMonth();
  const summary = totals(state, range);
  const portfolio = portfolioTotals(state);
  const [settings, setSettings] = useState(state.reportSettings);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => setSettings(state.reportSettings), [state.reportSettings]);
  useEffect(() => {
    if (!settings.email && user?.email) setSettings((current) => ({ ...current, email: user.email ?? "" }));
  }, [settings.email, user?.email]);

  function save() {
    if (settings.enabled && !/^\S+@\S+\.\S+$/.test(settings.email)) {
      setStatus("Enter a valid email before enabling reports.");
      return;
    }
    updateReportSettings(settings);
    setStatus("Report preferences saved.");
  }

  async function sendPreview() {
    if (!cloudEnabled || !user) {
      setStatus("Google login and Firestore are required to send a server report.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(settings.email)) {
      setStatus("Enter a valid report email.");
      return;
    }

    setSending(true);
    setStatus("Sending report…");
    try {
      await waitForSync();
      const token = await getAuthToken();
      const response = await fetch("/api/reports/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: settings.email, kind: "preview" })
      });
      const body = await response.json() as { error?: string };
      setStatus(response.ok ? "Report sent successfully." : body.error ?? "Could not send report.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send report.");
    } finally {
      setSending(false);
    }
  }

  const runningDays = Object.entries(state.habits[0]?.completions ?? {}).filter(([date, done]) => done && date >= range.from && date <= range.to).length;
  const messDays = Object.entries(state.messCompletions).filter(([date, done]) => done && date >= range.from && date <= range.to).length;

  return (
    <>
      <div className="page-heading"><div><h2>Email reports</h2><p>Send a progress review on the 15th and at month end.</p></div></div>
      <div className="grid four">
        <MetricCard icon="IN" label="Income" value={currency(summary.income)} />
        <MetricCard icon="EX" label="Expenses" value={currency(summary.expenses)} />
        <MetricCard icon="PF" label="Portfolio" value={currency(portfolio.current)} />
        <MetricCard icon="SV" label="Savings rate" value={`${summary.savingsRate.toFixed(1)}%`} />
      </div>
      <div className="grid two section-gap">
        <Card title="Report settings"><div className="form-grid"><div className="field full"><label>Send reports to</label><input type="email" value={settings.email} onChange={(event) => setSettings({ ...settings, email: event.target.value })} placeholder={user?.email ?? "you@example.com"} /></div><div className="field"><label>15-day report</label><select value={settings.fortnightly ? "yes" : "no"} onChange={(event) => setSettings({ ...settings, fortnightly: event.target.value === "yes" })}><option value="yes">Enabled</option><option value="no">Disabled</option></select></div><div className="field"><label>Month-end report</label><select value={settings.monthEnd ? "yes" : "no"} onChange={(event) => setSettings({ ...settings, monthEnd: event.target.value === "yes" })}><option value="yes">Enabled</option><option value="no">Disabled</option></select></div><div className="field full"><label>Automation</label><select value={settings.enabled ? "yes" : "no"} onChange={(event) => setSettings({ ...settings, enabled: event.target.value === "yes" })}><option value="yes">Active</option><option value="no">Paused</option></select></div><div className="field full button-row"><button className="button" onClick={save}>Save preferences</button><button className="button secondary" onClick={sendPreview} disabled={sending || !settings.email}>{sending ? "Sending…" : "Send test email"}</button></div>{status && <div className={`form-message field full ${status.includes("success") || status.includes("saved") ? "success" : "info"}`}>{status}</div>}</div></Card>
        <Card title="Report preview"><div className="report-preview"><div className="report-brand">TrackBetter</div><h3>{monthLabel(toMonthInput())} progress</h3><p>Finance, portfolio and habits in one summary.</p><div className="report-metrics"><div><span>Income</span><strong>{currency(summary.income)}</strong></div><div><span>Expenses</span><strong>{currency(summary.expenses)}</strong></div><div><span>Invested</span><strong>{currency(summary.investments)}</strong></div><div><span>Savings</span><strong>{currency(summary.savings)}</strong></div></div><p><strong>Portfolio:</strong> {currency(portfolio.current)} · {portfolio.gainPercent.toFixed(1)}% return</p><p><strong>Habit:</strong> {runningDays} completed days · <strong>Mess:</strong> {messDays} days</p></div></Card>
        <Card title="Included in every report"><div className="list"><div className="list-item"><div><strong>Money summary</strong><span>Income, expenses, investments and savings.</span></div><span>✓</span></div><div className="list-item"><div><strong>Category comparison</strong><span>Needs, Wants and Investment movement.</span></div><span>✓</span></div><div className="list-item"><div><strong>Portfolio review</strong><span>Current value, allocation and gains.</span></div><span>✓</span></div><div className="list-item"><div><strong>Daily progress</strong><span>Habits and mess tracking totals.</span></div><span>✓</span></div></div></Card>
        <Card title="Deployment status"><div className="notice">Automated reports require Firebase Admin credentials, Gmail SMTP variables and <code>CRON_SECRET</code> in Vercel. The report route rebuilds your latest data from the Firestore collections, so email reports stay synchronized with the dashboard and mobile app.</div></Card>
      </div>
    </>
  );
}
