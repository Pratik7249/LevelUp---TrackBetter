"use client";

import { useMemo, useState } from "react";
import { BarChart, LineChart } from "@/components/charts";
import { Card, EmptyState, MetricCard } from "@/components/ui";
import {
  byCategory,
  byMainCategory,
  currency,
  filterByRange,
  monthLabel,
  periodSpendSeries,
  previousMonthKey,
  rangeForMonth,
  toDateInput,
  toMonthInput,
  totalsFromTransactions,
  type DateRange
} from "@/lib/analytics";
import { useTracker } from "@/lib/store";
import type { MainCategory } from "@/lib/types";

function previousPeriod(range: DateRange): DateRange {
  const start = new Date(`${range.from}T00:00:00`);
  const end = new Date(`${range.to}T00:00:00`);
  const length = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - length + 1);
  return { from: toDateInput(previousStart), to: toDateInput(previousEnd) };
}

function mergeBars(current: Array<{ label: string; value: number }>, previous: Array<{ label: string; value: number }>) {
  const labels = [...new Set([...current.map((item) => item.label), ...previous.map((item) => item.label)])];
  return labels.map((label) => ({
    label,
    value: current.find((item) => item.label === label)?.value ?? 0,
    comparison: previous.find((item) => item.label === label)?.value ?? 0
  }));
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export default function ComparePage() {
  const { state } = useTracker();
  const [mode, setMode] = useState<"monthly" | "custom">("monthly");
  const [month, setMonth] = useState(toMonthInput());
  const [from, setFrom] = useState(rangeForMonth(toMonthInput()).from);
  const [to, setTo] = useState(toDateInput());
  const [category, setCategory] = useState<MainCategory>("Needs");

  const selectedRange = mode === "monthly" ? rangeForMonth(month) : { from: from <= to ? from : to, to: from <= to ? to : from };
  const comparisonRange = mode === "monthly" ? rangeForMonth(previousMonthKey(month)) : previousPeriod(selectedRange);
  const currentTransactions = filterByRange(state.transactions, selectedRange);
  const previousTransactions = filterByRange(state.transactions, comparisonRange);
  const currentSummary = totalsFromTransactions(currentTransactions);
  const previousSummary = totalsFromTransactions(previousTransactions);

  const mainComparison = mergeBars(
    byMainCategory(currentTransactions.filter((item) => item.type !== "income")),
    byMainCategory(previousTransactions.filter((item) => item.type !== "income"))
  );
  const categoryComparison = mergeBars(
    byCategory(currentTransactions.filter((item) => item.mainCategory === category)),
    byCategory(previousTransactions.filter((item) => item.mainCategory === category))
  );

  const customSeries = useMemo(() => {
    const current = periodSpendSeries(state.transactions, selectedRange);
    const previous = periodSpendSeries(state.transactions, comparisonRange);
    return Array.from({ length: Math.max(current.length, previous.length) }, (_, index) => ({
      label: `Day ${index + 1}`,
      selected: current[index]?.value ?? 0,
      previous: previous[index]?.value ?? 0
    }));
  }, [comparisonRange.from, comparisonRange.to, selectedRange.from, selectedRange.to, state.transactions]);

  const expenseChange = percentChange(currentSummary.expenses, previousSummary.expenses);
  const investmentChange = percentChange(currentSummary.investments, previousSummary.investments);

  return (
    <>
      <div className="page-heading"><div><h2>Compare periods</h2><p>Use real tracker data to compare months, custom days and spending categories.</p></div><div className="tabs"><button className={mode === "monthly" ? "active" : ""} onClick={() => setMode("monthly")}>Monthly</button><button className={mode === "custom" ? "active" : ""} onClick={() => setMode("custom")}>Custom days</button></div></div>

      <Card className="filter-card">
        {mode === "monthly" ? <div className="inline-fields"><div className="field"><label>Month</label><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div><div className="range-note">Compared with {monthLabel(previousMonthKey(month))}</div></div> : <div className="inline-fields"><div className="field"><label>From</label><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div><div className="field"><label>To</label><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div><div className="range-note">Previous period: {comparisonRange.from} to {comparisonRange.to}</div></div>}
      </Card>

      <div className="grid four section-gap small-gap">
        <MetricCard icon="IN" label="Income" value={currency(currentSummary.income)} change={`${percentChange(currentSummary.income, previousSummary.income).toFixed(1)}% change`} />
        <MetricCard icon="EX" label="Expenses" value={currency(currentSummary.expenses)} change={`${expenseChange.toFixed(1)}% change`} />
        <MetricCard icon="IV" label="Investments" value={currency(currentSummary.investments)} change={`${investmentChange.toFixed(1)}% change`} />
        <MetricCard icon="SV" label="Savings rate" value={`${currentSummary.savingsRate.toFixed(1)}%`} change={`${(currentSummary.savingsRate - previousSummary.savingsRate).toFixed(1)} points`} />
      </div>

      <div className="grid two section-gap">
        <Card title="Needs, Wants and Investment" eyebrow="Selected vs previous">{currentTransactions.length || previousTransactions.length ? <BarChart data={mainComparison} comparisonKey="Previous" /> : <EmptyState title="No data to compare" text="Add transactions in either period." />}</Card>
        <Card title="Compare categories" action={<select className="compact-select" value={category} onChange={(event) => setCategory(event.target.value as MainCategory)}><option>Needs</option><option>Wants</option><option>Investment</option></select>}>{categoryComparison.length ? <BarChart data={categoryComparison} comparisonKey="Previous" /> : <EmptyState title={`No ${category} data`} text="Choose another type or add transactions." />}</Card>
        <Card title="Spending progression" className="span-2"><LineChart data={customSeries} series={[{ key: "selected", label: "Selected period" }, { key: "previous", label: "Previous period" }]} /></Card>
        <Card title="Period summary"><div className="list"><div className="list-item"><div><strong>Expense movement</strong><span>{expenseChange <= 0 ? "Spending reduced against the previous period." : "Spending increased against the previous period."}</span></div><strong className={expenseChange <= 0 ? "positive" : "negative"}>{expenseChange >= 0 ? "+" : ""}{expenseChange.toFixed(1)}%</strong></div><div className="list-item"><div><strong>Investment movement</strong><span>{investmentChange >= 0 ? "Investment contribution increased." : "Investment contribution decreased."}</span></div><strong className={investmentChange >= 0 ? "positive" : "negative"}>{investmentChange >= 0 ? "+" : ""}{investmentChange.toFixed(1)}%</strong></div></div></Card>
        <Card title="Selected ranges"><div className="summary-strip"><div><span>Selected</span><strong>{selectedRange.from}<br />{selectedRange.to}</strong></div><div><span>Previous</span><strong>{comparisonRange.from}<br />{comparisonRange.to}</strong></div></div></Card>
      </div>
    </>
  );
}
