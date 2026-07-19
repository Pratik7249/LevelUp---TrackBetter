"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BarChart, LineChart } from "@/components/charts";
import { Card, MetricCard, Pill } from "@/components/ui";
import {
  clampPercentage,
  completionCount,
  currentStreak,
  dailyHabitTrend,
  dailySeries,
  daysInMonth,
  monthCalendarLeadingDays,
  monthLabel,
  rangeForMonth,
  toMonthInput,
  weeklyCompletion
} from "@/lib/analytics";
import { useTracker } from "@/lib/store";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const percent = (value: number) => `${Math.round(value)}%`;

function MonthCalendar({ month, values, onToggle }: { month: string; values: Record<string, boolean>; onToggle: (date: string) => void }) {
  const leading = monthCalendarLeadingDays(month);
  const totalDays = daysInMonth(month);
  return (
    <div className="calendar">
      {weekdays.map((day) => <div className="weekday" key={day}>{day}</div>)}
      {Array.from({ length: leading }, (_, index) => <span key={`empty-${index}`} />)}
      {Array.from({ length: totalDays }, (_, index) => {
        const day = index + 1;
        const key = `${month}-${String(day).padStart(2, "0")}`;
        return <button type="button" key={key} className={`day-cell ${values[key] ? "done" : ""}`} onClick={() => onToggle(key)} aria-label={`${values[key] ? "Unmark" : "Mark"} ${key}`}>{values[key] ? "✓" : day}</button>;
      })}
    </div>
  );
}

export default function TrackersPage() {
  const { state, toggleHabit, toggleDailyCheckin, addHabit, removeHabit } = useTracker();
  const [month, setMonth] = useState(toMonthInput());
  const [habitId, setHabitId] = useState(state.habits[0]?.id ?? "");
  const [newHabit, setNewHabit] = useState("");
  const [targetDays, setTargetDays] = useState("20");
  const habit = state.habits.find((item) => item.id === habitId) ?? state.habits[0];

  useEffect(() => {
    if (habit && !state.habits.some((item) => item.id === habitId)) setHabitId(habit.id);
  }, [habit, habitId, state.habits]);

  const done = completionCount(habit?.completions ?? {}, month);
  const focusDone = completionCount(state.dailyCheckins, month);
  const target = habit?.targetDays ?? 20;
  const totalDays = daysInMonth(month);
  const monthEnd = new Date(`${rangeForMonth(month).to}T23:59:59`);
  const streakEnd = month === toMonthInput() ? new Date() : monthEnd;
  const streak = currentStreak(habit?.completions ?? {}, streakEnd);
  const consistency = clampPercentage((done / Math.max(target, 1)) * 100);
  const focusConsistency = clampPercentage((focusDone / Math.max(totalDays, 1)) * 100);
  const habitTrend = dailyHabitTrend(habit?.completions ?? {}, month).map((row) => ({ label: row.label, completed: row.completed }));
  const focusTrend = dailyHabitTrend(state.dailyCheckins, month).map((row) => ({ label: row.label, focused: row.completed }));
  const spendingTrend = useMemo(() => dailySeries(state.transactions, rangeForMonth(month)).map((row) => ({ label: row.label, spending: row.expense + row.investment })), [month, state.transactions]);

  function submitHabit(event: FormEvent) {
    event.preventDefault();
    const numericTarget = Number(targetDays);
    if (!newHabit.trim() || numericTarget < 1) return;
    addHabit({ name: newHabit.trim(), targetDays: numericTarget });
    setNewHabit("");
    setTargetDays("20");
  }

  return (
    <>
      <div className="page-heading">
        <div><h2>Daily trackers</h2><p>Build habits and mark the days when you completed your most important task.</p></div>
        <input className="month-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>

      <div className="grid four">
        <MetricCard icon="DN" label={`${habit?.name ?? "Habit"} completed`} value={`${done} days`} change={`${consistency}% of target`} />
        <MetricCard icon="ST" label="Current streak" value={`${streak} days`} />
        <MetricCard icon="DF" label="Daily focus" value={`${focusDone} days`} change={`${focusConsistency}% consistency`} />
        <MetricCard icon="TG" label="Monthly target" value={`${target} days`} change={monthLabel(month)} />
      </div>

      <div className="grid two section-gap">
        <Card title="Habit calendar" action={<div className="tabs wrap-tabs">{state.habits.map((item) => <button type="button" key={item.id} className={habitId === item.id ? "active" : ""} onClick={() => setHabitId(item.id)}>{item.name}</button>)}</div>}>
          <MonthCalendar month={month} values={habit?.completions ?? {}} onToggle={(date) => habit && toggleHabit(habit.id, date)} />
          <div className="summary-strip card-action"><div><span>Done</span><strong>{done}</strong></div><div><span>Remaining</span><strong>{Math.max(target - done, 0)}</strong></div><div><span>Target</span><strong>{target} days</strong></div></div>
        </Card>

        <Card title="Daily focus check-in" eyebrow="Main priority completed">
          <div className="notice soft-note">Tick a day when you finish the one task that creates the most progress.</div>
          <div className="card-action"><MonthCalendar month={month} values={state.dailyCheckins} onToggle={toggleDailyCheckin} /></div>
          <div className="summary-strip card-action"><div><span>Focused days</span><strong>{focusDone}</strong></div><div><span>Open days</span><strong>{totalDays - focusDone}</strong></div><div><span>Consistency</span><strong>{focusConsistency}%</strong></div></div>
        </Card>

        <Card title="Weekly habit completion" eyebrow={habit?.name}>{habit ? <BarChart data={weeklyCompletion(habit.completions, month)} valueFormatter={percent} /> : null}</Card>
        <Card title="Focus consistency" eyebrow="Weekly completion"><BarChart data={weeklyCompletion(state.dailyCheckins, month)} valueFormatter={percent} /></Card>
        <Card title="Habit progress line" eyebrow="Cumulative"><LineChart data={habitTrend} series={[{ key: "completed", label: habit?.name ?? "Habit" }]} valueFormatter={(value) => String(Math.round(value))} /></Card>
        <Card title="Daily focus progress line" eyebrow="Cumulative"><LineChart data={focusTrend} series={[{ key: "focused", label: "Focused days" }]} valueFormatter={(value) => String(Math.round(value))} /></Card>
        <Card title="Monthly spending trend" className="span-2"><LineChart data={spendingTrend} series={[{ key: "spending", label: "Expenses + investments" }]} /></Card>

        <Card title="Add a tracker">
          <form className="form-grid" onSubmit={submitHabit}>
            <div className="field full"><label>Tracker name</label><input value={newHabit} onChange={(event) => setNewHabit(event.target.value)} placeholder="Reading, Coding, Gym" /></div>
            <div className="field"><label>Monthly target days</label><input type="number" min="1" max="31" value={targetDays} onChange={(event) => setTargetDays(event.target.value)} /></div>
            <div className="field align-end"><button className="button full">Add tracker</button></div>
          </form>
        </Card>

        <Card title="Manage trackers">
          <div className="list">{state.habits.map((item) => <div className="list-item" key={item.id}><div><strong>{item.name}</strong><span>Target: {item.targetDays} days</span></div><div className="row-actions"><Pill>{completionCount(item.completions, month)} done</Pill><button className="text-button danger-text" disabled={state.habits.length <= 1} onClick={() => removeHabit(item.id)}>Delete</button></div></div>)}</div>
        </Card>
      </div>
    </>
  );
}
