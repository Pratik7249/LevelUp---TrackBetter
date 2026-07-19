import type { MainCategory, TrackerState, Transaction } from "./types";

export type DateRange = { from: string; to: string };

export const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

export const compactCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", style: "currency", currency: "INR", maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));

export const toDateInput = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toMonthInput = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export function rangeForMonth(monthKey = toMonthInput()): DateRange {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${monthKey}-01`, to: `${monthKey}-${String(lastDay).padStart(2, "0")}` };
}

export function previousMonthKey(monthKey = toMonthInput()) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return toMonthInput(date);
}

export function monthLabel(monthKey = toMonthInput()) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function filterByRange(transactions: Transaction[], range?: DateRange) {
  if (!range) return transactions;
  return transactions.filter((transaction) => transaction.date >= range.from && transaction.date <= range.to);
}

export function totalsFromTransactions(transactions: Transaction[]) {
  const income = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const investments = transactions.filter((t) => t.type === "investment").reduce((sum, t) => sum + t.amount, 0);
  const savings = income - expenses - investments;
  return { income, expenses, investments, savings, savingsRate: income ? (savings / income) * 100 : 0 };
}

export function totals(state: TrackerState, range?: DateRange) {
  return totalsFromTransactions(filterByRange(state.transactions, range));
}

export function byMainCategory(transactions: Transaction[]) {
  const values: Record<MainCategory, number> = { Needs: 0, Wants: 0, Investment: 0 };
  transactions.forEach((transaction) => {
    if (transaction.mainCategory) values[transaction.mainCategory] += transaction.amount;
  });
  return Object.entries(values).map(([label, value]) => ({ label, value }));
}

export function byCategory(transactions: Transaction[], type?: Transaction["type"]) {
  const map = new Map<string, number>();
  transactions
    .filter((transaction) => !type || transaction.type === type)
    .forEach((transaction) => map.set(transaction.category, (map.get(transaction.category) ?? 0) + transaction.amount));
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function byAccount(state: TrackerState, type?: Transaction["type"], range?: DateRange) {
  const transactions = filterByRange(state.transactions, range);
  return state.accounts.map((account) => ({
    label: account.name,
    value: transactions
      .filter((transaction) => transaction.accountId === account.id && (!type || transaction.type === type))
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  })).filter((entry) => entry.value > 0).sort((a, b) => b.value - a.value);
}

export function dailySeries(transactions: Transaction[], range = rangeForMonth()) {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T00:00:00`);
  const rows: Array<{ label: string; date: string; income: number; expense: number; investment: number }> = [];
  const map = new Map<string, (typeof rows)[number]>();

  for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
    const date = toDateInput(cursor);
    const row = { label: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(cursor), date, income: 0, expense: 0, investment: 0 };
    rows.push(row);
    map.set(date, row);
  }

  filterByRange(transactions, range).forEach((transaction) => {
    const row = map.get(transaction.date);
    if (!row) return;
    row[transaction.type] += transaction.amount;
  });

  let runningIncome = 0;
  let runningExpense = 0;
  let runningInvestment = 0;
  return rows.map((row) => {
    runningIncome += row.income;
    runningExpense += row.expense;
    runningInvestment += row.investment;
    return { label: row.label, income: runningIncome, expense: runningExpense, investment: runningInvestment };
  });
}

export function periodSpendSeries(transactions: Transaction[], range: DateRange) {
  return dailySeries(transactions, range).map((row) => ({ label: row.label, value: row.expense + row.investment }));
}

export function portfolioSeries(state: TrackerState) {
  const monthOrder: string[] = [];
  state.holdings.forEach((holding) => holding.monthlyValues.forEach((point) => {
    if (!monthOrder.includes(point.month)) monthOrder.push(point.month);
  }));

  return monthOrder.map((month) => ({
    label: month,
    value: state.holdings.reduce((sum, holding) => {
      return sum + (holding.monthlyValues.find((point) => point.month === month)?.value ?? 0);
    }, 0)
  }));
}

export function portfolioTotals(state: TrackerState) {
  const invested = state.holdings.reduce((sum, holding) => sum + holding.invested, 0);
  const current = state.holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const gain = current - invested;
  return { invested, current, gain, gainPercent: invested ? (gain / invested) * 100 : 0 };
}

export function daysInMonth(monthKey = toMonthInput()) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

export function monthCalendarLeadingDays(monthKey = toMonthInput()) {
  const [year, month] = monthKey.split("-").map(Number);
  const sundayFirst = new Date(year, month - 1, 1).getDay();
  return (sundayFirst + 6) % 7;
}

export function completionCount(values: Record<string, boolean>, monthKey = toMonthInput()) {
  return Object.entries(values).filter(([date, complete]) => complete && date.startsWith(monthKey)).length;
}

export function currentStreak(values: Record<string, boolean>, endDate = new Date()) {
  let streak = 0;
  const cursor = new Date(endDate);
  while (true) {
    const key = toDateInput(cursor);
    if (!values[key]) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function weeklyCompletion(values: Record<string, boolean>, monthKey = toMonthInput()) {
  const totalDays = daysInMonth(monthKey);
  const weeks = Array.from({ length: Math.ceil(totalDays / 7) }, (_, index) => ({ label: `Week ${index + 1}`, value: 0, total: 0 }));
  for (let day = 1; day <= totalDays; day += 1) {
    const week = weeks[Math.floor((day - 1) / 7)];
    week.total += 1;
    if (values[`${monthKey}-${String(day).padStart(2, "0")}`]) week.value += 1;
  }
  return weeks.map((week) => ({ label: week.label, value: Math.round((week.value / Math.max(week.total, 1)) * 100) }));
}

export function dailyHabitTrend(values: Record<string, boolean>, monthKey = toMonthInput()) {
  const totalDays = daysInMonth(monthKey);
  let completed = 0;
  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    if (values[`${monthKey}-${String(day).padStart(2, "0")}`]) completed += 1;
    return { label: String(day), completed };
  });
}

export function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
