"use client";

import Link from "next/link";
import { BarChart, DonutChart, LineChart } from "@/components/charts";
import { Card, EmptyState, MetricCard, Pill } from "@/components/ui";
import {
  byCategory,
  byMainCategory,
  clampPercentage,
  completionCount,
  currency,
  dailyHabitTrend,
  dailySeries,
  daysInMonth,
  filterByRange,
  monthLabel,
  portfolioTotals,
  previousMonthKey,
  rangeForMonth,
  toMonthInput,
  totals,
  totalsFromTransactions
} from "@/lib/analytics";
import { useTracker } from "@/lib/store";

function changeLabel(current: number, previous: number, invert = false) {
  if (!previous) return current ? "New this month" : "No change";
  const change = ((current - previous) / previous) * 100;
  const shown = `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs last month`;
  return invert ? `${change <= 0 ? "+" : "-"}${Math.abs(change).toFixed(1)}% better` : shown;
}

export default function OverviewPage() {
  const { state } = useTracker();
  const monthKey = toMonthInput();
  const range = rangeForMonth(monthKey);
  const previousRange = rangeForMonth(previousMonthKey(monthKey));
  const currentTransactions = filterByRange(state.transactions, range);
  const previousSummary = totalsFromTransactions(filterByRange(state.transactions, previousRange));
  const summary = totals(state, range);
  const portfolio = portfolioTotals(state, monthKey);
  const expenseTransactions = currentTransactions.filter((transaction) => transaction.type !== "income");
  const categories = byCategory(currentTransactions.filter((item) => item.type === "expense")).slice(0, 5);
  const mainCategories = byMainCategory(expenseTransactions);
  const overviewHabits = state.habits.slice(0, 2);
  const focusDays = completionCount(state.dailyCheckins, monthKey);
  const totalDays = daysInMonth(monthKey);
  const firstHabit = overviewHabits[0];
  const secondHabit = overviewHabits[1];
  const firstTrend = dailyHabitTrend(firstHabit?.completions ?? {}, monthKey);
  const secondTrend = dailyHabitTrend(secondHabit?.completions ?? {}, monthKey);
  const habitTrend = firstTrend.map((row, index) => ({
    label: row.label,
    primary: row.completed,
    secondary: secondTrend[index]?.completed ?? 0
  }));
  const financeProgress = clampPercentage(summary.savingsRate);
  const focusProgress = clampPercentage((focusDays / Math.max(totalDays, 1)) * 100);
  const portfolioGoalProgress = clampPercentage(portfolio.goalProgress);

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Monthly overview</h2>
          <p>Money, portfolio growth and personal consistency for {monthLabel(monthKey)}.</p>
        </div>
        <Link href="/expenses" className="button">Add transaction</Link>
      </div>

      <div className="grid metrics">
        <MetricCard icon="IN" label="Income" value={currency(summary.income)} change={changeLabel(summary.income, previousSummary.income)} />
        <MetricCard icon="EX" label="Expenses" value={currency(summary.expenses)} change={changeLabel(summary.expenses, previousSummary.expenses, true)} />
        <MetricCard icon="IV" label="Invested" value={currency(summary.investments)} change={changeLabel(summary.investments, previousSummary.investments)} />
        <MetricCard icon="SV" label="Net savings" value={currency(summary.savings)} change={`${summary.savingsRate.toFixed(1)}% savings rate`} />
        <MetricCard icon="PF" label="Portfolio value" value={currency(portfolio.current)} change={`${portfolio.gain >= 0 ? "+" : ""}${portfolio.gainPercent.toFixed(1)}% overall`} />
      </div>

      <div className="grid three section-gap">
        <Card title="Cash flow" eyebrow={monthLabel(monthKey)} className="span-2">
          <LineChart data={dailySeries(state.transactions, range)} series={[{ key: "income", label: "Income" }, { key: "expense", label: "Expenses" }, { key: "investment", label: "Investments" }]} />
        </Card>

        <Card title="Reports">
          <div className="list">
            <div className="list-item"><div><strong>15-day review</strong><span>Finance, portfolio and habits</span></div><Pill tone="neutral">15th</Pill></div>
            <div className="list-item"><div><strong>Month-end review</strong><span>Full monthly summary</span></div><Pill tone="neutral">Last day</Pill></div>
            <Link href="/reports" className="button secondary full">Manage reports</Link>
          </div>
        </Card>

        <Card title="Spending type">
          {expenseTransactions.length ? <DonutChart data={mainCategories} centerLabel={currency(summary.expenses + summary.investments)} /> : <EmptyState title="No spending yet" text="Add an expense or investment to see the split." />}
        </Card>

        <Card title="Top categories">
          {categories.length ? <BarChart data={categories} /> : <EmptyState title="No categories to show" text="Your spending categories will appear here." />}
        </Card>

        <Card title="Recent transactions">
          <div className="list">
            {currentTransactions.slice(0, 5).map((transaction) => (
              <div className="list-item" key={transaction.id}>
                <div><strong>{transaction.description}</strong><span>{transaction.date} · {state.accounts.find((account) => account.id === transaction.accountId)?.name ?? "Unknown account"}</span></div>
                <strong className={transaction.type === "income" ? "positive" : "negative"}>{transaction.type === "income" ? "+" : "-"}{currency(transaction.amount)}</strong>
              </div>
            ))}
            {!currentTransactions.length && <EmptyState title="No transactions this month" text="Start by adding income or an expense." />}
          </div>
        </Card>

        <Card title="Daily focus">
          <div className="focus-card-body">
            <div className="focus-score"><strong>{focusDays}</strong><span>focused days</span></div>
            <div className="focus-copy"><strong>Main priority completed</strong><span>Mark a day when you finish the one task that matters most.</span></div>
          </div>
          <div className="progress-list compact-progress">
            <div className="progress-row"><span>Consistency</span><div className="progress-track"><div className="progress-fill accent-green" style={{ width: `${focusProgress}%` }} /></div><strong>{focusProgress}%</strong></div>
          </div>
        </Card>

        <Card title="Habit progress">
          <div className="habit-overview-grid">
            {overviewHabits.map((habit) => {
              const done = completionCount(habit.completions, monthKey);
              const progress = clampPercentage((done / Math.max(habit.targetDays, 1)) * 100);
              return (
                <div className="habit-overview-item" key={habit.id}>
                  <div className="habit-overview-top"><div><span>{habit.name}</span><strong>{done} / {habit.targetDays} days</strong></div><b>{progress}%</b></div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                </div>
              );
            })}
            {!overviewHabits.length && <EmptyState title="No habits yet" text="Create a tracker to start building consistency." />}
          </div>
          <Link href="/trackers" className="button secondary full card-action">Open daily trackers</Link>
        </Card>

        <Card title="Consistency trend" eyebrow="Cumulative completed days" className="span-2">
          {overviewHabits.length ? <LineChart data={habitTrend} series={[{ key: "primary", label: firstHabit?.name ?? "Habit" }, ...(secondHabit ? [{ key: "secondary", label: secondHabit.name }] : [])]} valueFormatter={(value) => `${Math.round(value)}`} /> : <EmptyState title="No habit data" text="Add a habit to build a consistency trend." />}
        </Card>

        <Card title="Monthly goals">
          <div className="progress-list">
            <div className="progress-row"><span>Savings</span><div className="progress-track"><div className="progress-fill" style={{ width: `${financeProgress}%` }} /></div><strong>{financeProgress}%</strong></div>
            <div className="progress-row"><span>Daily focus</span><div className="progress-track"><div className="progress-fill accent-green" style={{ width: `${focusProgress}%` }} /></div><strong>{focusProgress}%</strong></div>
            <div className="progress-row"><span>Portfolio</span><div className="progress-track"><div className="progress-fill accent-lavender" style={{ width: `${portfolioGoalProgress}%` }} /></div><strong>{portfolio.goal ? `${portfolioGoalProgress}%` : "Set goal"}</strong></div>
          </div>
          <Link href="/portfolio" className="text-button card-action">Review portfolio goal →</Link>
        </Card>
      </div>
    </>
  );
}
