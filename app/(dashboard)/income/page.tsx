"use client";

import { useState } from "react";
import { BarChart } from "@/components/charts";
import { TransactionForm } from "@/components/forms";
import { Card, EmptyState, MetricCard, Pill } from "@/components/ui";
import { byAccount, byCategory, currency, filterByRange, formatDate, monthLabel, rangeForMonth, toMonthInput, totalsFromTransactions } from "@/lib/analytics";
import { useTracker } from "@/lib/store";

export default function IncomePage() {
  const { state, removeTransaction } = useTracker();
  const [month, setMonth] = useState(toMonthInput());
  const range = rangeForMonth(month);
  const income = filterByRange(state.transactions, range).filter((transaction) => transaction.type === "income");
  const summary = totalsFromTransactions(income);
  const highest = Math.max(...income.map((item) => item.amount), 0);

  return (
    <>
      <div className="page-heading"><div><h2>Income</h2><p>Track earnings and the exact account where money was received.</p></div><input className="month-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>
      <div className="grid four">
        <MetricCard icon="IN" label="Total income" value={currency(summary.income)} />
        <MetricCard icon="AV" label="Average entry" value={currency(income.length ? summary.income / income.length : 0)} />
        <MetricCard icon="HI" label="Highest entry" value={currency(highest)} />
        <MetricCard icon="SC" label="Income categories" value={String(new Set(income.map((item) => item.category)).size)} />
      </div>
      <div className="grid three section-gap">
        <Card title="Add income"><TransactionForm type="income" /></Card>
        <Card title="Income by category" eyebrow={monthLabel(month)} className="span-2">{income.length ? <BarChart data={byCategory(income)} /> : <EmptyState title="No income entries" text="Add income using the form." />}</Card>
        <Card title="Received into accounts">{income.length ? <BarChart data={byAccount(state, "income", range)} /> : <EmptyState title="No account activity" text="Income by bank, wallet or cash will appear here." />}</Card>
        <Card title="Income transactions" className="span-2"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Amount</th><th /></tr></thead><tbody>{income.map((transaction) => <tr key={transaction.id}><td>{formatDate(transaction.date)}</td><td>{transaction.description}</td><td><Pill tone="good">{transaction.category}</Pill></td><td><span className="account-chip">{state.accounts.find((account) => account.id === transaction.accountId)?.name ?? "Unknown"}</span></td><td className="positive">+{currency(transaction.amount)}</td><td><button className="text-button danger-text" onClick={() => removeTransaction(transaction.id)}>Delete</button></td></tr>)}</tbody></table>{!income.length && <EmptyState title={`No income in ${monthLabel(month)}`} text="Choose another month or add a new entry." />}</div></Card>
      </div>
    </>
  );
}
