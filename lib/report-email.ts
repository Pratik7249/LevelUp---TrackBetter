import { currency, filterByRange, monthLabel, portfolioTotals, rangeForMonth, toDateInput, toMonthInput, totalsFromTransactions } from "./analytics";
import type { TrackerState } from "./types";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);

export function buildReportHtml(state: TrackerState, kind: string) {
  const monthKey = toMonthInput();
  const monthRange = rangeForMonth(monthKey);
  const reportRange = kind === "month-end" ? monthRange : { ...monthRange, to: toDateInput() };
  const transactions = filterByRange(state.transactions, reportRange);
  const summary = totalsFromTransactions(transactions);
  const portfolio = portfolioTotals(state);
  const runningDays = Object.entries(state.habits.find((habit) => habit.id === "running")?.completions ?? {}).filter(([date, done]) => done && date >= reportRange.from && date <= reportRange.to).length;
  const learningDays = Object.entries(state.habits.find((habit) => habit.id === "learning")?.completions ?? {}).filter(([date, done]) => done && date >= reportRange.from && date <= reportRange.to).length;
  const focusDays = Object.entries(state.dailyCheckins).filter(([date, done]) => done && date >= reportRange.from && date <= reportRange.to).length;
  const topExpenses = transactions.filter((transaction) => transaction.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5);
  const title = kind === "month-end" ? `${monthLabel(monthKey)} Review` : kind === "preview" ? "TrackBetter Test Report" : "15-Day Progress Review";

  const metricCells = [
    ["Income", currency(summary.income)],
    ["Expenses", currency(summary.expenses)],
    ["Invested", currency(summary.investments)],
    ["Savings", currency(summary.savings)]
  ].map(([label, value]) => `<td style="padding:12px;border:1px solid #e2e8f0"><div style="font-size:11px;color:#64748b">${label}</div><strong style="display:block;margin-top:5px;font-size:15px;color:#0f172a">${value}</strong></td>`).join("");

  const expenseRows = topExpenses.length
    ? topExpenses.map((transaction) => `<tr><td style="padding:11px 0;border-bottom:1px solid #e2e8f0"><strong style="color:#0f172a">${escapeHtml(transaction.description)}</strong><br><span style="font-size:11px;color:#64748b">${escapeHtml(transaction.category)} · ${escapeHtml(transaction.subcategory ?? "General")}</span></td><td align="right" style="padding:11px 0;border-bottom:1px solid #e2e8f0;color:#c43d4b"><strong>${currency(transaction.amount)}</strong></td></tr>`).join("")
    : `<tr><td style="padding:12px 0;color:#64748b">No expenses recorded in this period.</td></tr>`;

  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden"><tr><td style="padding:26px;background:#4f7f72;color:#ffffff"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9">TrackBetter</div><h1 style="margin:8px 0 6px;font-size:26px">${title}</h1><div style="font-size:13px;opacity:.88">${reportRange.from} to ${reportRange.to}</div></td></tr><tr><td style="padding:26px"><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>${metricCells}</tr></table><h2 style="font-size:17px;margin:26px 0 10px">Portfolio</h2><p style="font-size:13px;line-height:1.7;color:#475569">Current value: <strong style="color:#0f172a">${currency(portfolio.current)}</strong><br>Invested amount: ${currency(portfolio.invested)}<br>Gain or loss: <strong style="color:${portfolio.gain >= 0 ? "#14845d" : "#c43d4b"}">${currency(portfolio.gain)} (${portfolio.gainPercent.toFixed(1)}%)</strong></p><h2 style="font-size:17px;margin:26px 0 10px">Personal progress</h2><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse"><tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0">Running</td><td align="right" style="border-bottom:1px solid #e2e8f0"><strong>${runningDays} days</strong></td></tr><tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0">Learning</td><td align="right" style="border-bottom:1px solid #e2e8f0"><strong>${learningDays} days</strong></td></tr><tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0">Daily focus</td><td align="right" style="border-bottom:1px solid #e2e8f0"><strong>${focusDays} days</strong></td></tr></table><h2 style="font-size:17px;margin:26px 0 10px">Top expenses</h2><table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse">${expenseRows}</table><p style="margin:26px 0 0;font-size:11px;line-height:1.7;color:#64748b">Keep tracking consistently. Better records make monthly decisions easier.</p></td></tr></table></td></tr></table></body></html>`;
}
