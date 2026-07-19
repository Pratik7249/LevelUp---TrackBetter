import type { TrackerState } from "./types";

export const defaultState: TrackerState = {
  schemaVersion: 3,
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
    { id: "mutual-funds", name: "Mutual Funds", mainCategory: "Investment", subcategories: ["SIP", "Lumpsum"] },
    { id: "stocks", name: "Stocks", mainCategory: "Investment", subcategories: ["Indian Equity", "US Equity"] }
  ],
  transactions: [],
  holdings: [],
  habits: [
    { id: "running", name: "Running", targetDays: 20, completions: {} },
    { id: "learning", name: "Learning", targetDays: 20, completions: {} }
  ],
  messCompletions: {},
  reportSettings: {
    email: "",
    enabled: false,
    fortnightly: true,
    monthEnd: true
  },
  preferences: {
    theme: "system",
    currency: "INR",
    timezone: "Asia/Kolkata"
  }
};

export function cloneDefaultState(): TrackerState {
  return JSON.parse(JSON.stringify(defaultState)) as TrackerState;
}

export function normalizeState(value: Partial<TrackerState> | null | undefined): TrackerState {
  const base = cloneDefaultState();
  if (!value || typeof value !== "object") return base;

  return {
    schemaVersion: 3,
    accounts: Array.isArray(value.accounts) && value.accounts.length ? value.accounts : base.accounts,
    categories: Array.isArray(value.categories) && value.categories.length ? value.categories : base.categories,
    transactions: Array.isArray(value.transactions) ? value.transactions : base.transactions,
    holdings: Array.isArray(value.holdings) ? value.holdings : base.holdings,
    habits: Array.isArray(value.habits) && value.habits.length ? value.habits : base.habits,
    messCompletions: value.messCompletions && typeof value.messCompletions === "object" ? value.messCompletions : {},
    reportSettings: {
      ...base.reportSettings,
      ...(value.reportSettings ?? {})
    },
    preferences: {
      ...base.preferences,
      ...(value.preferences ?? {})
    }
  };
}
