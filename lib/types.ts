export type MoneySourceType = "bank" | "cash" | "wallet";
export type TransactionType = "income" | "expense" | "investment";
export type MainCategory = "Needs" | "Wants" | "Investment";
export type ThemePreference = "system" | "light" | "dark";

export type AssetClass = "Mutual Fund" | "Equity" | "ETF" | "Gold" | "Debt" | "Crypto" | "Cash";
export type FundCategory =
  | "Large Cap"
  | "Mid Cap"
  | "Small Cap"
  | "Flexi Cap"
  | "Multi Cap"
  | "Index Fund"
  | "ELSS"
  | "Hybrid"
  | "Debt Fund"
  | "Liquid Fund"
  | "International"
  | "Sectoral / Thematic"
  | "Other";

export type FundAllocation = {
  category: FundCategory;
  percentage: number;
};

export type FundReturnSnapshot = {
  asOfMonth: string;
  threeMonth: number | null;
  sixMonth: number | null;
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
};

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

export type InvestmentEntry = {
  id: string;
  date: string;
  amount: number;
  label?: string;
};

export type SipPlan = {
  enabled: boolean;
  amount: number;
  /** Optional month when the SIP originally began, kept only as historical context. */
  originalStartMonth?: string;
  /** Optional older monthly SIP amount before the current amount. */
  previousAmount?: number;
  /** Optional most recent month already paid before automatic tracking begins. */
  lastPaidMonth?: string;
  startDate: string;
  /** First date from which the app should create automatic SIP transactions. */
  trackingStartDate: string;
  dayOfMonth: number;
  accountId: string;
  /** Annual increase applied every 12 installments from the SIP start month. */
  stepUpPercent: number;
};

export type Holding = {
  id: string;
  name: string;
  symbol?: string;
  assetClass: AssetClass;
  fundCategory?: FundCategory;
  /** Percentage look-through allocation for a mutual fund or ETF. */
  allocationBreakdown: FundAllocation[];
  investmentDate: string;
  invested: number;
  currentValue: number;
  goalAmount: number;
  /** User planning assumption, not a guaranteed return. */
  expectedAnnualReturn: number;
  /** Manually entered published fund returns, captured once and editable later. */
  returnSnapshot: FundReturnSnapshot;
  monthlyValues: Array<{ month: string; value: number }>;
  additionalInvestments: InvestmentEntry[];
  sip: SipPlan;
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

export type PortfolioGoal = {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  expectedReturn: number;
  stepUpPercent: number;
  /** Current portfolio amount intentionally assigned to this goal. */
  allocatedCurrentValue: number;
  /** Monthly SIP intentionally assigned to this goal. */
  monthlyContribution: number;
};



export type AppPreferences = {
  theme: ThemePreference;
  currency: "INR";
  timezone: "Asia/Kolkata";
  portfolioGoalAmount: number;
  portfolioGoalDate: string;
  portfolioExpectedReturn: number;
  portfolioDefaultStepUpPercent: number;
  portfolioGoals: PortfolioGoal[];
};

export type TrackerState = {
  schemaVersion: 4;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  holdings: Holding[];
  habits: Habit[];
  dailyCheckins: Record<string, boolean>;
  reportSettings: ReportSettings;
  preferences: AppPreferences;
};
