import type { FundAllocation, FundCategory, Holding, TrackerState } from "./types";

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKeyFromUnknown(value: unknown) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  const parsed = new Date(`1 ${text}`);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }
  return todayKey().slice(0, 7);
}

function normalizedAllocation(
  raw: unknown,
  fallback?: FundCategory
): FundAllocation[] {
  const rows = Array.isArray(raw)
    ? raw
        .map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            category: String(item.category ?? "Other") as FundCategory,
            percentage: Math.max(0, Number(item.percentage ?? 0) || 0)
          };
        })
        .filter((entry) => entry.percentage > 0)
    : [];

  if (rows.length) return rows;
  return fallback ? [{ category: fallback, percentage: 100 }] : [];
}

function normalizeReturnNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHolding(value: Partial<Holding> & Record<string, unknown>): Holding {
  const investmentDate = typeof value.investmentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.investmentDate)
    ? value.investmentDate
    : todayKey();
  const currentMonth = investmentDate.slice(0, 7);
  const monthlyValues = Array.isArray(value.monthlyValues)
    ? value.monthlyValues
        .map((point) => {
          const item = point as { month?: unknown; value?: unknown };
          return { month: monthKeyFromUnknown(item.month), value: Number(item.value ?? 0) || 0 };
        })
        .filter((point) => point.value >= 0)
    : [];
  const currentValue = Number(value.currentValue ?? 0) || 0;
  if (!monthlyValues.some((point) => point.month === currentMonth) && currentValue > 0) {
    monthlyValues.push({ month: currentMonth, value: currentValue });
  }

  const sipValue = value.sip && typeof value.sip === "object" ? value.sip as Record<string, unknown> : {};
  const fundCategory = value.fundCategory as Holding["fundCategory"];

  return {
    id: String(value.id ?? `holding-${Date.now()}`),
    name: String(value.name ?? "Holding"),
    ...(value.symbol ? { symbol: String(value.symbol) } : {}),
    assetClass: (value.assetClass ?? "Mutual Fund") as Holding["assetClass"],
    ...(fundCategory ? { fundCategory } : {}),
    allocationBreakdown: normalizedAllocation(value.allocationBreakdown, fundCategory),
    investmentDate,
    invested: Number(value.invested ?? 0) || 0,
    currentValue,
    goalAmount: Number(value.goalAmount ?? 0) || 0,
    expectedAnnualReturn: Number(value.expectedAnnualReturn ?? 12) || 12,
    returnSnapshot: (() => {
      const snapshot = value.returnSnapshot && typeof value.returnSnapshot === "object"
        ? value.returnSnapshot as Record<string, unknown>
        : {};
      return {
        asOfMonth: typeof snapshot.asOfMonth === "string" && /^\d{4}-\d{2}$/.test(snapshot.asOfMonth)
          ? snapshot.asOfMonth
          : currentMonth,
        oneMonth: normalizeReturnNumber(snapshot.oneMonth),
        threeMonth: normalizeReturnNumber(snapshot.threeMonth),
        sixMonth: normalizeReturnNumber(snapshot.sixMonth),
        oneYear: normalizeReturnNumber(snapshot.oneYear),
        threeYear: normalizeReturnNumber(snapshot.threeYear),
        fiveYear: normalizeReturnNumber(snapshot.fiveYear),
        allTime: normalizeReturnNumber(snapshot.allTime)
      };
    })(),
    monthlyValues: monthlyValues.sort((a, b) => a.month.localeCompare(b.month)),
    additionalInvestments: Array.isArray(value.additionalInvestments)
      ? value.additionalInvestments.map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            id: String(item.id ?? `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
            date: String(item.date ?? investmentDate),
            amount: Number(item.amount ?? 0) || 0,
            ...(item.label ? { label: String(item.label) } : {})
          };
        }).filter((entry) => entry.amount > 0)
      : [],
    sip: {
      enabled: Boolean(sipValue.enabled),
      amount: Number(sipValue.amount ?? 0) || 0,
      ...(typeof sipValue.originalStartMonth === "string" && /^\d{4}-\d{2}$/.test(sipValue.originalStartMonth)
        ? { originalStartMonth: sipValue.originalStartMonth }
        : {}),
      ...(Number(sipValue.previousAmount ?? 0) > 0
        ? { previousAmount: Number(sipValue.previousAmount) }
        : {}),
      ...(typeof sipValue.lastPaidMonth === "string" && /^\d{4}-\d{2}$/.test(sipValue.lastPaidMonth)
        ? { lastPaidMonth: sipValue.lastPaidMonth }
        : {}),
      startDate: typeof sipValue.startDate === "string" ? sipValue.startDate : investmentDate,
      trackingStartDate: typeof sipValue.trackingStartDate === "string"
        ? sipValue.trackingStartDate
        : todayKey(),
      dayOfMonth: Math.min(28, Math.max(1, Number(sipValue.dayOfMonth ?? 1) || 1)),
      accountId: String(sipValue.accountId ?? ""),
      stepUpPercent: Math.max(0, Number(sipValue.stepUpPercent ?? 0) || 0)
    }
  };
}

export const defaultState: TrackerState = {
  schemaVersion: 4,
  accounts: [
    { id: "cash", name: "Cash", type: "cash", balance: 0 }
  ],
  categories: [
    { id: "food", name: "Food & Dining", mainCategory: "Needs", subcategories: ["Groceries", "Mess", "Restaurant", "Snacks"] },
    { id: "transport", name: "Transport", mainCategory: "Needs", subcategories: ["Fuel", "Cab", "Public Transport", "Service"] },
    { id: "bills", name: "Bills & Utilities", mainCategory: "Needs", subcategories: ["Electricity", "Internet", "Mobile", "Rent"] },
    { id: "shopping", name: "Shopping", mainCategory: "Wants", subcategories: ["Clothing", "Electronics", "Accessories"] },
    { id: "entertainment", name: "Entertainment", mainCategory: "Wants", subcategories: ["Movies", "Subscriptions", "Travel"] },
    { id: "health", name: "Health", mainCategory: "Needs", subcategories: ["Gym", "Medicine", "Healthcare"] },
    { id: "mutual-funds", name: "Mutual Funds", mainCategory: "Investment", subcategories: ["SIP", "Lump Sum", "Additional Investment"] },
    { id: "stocks", name: "Stocks", mainCategory: "Investment", subcategories: ["Indian Equity", "US Equity", "ETF"] }
  ],
  transactions: [],
  holdings: [],
  habits: [
    { id: "running", name: "Running", targetDays: 20, completions: {} },
    { id: "learning", name: "Learning", targetDays: 20, completions: {} }
  ],
  dailyCheckins: {},
  reportSettings: {
    email: "",
    enabled: false,
    fortnightly: true,
    monthEnd: true
  },
  preferences: {
    theme: "system",
    currency: "INR",
    timezone: "Asia/Kolkata",
    portfolioGoalAmount: 0,
    portfolioGoalDate: "",
    portfolioExpectedReturn: 12,
    portfolioDefaultStepUpPercent: 10,
    portfolioGoals: []
  }
};

export function cloneDefaultState(): TrackerState {
  return JSON.parse(JSON.stringify(defaultState)) as TrackerState;
}

export function normalizeState(value: Partial<TrackerState> & { messCompletions?: Record<string, boolean> } | null | undefined): TrackerState {
  const base = cloneDefaultState();
  if (!value || typeof value !== "object") return base;

  return {
    schemaVersion: 4,
    accounts: Array.isArray(value.accounts) && value.accounts.length ? value.accounts : base.accounts,
    categories: Array.isArray(value.categories) && value.categories.length ? value.categories : base.categories,
    transactions: Array.isArray(value.transactions) ? value.transactions : base.transactions,
    holdings: Array.isArray(value.holdings)
      ? value.holdings.map((holding) => normalizeHolding(holding as Partial<Holding> & Record<string, unknown>))
      : base.holdings,
    habits: Array.isArray(value.habits) && value.habits.length ? value.habits : base.habits,
    dailyCheckins: value.dailyCheckins && typeof value.dailyCheckins === "object" ? value.dailyCheckins : {},
    reportSettings: {
      ...base.reportSettings,
      ...(value.reportSettings ?? {})
    },
    preferences: {
      ...base.preferences,
      ...(value.preferences ?? {}),
      portfolioGoalAmount: Number(value.preferences?.portfolioGoalAmount ?? 0) || 0,
      portfolioGoalDate: String(value.preferences?.portfolioGoalDate ?? ""),
      portfolioExpectedReturn: Number(value.preferences?.portfolioExpectedReturn ?? base.preferences.portfolioExpectedReturn) || base.preferences.portfolioExpectedReturn,
      portfolioDefaultStepUpPercent: Math.max(0, Number(value.preferences?.portfolioDefaultStepUpPercent ?? base.preferences.portfolioDefaultStepUpPercent) || 0),
      portfolioGoals: Array.isArray(value.preferences?.portfolioGoals)
        ? value.preferences.portfolioGoals.map((goal) => ({
            id: String((goal as { id?: unknown }).id ?? `goal-${Math.random().toString(36).slice(2, 8)}`),
            name: String((goal as { name?: unknown }).name ?? 'Goal'),
            targetAmount: Number((goal as { targetAmount?: unknown }).targetAmount ?? 0) || 0,
            targetDate: String((goal as { targetDate?: unknown }).targetDate ?? ''),
            expectedReturn: Number((goal as { expectedReturn?: unknown }).expectedReturn ?? base.preferences.portfolioExpectedReturn) || base.preferences.portfolioExpectedReturn,
            stepUpPercent: Math.max(0, Number((goal as { stepUpPercent?: unknown }).stepUpPercent ?? base.preferences.portfolioDefaultStepUpPercent) || 0),
            allocatedCurrentValue: Math.max(0, Number((goal as { allocatedCurrentValue?: unknown }).allocatedCurrentValue ?? 0) || 0),
            monthlyContribution: Math.max(0, Number((goal as { monthlyContribution?: unknown }).monthlyContribution ?? 0) || 0)
          }))
        : ((Number(value.preferences?.portfolioGoalAmount ?? 0) || 0) > 0
          ? [{
              id: 'goal-legacy',
              name: 'Primary goal',
              targetAmount: Number(value.preferences?.portfolioGoalAmount ?? 0) || 0,
              targetDate: String(value.preferences?.portfolioGoalDate ?? ''),
              expectedReturn: Number(value.preferences?.portfolioExpectedReturn ?? base.preferences.portfolioExpectedReturn) || base.preferences.portfolioExpectedReturn,
              stepUpPercent: Math.max(0, Number(value.preferences?.portfolioDefaultStepUpPercent ?? base.preferences.portfolioDefaultStepUpPercent) || 0),
              allocatedCurrentValue: 0,
              monthlyContribution: 0
            }]
          : [])
    }
  };
}
