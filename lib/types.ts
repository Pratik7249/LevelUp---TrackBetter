export type MoneySourceType = "bank" | "cash" | "wallet";
export type TransactionType = "income" | "expense" | "investment";
export type MainCategory = "Needs" | "Wants" | "Investment";
export type ThemePreference = "system" | "light" | "dark";

export type Account = {
  id: string;
  name: string;
  type: MoneySourceType;
  balance: number;
};

export type Category = {
  id: string;
  name: string;
  mainCategory: MainCategory;
  subcategories: string[];
};

export type Transaction = {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  accountId: string;
  category: string;
  subcategory?: string;
  mainCategory?: MainCategory;
  note?: string;
};

export type Holding = {
  id: string;
  name: string;
  symbol?: string;
  assetClass: "Equity" | "Mutual Fund" | "Gold" | "Debt" | "Crypto" | "Cash";
  invested: number;
  currentValue: number;
  monthlyValues: Array<{ month: string; value: number }>;
};

export type Habit = {
  id: string;
  name: string;
  targetDays: number;
  completions: Record<string, boolean>;
};

export type ReportSettings = {
  email: string;
  enabled: boolean;
  fortnightly: boolean;
  monthEnd: boolean;
};

export type AppPreferences = {
  theme: ThemePreference;
  currency: "INR";
  timezone: "Asia/Kolkata";
};

export type TrackerState = {
  schemaVersion: 3;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  holdings: Holding[];
  habits: Habit[];
  messCompletions: Record<string, boolean>;
  reportSettings: ReportSettings;
  preferences: AppPreferences;
};
