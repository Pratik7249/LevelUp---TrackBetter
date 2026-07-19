"use client";

import { useState } from "react";
import { BarChart, DonutChart } from "@/components/charts";
import { TransactionForm } from "@/components/forms";
import { Card, EmptyState, MetricCard, Pill } from "@/components/ui";
import { byCategory, byMainCategory, currency, filterByRange, formatDate, monthLabel, rangeForMonth, toMonthInput, totalsFromTransactions } from "@/lib/analytics";
import { useTracker } from "@/lib/store";
import type { MainCategory } from "@/lib/types";

export default function ExpensesPage() {
  const { state, removeTransaction } = useTracker();
  const [filter, setFilter] = useState<"All" | MainCategory>("All");
  const [month, setMonth] = useState(toMonthInput());
  const range = rangeForMonth(month);
  const expenses = filterByRange(state.transactions, range).filter((transaction) => transaction.type !== "income");
  const filtered = expenses.filter((transaction) => filter === "All" || transaction.mainCategory === filter);
  const summary = totalsFromTransactions(expenses);
  const highest = Math.max(...expenses.map((item) => item.amount), 0);

  return (
    <>
      <div className="page-heading"><div><h2>Expenses and investments</h2><p>One simple form for Needs, Wants and Investments with account tracking.</p></div><div className="heading-actions"><input className="month-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /><div className="tabs">{(["All", "Needs", "Wants", "Investment"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></div></div>
      <div className="grid four">
        <MetricCard icon="EX" label="Expenses" value={currency(summary.expenses)} />
        <MetricCard icon="IV" label="Investments" value={currency(summary.investments)} />
        <MetricCard icon="HI" label="Highest entry" value={currency(highest)} />
        <MetricCard icon="TX" label="Entries" value={String(expenses.length)} />
      </div>
      <div className="grid three section-gap">
        <Card title="Add expense or investment"><TransactionForm type="expense" /></Card>
        <Card title="Needs, Wants and Investment">{expenses.length ? <DonutChart data={byMainCategory(expenses)} centerLabel={currency(summary.expenses + summary.investments)} /> : <EmptyState title="No entries yet" text="Your category split will appear here." />}</Card>
        <Card title="Top categories" eyebrow={monthLabel(month)}>{filtered.length ? <BarChart data={byCategory(filtered)} /> : <EmptyState title="Nothing in this filter" text="Try another category or add an entry." />}</Card>
        <Card title="Paid from accounts">{expenses.length ? <BarChart data={state.accounts.map((account) => ({ label: account.name, value: expenses.filter((item) => item.accountId === account.id).reduce((sum, item) => sum + item.amount, 0) })).filter((item) => item.value > 0)} /> : <EmptyState title="No account spending" text="Account usage will appear here." />}</Card>
        <Card title="Transactions" className="span-2"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th>Subcategory</th><th>Account</th><th>Amount</th><th /></tr></thead><tbody>{filtered.map((transaction) => <tr key={transaction.id}><td>{formatDate(transaction.date)}</td><td>{transaction.description}</td><td><Pill tone={transaction.mainCategory === "Needs" ? "good" : transaction.mainCategory === "Wants" ? "orange" : "neutral"}>{transaction.mainCategory ?? "—"}</Pill></td><td>{transaction.category}</td><td>{transaction.subcategory ?? "General"}</td><td><span className="account-chip">{state.accounts.find((account) => account.id === transaction.accountId)?.name ?? "Unknown"}</span></td><td className="negative">-{currency(transaction.amount)}</td><td><button className="text-button danger-text" onClick={() => removeTransaction(transaction.id)}>Delete</button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title={`No matching entries in ${monthLabel(month)}`} text="Change the filter or add a transaction." />}</div></Card>
      </div>
    </>
  );
}
