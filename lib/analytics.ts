import type { Holding, MainCategory, TrackerState, Transaction } from "./types";

export type DateRange = { from: string; to: string };
export type SipInstallment = { month: string; date: string; amount: number };
export type ReturnHorizon = 3 | 6 | 12 | 36 | 60;

export const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);

export const compactCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", style: "currency", currency: "INR", maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);

const SMALL_NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
];
const TENS_NUMBER_WORDS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function wordsBelowThousand(input: number) {
  let value = Math.floor(Math.abs(input));
  const words: string[] = [];
  if (value >= 100) {
    words.push(`${SMALL_NUMBER_WORDS[Math.floor(value / 100)]} hundred`);
    value %= 100;
  }
  if (value >= 20) {
    const tens = TENS_NUMBER_WORDS[Math.floor(value / 10)];
    const units = value % 10;
    words.push(units ? `${tens}-${SMALL_NUMBER_WORDS[units]}` : tens);
  } else if (value > 0) {
    words.push(SMALL_NUMBER_WORDS[value]);
  }
  return words.join(" ");
}

/** Human-readable Indian-numbering text for portfolio amounts. */
export function rupeesInWords(input: number) {
  if (!Number.isFinite(input)) return "zero rupees";
  const negative = input < 0;
  let value = Math.round(Math.abs(input));
  if (value === 0) return "zero rupees";

  const groups = [
    { value: 10_000_000_000, label: "arab" },
    { value: 10_000_000, label: "crore" },
    { value: 100_000, label: "lakh" },
    { value: 1_000, label: "thousand" }
  ];
  const words: string[] = [];
  for (const group of groups) {
    if (value >= group.value) {
      const count = Math.floor(value / group.value);
      words.push(`${wordsBelowThousand(count)} ${group.label}`);
      value %= group.value;
    }
  }
  if (value > 0) words.push(wordsBelowThousand(value));
  return `${negative ? "minus " : ""}${words.join(" ")} rupees`;
}

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
  return toMonthInput(new Date(year, month - 2, 1));
}

export function monthLabel(monthKey = toMonthInput(), short = false) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: short ? "short" : "long", year: "numeric" }).format(new Date(year, month - 1, 1));
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

function compareMonth(a: string, b: string) {
  return a.localeCompare(b);
}

export function addMonthsToKey(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  return toMonthInput(new Date(year, month - 1 + amount, 1));
}

export function monthsBetweenKeys(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + toMonth - fromMonth;
}

function monthKeysBetween(from: string, to: string) {
  if (from > to) return [];
  const result: string[] = [];
  for (let month = from; month <= to; month = addMonthsToKey(month, 1)) result.push(month);
  return result;
}

export function sipAmountForMonth(holding: Holding, monthKey: string) {
  if (!holding.sip.enabled || holding.sip.amount <= 0 || !holding.sip.startDate) return 0;
  const startMonth = holding.sip.startDate.slice(0, 7);
  const elapsed = monthsBetweenKeys(startMonth, monthKey);
  if (elapsed < 0) return 0;
  const stepCount = Math.floor(elapsed / 12);
  const multiplier = Math.pow(1 + Math.max(0, holding.sip.stepUpPercent || 0) / 100, stepCount);
  return Math.round(holding.sip.amount * multiplier * 100) / 100;
}

function installmentForMonth(holding: Holding, month: string): SipInstallment | null {
  if (!holding.sip.enabled || holding.sip.amount <= 0) return null;
  const lastPaidMonth = holding.sip.lastPaidMonth;
  if (lastPaidMonth && month <= lastPaidMonth) return null;
  const effectiveStartDate = holding.sip.trackingStartDate || holding.sip.startDate;
  if (!effectiveStartDate) return null;
  const effectiveStartMonth = effectiveStartDate.slice(0, 7);
  if (month < effectiveStartMonth) return null;

  const amount = sipAmountForMonth(holding, month);
  if (amount <= 0) return null;

  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const day = Math.min(Math.max(holding.sip.dayOfMonth || 1, 1), lastDay);
  const date = `${month}-${String(day).padStart(2, "0")}`;
  if (date < effectiveStartDate) return null;
  return { month, date, amount };
}

export function sipInstallmentsThrough(holding: Holding, asOfDate = toDateInput()): SipInstallment[] {
  if (!holding.sip.enabled || holding.sip.amount <= 0 || !holding.sip.startDate) return [];
  const startMonth = holding.sip.startDate.slice(0, 7);
  const endMonth = asOfDate.slice(0, 7);
  if (startMonth > endMonth) return [];

  return monthKeysBetween(startMonth, endMonth).flatMap((month) => {
    const installment = installmentForMonth(holding, month);
    return installment && installment.date <= asOfDate ? [installment] : [];
  });
}

export function sipInstallmentsForYear(holding: Holding, year: number): SipInstallment[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)
    .flatMap((month) => {
      const installment = installmentForMonth(holding, month);
      return installment ? [installment] : [];
    });
}

export function sipHistoricalCutoffMonth(holding: Holding) {
  if (holding.sip.lastPaidMonth) return holding.sip.lastPaidMonth;
  const trackingMonth = (holding.sip.trackingStartDate || holding.sip.startDate || "").slice(0, 7);
  return trackingMonth ? addMonthsToKey(trackingMonth, -1) : "";
}

export function recordedSipTransactionsForHolding(
  transactions: Transaction[],
  holding: Holding,
  asOfDate = toDateInput()
) {
  const prefix = `sip-${holding.id}-`;
  const historicalCutoff = sipHistoricalCutoffMonth(holding);
  return transactions.filter((transaction) => {
    if (transaction.type !== "investment" || !transaction.id.startsWith(prefix) || transaction.date > asOfDate) return false;
    const transactionMonth = transaction.date.slice(0, 7);
    // Opening invested totals already include all historical SIPs. Ignore legacy
    // auto-created transactions from those months so they cannot be counted twice.
    return !historicalCutoff || transactionMonth > historicalCutoff;
  });
}

export function holdingInvestedAt(
  holding: Holding,
  asOfDate = toDateInput(),
  transactions: Transaction[] = []
) {
  const initial = holding.investmentDate <= asOfDate ? holding.invested : 0;
  const additions = holding.additionalInvestments
    .filter((entry) => entry.date <= asOfDate)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const paidSip = recordedSipTransactionsForHolding(transactions, holding, asOfDate)
    .reduce((sum, entry) => sum + entry.amount, 0);
  return initial + additions + paidSip;
}

export function holdingValueAtMonth(holding: Holding, monthKey = toMonthInput()) {
  if (holding.investmentDate.slice(0, 7) > monthKey) return 0;
  const points = [...holding.monthlyValues].sort((a, b) => compareMonth(a.month, b.month));
  const latest = points.filter((point) => point.month <= monthKey).at(-1);
  if (latest) return latest.value;
  return monthKey === toMonthInput() ? holding.currentValue : 0;
}

function cashFlowDate(value: string) {
  return new Date(`${value}T12:00:00`).getTime();
}

function xnpv(rate: number, flows: Array<{ date: string; amount: number }>) {
  if (rate <= -0.999999 || !flows.length) return Number.POSITIVE_INFINITY;
  const first = cashFlowDate(flows[0].date);
  return flows.reduce((sum, flow) => {
    const years = (cashFlowDate(flow.date) - first) / (365 * 24 * 60 * 60 * 1000);
    return sum + flow.amount / Math.pow(1 + rate, years);
  }, 0);
}

export function xirr(flows: Array<{ date: string; amount: number }>) {
  const sorted = flows.filter((flow) => Number.isFinite(flow.amount) && flow.amount !== 0).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2 || !sorted.some((flow) => flow.amount < 0) || !sorted.some((flow) => flow.amount > 0)) return 0;

  let rate = 0.1;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const value = xnpv(rate, sorted);
    const epsilon = 0.00001;
    const derivative = (xnpv(rate + epsilon, sorted) - value) / epsilon;
    if (!Number.isFinite(value) || !Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) break;
    const next = Math.max(-0.9999, Math.min(100, rate - value / derivative));
    if (Math.abs(next - rate) < 1e-7) return next * 100;
    rate = next;
  }
  return Number.isFinite(rate) ? rate * 100 : 0;
}

export function holdingCashFlows(
  holding: Holding,
  monthKey = toMonthInput(),
  transactions: Transaction[] = []
) {
  const asOfDate = rangeForMonth(monthKey).to;
  const currentValue = holdingValueAtMonth(holding, monthKey);
  const flows: Array<{ date: string; amount: number }> = [];
  if (holding.investmentDate <= asOfDate && holding.invested > 0) flows.push({ date: holding.investmentDate, amount: -holding.invested });
  holding.additionalInvestments.filter((entry) => entry.date <= asOfDate).forEach((entry) => flows.push({ date: entry.date, amount: -entry.amount }));
  recordedSipTransactionsForHolding(transactions, holding, asOfDate)
    .forEach((entry) => flows.push({ date: entry.date, amount: -entry.amount }));
  if (currentValue > 0) flows.push({ date: asOfDate, amount: currentValue });
  return flows.sort((a, b) => a.date.localeCompare(b.date));
}

export function holdingReturn(
  holding: Holding,
  monthKey = toMonthInput(),
  transactions: Transaction[] = []
) {
  const asOfDate = rangeForMonth(monthKey).to;
  const invested = holdingInvestedAt(holding, asOfDate, transactions);
  const current = holdingValueAtMonth(holding, monthKey);
  const gain = current - invested;
  return {
    invested,
    current,
    gain,
    gainPercent: invested ? (gain / invested) * 100 : 0,
    xirr: xirr(holdingCashFlows(holding, monthKey, transactions))
  };
}

function holdingContributionsBetween(
  holding: Holding,
  fromExclusive: string,
  toInclusive: string,
  transactions: Transaction[] = []
) {
  let total = 0;
  if (holding.investmentDate > fromExclusive && holding.investmentDate <= toInclusive) total += holding.invested;
  total += holding.additionalInvestments
    .filter((entry) => entry.date > fromExclusive && entry.date <= toInclusive)
    .reduce((sum, entry) => sum + entry.amount, 0);
  total += recordedSipTransactionsForHolding(transactions, holding, toInclusive)
    .filter((entry) => entry.date > fromExclusive)
    .reduce((sum, entry) => sum + entry.amount, 0);
  return total;
}

export function holdingPeriodReturn(
  holding: Holding,
  endMonth: string,
  months: ReturnHorizon,
  transactions: Transaction[] = []
) {
  const startMonth = addMonthsToKey(endMonth, -months);
  const startValue = holdingValueAtMonth(holding, startMonth);
  const endValue = holdingValueAtMonth(holding, endMonth);
  if (startValue <= 0 || endValue <= 0) return null;
  const contributions = holdingContributionsBetween(
    holding,
    rangeForMonth(startMonth).to,
    rangeForMonth(endMonth).to,
    transactions
  );
  return ((endValue - startValue - contributions) / startValue) * 100;
}

export function portfolioPeriodReturn(state: TrackerState, endMonth: string, months: ReturnHorizon) {
  const startMonth = addMonthsToKey(endMonth, -months);
  const startValue = state.holdings.reduce((sum, holding) => sum + holdingValueAtMonth(holding, startMonth), 0);
  const endValue = state.holdings.reduce((sum, holding) => sum + holdingValueAtMonth(holding, endMonth), 0);
  if (startValue <= 0 || endValue <= 0) return null;
  const from = rangeForMonth(startMonth).to;
  const to = rangeForMonth(endMonth).to;
  const contributions = state.holdings.reduce((sum, holding) => sum + holdingContributionsBetween(holding, from, to, state.transactions), 0);
  return ((endValue - startValue - contributions) / startValue) * 100;
}

export function holdingTrendRate(holding: Holding, endMonth = toMonthInput(), transactions: Transaction[] = []) {
  const candidates: ReturnHorizon[] = [12, 6, 3];
  for (const period of candidates) {
    const result = holdingPeriodReturn(holding, endMonth, period, transactions);
    if (result === null || !Number.isFinite(result) || result <= -100) continue;
    const annualized = (Math.pow(1 + result / 100, 12 / period) - 1) * 100;
    return Math.max(-50, Math.min(50, annualized));
  }
  const xirrValue = holdingReturn(holding, endMonth, transactions).xirr;
  return Number.isFinite(xirrValue) && xirrValue !== 0 ? Math.max(-50, Math.min(50, xirrValue)) : null;
}

export function portfolioTotals(state: TrackerState, monthKey = toMonthInput()) {
  const asOfDate = rangeForMonth(monthKey).to;
  const invested = state.holdings.reduce((sum, holding) => sum + holdingInvestedAt(holding, asOfDate, state.transactions), 0);
  const current = state.holdings.reduce((sum, holding) => sum + holdingValueAtMonth(holding, monthKey), 0);
  const gain = current - invested;
  const flows = state.holdings.flatMap((holding) => holdingCashFlows(holding, monthKey, state.transactions).filter((flow) => flow.amount < 0));
  if (current > 0) flows.push({ date: asOfDate, amount: current });
  const goal = state.preferences.portfolioGoalAmount || 0;
  return {
    invested,
    current,
    gain,
    gainPercent: invested ? (gain / invested) * 100 : 0,
    xirr: xirr(flows),
    goal,
    goalProgress: goal ? Math.min(100, (current / goal) * 100) : 0,
    monthlySip: state.holdings.reduce((sum, holding) => sum + sipAmountForMonth(holding, monthKey), 0)
  };
}

export function portfolioSeries(state: TrackerState, throughMonth = toMonthInput()) {
  if (!state.holdings.length) return [];
  const candidates = state.holdings.flatMap((holding) => [
    holding.investmentDate.slice(0, 7),
    holding.sip.startDate?.slice(0, 7),
    ...holding.additionalInvestments.map((entry) => entry.date.slice(0, 7)),
    ...holding.monthlyValues.map((point) => point.month)
  ].filter(Boolean));
  const first = candidates.sort()[0] ?? throughMonth;
  return monthKeysBetween(first, throughMonth).map((month) => {
    const totalsForMonth = portfolioTotals(state, month);
    return {
      label: monthLabel(month, true),
      month,
      value: totalsForMonth.current,
      invested: totalsForMonth.invested,
      goal: state.preferences.portfolioGoalAmount || 0
    };
  });
}

export function portfolioAllocation(state: TrackerState, monthKey = toMonthInput()) {
  const values = new Map<string, number>();
  state.holdings.forEach((holding) => {
    const value = holdingValueAtMonth(holding, monthKey);
    const isFund = holding.assetClass === "Mutual Fund" || holding.assetClass === "ETF";
    const breakdown = isFund && holding.allocationBreakdown.length
      ? holding.allocationBreakdown
      : [{ category: holding.fundCategory ?? holding.assetClass, percentage: 100 }];

    breakdown.forEach((entry) => {
      const percentage = Math.max(0, Number(entry.percentage) || 0);
      values.set(entry.category, (values.get(entry.category) ?? 0) + value * (percentage / 100));
    });
  });
  return [...values.entries()].map(([label, value]) => ({ label, value })).filter((entry) => entry.value > 0).sort((a, b) => b.value - a.value);
}

export function futureValueWithSip(
  startingValue: number,
  monthlyContribution: number,
  annualReturnPercent: number,
  months: number,
  annualStepUpPercent = 0
) {
  const monthlyRate = Math.pow(1 + annualReturnPercent / 100, 1 / 12) - 1;
  let value = Math.max(0, startingValue);
  let contribution = Math.max(0, monthlyContribution);
  for (let index = 0; index < Math.max(0, months); index += 1) {
    value = value * (1 + monthlyRate) + contribution;
    if ((index + 1) % 12 === 0) contribution *= 1 + Math.max(0, annualStepUpPercent) / 100;
  }
  return value;
}

function monthsUntilDate(targetDate: string, fromMonth: string) {
  if (!targetDate) return 0;
  const targetMonth = targetDate.slice(0, 7);
  return Math.max(0, monthsBetweenKeys(fromMonth, targetMonth));
}

export function weightedExpectedReturn(state: TrackerState, monthKey = toMonthInput()) {
  const total = state.holdings.reduce((sum, holding) => sum + holdingValueAtMonth(holding, monthKey), 0);
  if (total <= 0) return state.preferences.portfolioExpectedReturn || 12;
  return state.holdings.reduce((sum, holding) => {
    const value = holdingValueAtMonth(holding, monthKey);
    const trend = holdingTrendRate(holding, monthKey, state.transactions);
    const assumed = trend ?? holding.expectedAnnualReturn ?? state.preferences.portfolioExpectedReturn ?? 12;
    return sum + assumed * (value / total);
  }, 0);
}

export function requiredMonthlySipForGoal(
  currentValue: number,
  goalValue: number,
  annualReturnPercent: number,
  months: number,
  annualStepUpPercent = 0
) {
  if (goalValue <= currentValue || months <= 0) return 0;
  let low = 0;
  let high = Math.max(goalValue / Math.max(months, 1), 1000);
  while (futureValueWithSip(currentValue, high, annualReturnPercent, months, annualStepUpPercent) < goalValue && high < goalValue * 2) high *= 2;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const mid = (low + high) / 2;
    if (futureValueWithSip(currentValue, mid, annualReturnPercent, months, annualStepUpPercent) >= goalValue) high = mid;
    else low = mid;
  }
  return high;
}

export function portfolioGoalProjection(state: TrackerState, monthKey = toMonthInput()) {
  const totalsForMonth = portfolioTotals(state, monthKey);
  const months = monthsUntilDate(state.preferences.portfolioGoalDate, monthKey);
  const expectedReturn = weightedExpectedReturn(state, monthKey);
  const stepUp = state.preferences.portfolioDefaultStepUpPercent || 0;
  const projectedValue = futureValueWithSip(totalsForMonth.current, totalsForMonth.monthlySip, expectedReturn, months, stepUp);
  const requiredMonthly = requiredMonthlySipForGoal(totalsForMonth.current, totalsForMonth.goal, expectedReturn, months, stepUp);
  return {
    ...totalsForMonth,
    months,
    expectedReturn,
    stepUp,
    projectedValue,
    currentGap: Math.max(0, totalsForMonth.goal - totalsForMonth.current),
    projectedGap: Math.max(0, totalsForMonth.goal - projectedValue),
    requiredMonthly,
    monthlyIncrease: Math.max(0, requiredMonthly - totalsForMonth.monthlySip)
  };
}

export function holdingGoalProjection(
  holding: Holding,
  monthKey = toMonthInput(),
  targetDate = "",
  transactions: Transaction[] = []
) {
  const result = holdingReturn(holding, monthKey, transactions);
  const target = holding.goalAmount || 0;
  const months = monthsUntilDate(targetDate, monthKey);
  const trend = holdingTrendRate(holding, monthKey, transactions);
  const rate = trend ?? holding.expectedAnnualReturn ?? 12;
  const monthlySip = sipAmountForMonth(holding, monthKey);
  const projectedValue = futureValueWithSip(result.current, monthlySip, rate, months, holding.sip.stepUpPercent || 0);
  const requiredMonthly = requiredMonthlySipForGoal(result.current, target, rate, months, holding.sip.stepUpPercent || 0);
  return {
    target,
    current: result.current,
    gap: Math.max(0, target - result.current),
    months,
    rate,
    trend,
    monthlySip,
    projectedValue,
    projectedGap: Math.max(0, target - projectedValue),
    requiredMonthly,
    monthlyIncrease: Math.max(0, requiredMonthly - monthlySip)
  };
}

export function portfolioProjectionSeries(state: TrackerState, monthKey = toMonthInput()) {
  const historical = portfolioSeries(state, monthKey);
  if (!historical.length) return [];
  const goal = portfolioGoalProjection(state, monthKey);
  const horizon = goal.months > 0 ? Math.min(goal.months, 120) : 12;
  const rows = historical.map((row) => ({ ...row, projection: row.value }));
  let value = goal.current;
  let invested = goal.invested;
  let contribution = goal.monthlySip;
  const monthlyRate = Math.pow(1 + goal.expectedReturn / 100, 1 / 12) - 1;

  for (let index = 1; index <= horizon; index += 1) {
    const futureMonth = addMonthsToKey(monthKey, index);
    value = value * (1 + monthlyRate) + contribution;
    invested += contribution;
    rows.push({
      label: monthLabel(futureMonth, true),
      month: futureMonth,
      value: goal.current,
      invested,
      goal: goal.goal,
      projection: value
    });
    if (index % 12 === 0) contribution *= 1 + goal.stepUp / 100;
  }
  return rows;
}

export function yearlySipSummary(state: TrackerState, year: number) {
  const monthKeys = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  const rows = state.holdings
    .filter((holding) => holding.sip.enabled)
    .map((holding) => {
      const installments = sipInstallmentsForYear(holding, year);
      const amounts = Object.fromEntries(monthKeys.map((month) => [month, installments.find((entry) => entry.month === month)?.amount ?? 0]));
      return {
        holding,
        amounts,
        total: Object.values(amounts).reduce((sum, amount) => sum + amount, 0)
      };
    });
  return {
    months: monthKeys,
    rows,
    total: rows.reduce((sum, row) => sum + row.total, 0)
  };
}

export function projectedYearEndForHolding(holding: Holding, year: number, monthKey = toMonthInput()) {
  const yearEndMonth = `${year}-12`;
  const baseMonth = monthKey > yearEndMonth ? yearEndMonth : monthKey;
  const current = holdingValueAtMonth(holding, baseMonth);
  const remainingMonths = Math.max(0, monthsBetweenKeys(baseMonth, yearEndMonth));
  const rate = holdingTrendRate(holding, baseMonth) ?? holding.expectedAnnualReturn ?? 12;
  let value = current;
  const monthlyRate = Math.pow(1 + rate / 100, 1 / 12) - 1;
  for (let index = 1; index <= remainingMonths; index += 1) {
    const futureMonth = addMonthsToKey(baseMonth, index);
    value = value * (1 + monthlyRate) + sipAmountForMonth(holding, futureMonth);
  }
  return { current, projected: value, projectedGain: value - current, rate };
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
