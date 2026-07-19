"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BarChart, DonutChart, LineChart } from "@/components/charts";
import { Card, CollapsibleCard, EmptyState, MetricCard } from "@/components/ui";
import {
  addMonthsToKey,
  clampPercentage,
  compactCurrency,
  currency,
  holdingReturn,
  monthLabel,
  portfolioAllocation,
  portfolioProjectionSeries,
  portfolioSeries,
  portfolioTotals,
  requiredMonthlySipForGoal,
  rupeesInWords,
  sipAmountForMonth,
  sipHistoricalCutoffMonth,
  toDateInput,
  toMonthInput,
  weightedExpectedReturn
} from "@/lib/analytics";
import { useTracker } from "@/lib/store";
import type {
  AssetClass,
  FundAllocation,
  FundCategory,
  FundReturnSnapshot,
  Holding,
  PortfolioGoal
} from "@/lib/types";

const assetClasses: AssetClass[] = ["Mutual Fund", "Equity", "ETF", "Gold", "Debt", "Crypto", "Cash"];
const fundCategories: FundCategory[] = [
  "Large Cap",
  "Mid Cap",
  "Small Cap",
  "Flexi Cap",
  "Multi Cap",
  "Index Fund",
  "ELSS",
  "Hybrid",
  "Debt Fund",
  "Liquid Fund",
  "International",
  "Sectoral / Thematic",
  "Other"
];
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type DetailsTab = "add" | "update";
type ReturnForm = {
  asOfMonth: string;
  threeMonth: string;
  sixMonth: string;
  oneYear: string;
  threeYear: string;
  fiveYear: string;
};

function isFundAsset(assetClass: AssetClass) {
  return assetClass === "Mutual Fund" || assetClass === "ETF";
}

function allocationTotal(rows: FundAllocation[]) {
  return rows.reduce((sum, row) => sum + (Number(row.percentage) || 0), 0);
}

function monthToDate(month: string, day = 1) {
  return `${month}-${String(Math.min(28, Math.max(1, day))).padStart(2, "0")}`;
}

function goalId() {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function returnForm(month: string, snapshot?: FundReturnSnapshot): ReturnForm {
  const show = (value: number | null | undefined) => value === null || value === undefined ? "" : String(value);
  return {
    asOfMonth: snapshot?.asOfMonth || month,
    threeMonth: show(snapshot?.threeMonth),
    sixMonth: show(snapshot?.sixMonth),
    oneYear: show(snapshot?.oneYear),
    threeYear: show(snapshot?.threeYear),
    fiveYear: show(snapshot?.fiveYear)
  };
}

function parseOptionalReturn(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseReturnForm(value: ReturnForm): FundReturnSnapshot {
  return {
    asOfMonth: value.asOfMonth,
    threeMonth: parseOptionalReturn(value.threeMonth),
    sixMonth: parseOptionalReturn(value.sixMonth),
    oneYear: parseOptionalReturn(value.oneYear),
    threeYear: parseOptionalReturn(value.threeYear),
    fiveYear: parseOptionalReturn(value.fiveYear)
  };
}

function formatReturnValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function returnSummary(snapshot: FundReturnSnapshot) {
  const rows = [
    ["3M", snapshot.threeMonth],
    ["6M", snapshot.sixMonth],
    ["1Y", snapshot.oneYear],
    ["3Y", snapshot.threeYear],
    ["5Y", snapshot.fiveYear]
  ].filter(([, value]) => value !== null);
  return rows.length ? rows.map(([label, value]) => `${label} ${formatReturnValue(value as number)}`).join(" · ") : "Returns not added";
}

function latestStoredPortfolioMonth(holdings: Holding[], fallback: string) {
  const months = holdings.flatMap((holding) => holding.monthlyValues.map((point) => point.month)).filter(Boolean).sort();
  return months.at(-1) || fallback;
}

function MoneyValue({ value, signed = false }: { value: number; signed?: boolean }) {
  const prefix = signed && value > 0 ? "+" : "";
  return (
    <span className="money-value">
      <strong>{prefix}{currency(value)}</strong>
      <small>{rupeesInWords(value)}</small>
    </span>
  );
}

function AllocationEditor({ value, onChange }: { value: FundAllocation[]; onChange: (value: FundAllocation[]) => void }) {
  const total = allocationTotal(value);
  return (
    <div className="allocation-editor field full">
      <div className="allocation-editor-title">
        <div>
          <label>Asset allocation</label>
          <small>Split the fund across large cap, mid cap, small cap, debt and other categories.</small>
        </div>
        <strong className={Math.abs(total - 100) <= 0.5 ? "positive" : "negative"}>{total.toFixed(0)}%</strong>
      </div>
      <div className="allocation-rows">
        {value.map((row, index) => (
          <div className="allocation-row" key={`${row.category}-${index}`}>
            <select
              value={row.category}
              onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, category: event.target.value as FundCategory } : item))}
            >
              {fundCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
            <div className="percentage-input">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={row.percentage}
                onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: Number(event.target.value) } : item))}
              />
              <span>%</span>
            </div>
            <button type="button" className="text-button danger-text" disabled={value.length === 1} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
          </div>
        ))}
      </div>
      <button type="button" className="button secondary compact-button" onClick={() => onChange([...value, { category: "Other", percentage: 0 }])}>+ Add category</button>
      {Math.abs(total - 100) > 0.5 && <div className="form-message info">Allocation must total 100% before saving.</div>}
    </div>
  );
}

function ReturnSnapshotEditor({ value, onChange }: { value: ReturnForm; onChange: (next: ReturnForm) => void }) {
  const fields: Array<{ key: keyof ReturnForm; label: string }> = [
    { key: "threeMonth", label: "3-month return" },
    { key: "sixMonth", label: "6-month return" },
    { key: "oneYear", label: "1-year return" },
    { key: "threeYear", label: "3-year return" },
    { key: "fiveYear", label: "5-year return" }
  ];
  return (
    <div className="field full return-entry-panel">
      <div className="form-intro">
        <strong>Fund return snapshot</strong>
        <span>Add these published returns once. Update them only when you want to refresh fund analytics.</span>
      </div>
      <div className="form-grid return-entry-grid">
        <div className="field"><label>Return data month</label><input type="month" value={value.asOfMonth} onChange={(event) => onChange({ ...value, asOfMonth: event.target.value })} /></div>
        {fields.map((field) => (
          <div className="field" key={field.key}>
            <label>{field.label}</label>
            <div className="percentage-input"><input type="number" step="0.01" value={value[field.key]} onChange={(event) => onChange({ ...value, [field.key]: event.target.value })} /><span>%</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function sipHistoricalEndMonth(holding: Holding) {
  return sipHistoricalCutoffMonth(holding);
}

function sipDisplayAmountForMonth(holding: Holding, monthKey: string) {
  const originalStart = holding.sip.originalStartMonth || "";
  const historicalEnd = sipHistoricalEndMonth(holding);
  const historical = Boolean(originalStart && historicalEnd && monthKey >= originalStart && monthKey <= historicalEnd);
  return {
    amount: historical ? (holding.sip.previousAmount || holding.sip.amount || 0) : sipAmountForMonth(holding, monthKey),
    historical
  };
}

function HoldingRow({ holding, month, onEdit }: { holding: Holding; month: string; onEdit: () => void }) {
  const { state, removeHolding } = useTracker();
  const result = holdingReturn(holding, month, state.transactions);
  const allocation = holding.allocationBreakdown.slice(0, 3).map((item) => `${item.category} ${item.percentage}%`).join(" · ");
  const goalGap = Math.max(0, (holding.goalAmount || 0) - result.current);

  return (
    <tr>
      <td>
        <strong>{holding.name}</strong>
        <span className="table-subtitle">{holding.symbol || holding.assetClass}</span>
        {isFundAsset(holding.assetClass) && <span className="table-subtitle return-summary">{returnSummary(holding.returnSnapshot)}</span>}
      </td>
      <td><span className="table-subtitle strong-subtitle">{allocation || holding.fundCategory || holding.assetClass}</span></td>
      <td><MoneyValue value={result.invested} /></td>
      <td><MoneyValue value={result.current} /></td>
      <td className={result.gain >= 0 ? "positive" : "negative"}><MoneyValue value={result.gain} signed /><span className="table-subtitle">{formatReturnValue(result.gainPercent)}</span></td>
      <td>{holding.goalAmount > 0 ? <><MoneyValue value={goalGap} /><span className="table-subtitle">away</span></> : "—"}</td>
      <td>{holding.sip.enabled ? <><span className="sip-badge" title={rupeesInWords(sipAmountForMonth(holding, month))}>{currency(sipAmountForMonth(holding, month))}/mo</span>{holding.sip.originalStartMonth && <span className="table-subtitle">since {monthLabel(holding.sip.originalStartMonth)}</span>}</> : "—"}</td>
      <td><div className="table-actions"><button className="text-button" onClick={onEdit}>Edit</button><button className="text-button danger-text" onClick={() => removeHolding(holding.id)}>Delete</button></div></td>
    </tr>
  );
}

function projectionRows(startingValue: number, monthlySip: number, annualReturn: number, annualStepUp: number, startYear: number, endYear: number) {
  const firstYear = Math.min(startYear, endYear);
  const lastYear = Math.max(startYear, endYear);
  const monthlyRate = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  let value = Math.max(0, startingValue);
  let contribution = Math.max(0, monthlySip);
  let cumulativeContribution = 0;
  return Array.from({ length: Math.min(41, lastYear - firstYear + 1) }, (_, yearIndex) => {
    const year = firstYear + yearIndex;
    let annualContribution = 0;
    for (let month = 0; month < 12; month += 1) {
      value = value * (1 + monthlyRate) + contribution;
      annualContribution += contribution;
    }
    cumulativeContribution += annualContribution;
    const capital = startingValue + cumulativeContribution;
    const row = {
      label: String(year),
      year,
      annualContribution,
      cumulativeContribution,
      capital,
      projected: value,
      gain: value - capital
    };
    contribution *= 1 + Math.max(0, annualStepUp) / 100;
    return row;
  });
}

export default function PortfolioPage() {
  const {
    state,
    addHolding,
    updateHolding,
    addHoldingInvestment,
    addTransaction,
    setSipPayment,
    updateHoldingValuation,
    updatePreferences
  } = useTracker();

  const currentMonth = toMonthInput();
  const stableMonth = useMemo(() => latestStoredPortfolioMonth(state.holdings, currentMonth), [currentMonth, state.holdings]);
  const [reviewMonth, setReviewMonth] = useState(stableMonth);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("add");

  useEffect(() => {
    if (reviewMonth > stableMonth) setReviewMonth(stableMonth);
  }, [reviewMonth, stableMonth]);

  const summary = portfolioTotals(state, stableMonth);
  const currentMonthlySip = useMemo(() => state.holdings.reduce((sum, holding) => sum + sipAmountForMonth(holding, currentMonth), 0), [currentMonth, state.holdings]);
  const stableAllocation = portfolioAllocation(state, stableMonth);
  const stableProjectionSeries = portfolioProjectionSeries(state, stableMonth);
  const yearlyGrowthData = useMemo(() => {
    const history = portfolioSeries(state, stableMonth);
    const yearlyMap = new Map<string, { label: string; value: number; invested: number }>();
    history.forEach((row) => {
      const year = String(row.month).slice(0, 4);
      yearlyMap.set(year, { label: year, value: Number(row.value), invested: Number(row.invested) });
    });
    return [...yearlyMap.values()];
  }, [stableMonth, state]);

  const stableYear = Number(stableMonth.slice(0, 4));
  const [customStartYear, setCustomStartYear] = useState(String(stableYear));
  const [customEndYear, setCustomEndYear] = useState(String(stableYear + 10));
  const [customMonthlySip, setCustomMonthlySip] = useState(String(currentMonthlySip || 0));
  const [customReturn, setCustomReturn] = useState(String(Math.round(weightedExpectedReturn(state, stableMonth) * 10) / 10 || 12));
  const [customStepUp, setCustomStepUp] = useState(String(state.preferences.portfolioDefaultStepUpPercent || 0));
  const customProjectionRows = useMemo(() => projectionRows(
    summary.current,
    Number(customMonthlySip) || 0,
    Number(customReturn) || 0,
    Number(customStepUp) || 0,
    Number(customStartYear) || stableYear,
    Number(customEndYear) || stableYear
  ), [customEndYear, customMonthlySip, customReturn, customStartYear, customStepUp, stableYear, summary.current]);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("Mutual Fund");
  const [invested, setInvested] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [snapshotMonth, setSnapshotMonth] = useState(currentMonth);
  const [fundGoal, setFundGoal] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("12");
  const [newAllocation, setNewAllocation] = useState<FundAllocation[]>([{ category: "Index Fund", percentage: 100 }]);
  const [newReturns, setNewReturns] = useState<ReturnForm>(() => returnForm(currentMonth));
  const [addMessage, setAddMessage] = useState("");

  const [selectedHoldingId, setSelectedHoldingId] = useState(state.holdings[0]?.id ?? "");
  const selectedHolding = state.holdings.find((item) => item.id === selectedHoldingId) ?? null;
  const [editName, setEditName] = useState("");
  const [editSymbol, setEditSymbol] = useState("");
  const [editAssetClass, setEditAssetClass] = useState<AssetClass>("Mutual Fund");
  const [editOpeningInvested, setEditOpeningInvested] = useState("");
  const [editCurrentValue, setEditCurrentValue] = useState("");
  const [editValueMonth, setEditValueMonth] = useState(stableMonth);
  const [editGoal, setEditGoal] = useState("");
  const [editExpectedReturn, setEditExpectedReturn] = useState("12");
  const [editAllocation, setEditAllocation] = useState<FundAllocation[]>([{ category: "Index Fund", percentage: 100 }]);
  const [editReturns, setEditReturns] = useState<ReturnForm>(() => returnForm(stableMonth));
  const [editMessage, setEditMessage] = useState("");

  const [additionalDate, setAdditionalDate] = useState(toDateInput());
  const [additionalAmount, setAdditionalAmount] = useState("");
  const [additionalAccountId, setAdditionalAccountId] = useState(state.accounts[0]?.id ?? "");
  const [additionalMessage, setAdditionalMessage] = useState("");

  const [sipHoldingId, setSipHoldingId] = useState(state.holdings[0]?.id ?? "");
  const sipHolding = state.holdings.find((item) => item.id === sipHoldingId) ?? null;
  const [sipEnabled, setSipEnabled] = useState(false);
  const [sipOriginalStartMonth, setSipOriginalStartMonth] = useState("");
  const [sipPreviousAmount, setSipPreviousAmount] = useState("");
  const [sipLastPaidMonth, setSipLastPaidMonth] = useState("");
  const [sipAmount, setSipAmount] = useState("");
  const [sipTrackingMonth, setSipTrackingMonth] = useState(currentMonth);
  const [sipDay, setSipDay] = useState("5");
  const [sipAccountId, setSipAccountId] = useState(state.accounts[0]?.id ?? "");
  const [sipStepUp, setSipStepUp] = useState("0");
  const [sipYear, setSipYear] = useState(Number(currentMonth.slice(0, 4)));
  const [sipMessage, setSipMessage] = useState("");

  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalExpectedReturn, setGoalExpectedReturn] = useState(String(state.preferences.portfolioExpectedReturn || 12));
  const [goalStepUp, setGoalStepUp] = useState(String(state.preferences.portfolioDefaultStepUpPercent || 0));
  const [goalCurrentAllocation, setGoalCurrentAllocation] = useState(String(summary.current || 0));
  const [goalMonthlyContribution, setGoalMonthlyContribution] = useState(String(currentMonthlySip || 0));
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalMessage, setGoalMessage] = useState("");
  const [goalSetupOpen, setGoalSetupOpen] = useState(false);

  const goals = state.preferences.portfolioGoals ?? [];

  useEffect(() => {
    if (!selectedHoldingId && state.holdings[0]) setSelectedHoldingId(state.holdings[0].id);
    if (!sipHoldingId && state.holdings[0]) setSipHoldingId(state.holdings[0].id);
    if (!additionalAccountId && state.accounts[0]) setAdditionalAccountId(state.accounts[0].id);
    if (!sipAccountId && state.accounts[0]) setSipAccountId(state.accounts[0].id);
  }, [additionalAccountId, selectedHoldingId, sipAccountId, sipHoldingId, state.accounts, state.holdings]);

  useEffect(() => {
    if (!selectedHolding) return;
    setEditName(selectedHolding.name);
    setEditSymbol(selectedHolding.symbol ?? "");
    setEditAssetClass(selectedHolding.assetClass);
    setEditOpeningInvested(String(selectedHolding.invested || ""));
    setEditCurrentValue(String(holdingReturn(selectedHolding, reviewMonth, state.transactions).current || ""));
    setEditValueMonth(reviewMonth);
    setEditGoal(String(selectedHolding.goalAmount || ""));
    setEditExpectedReturn(String(selectedHolding.expectedAnnualReturn || 12));
    setEditAllocation(selectedHolding.allocationBreakdown.length ? selectedHolding.allocationBreakdown : [{ category: selectedHolding.fundCategory ?? "Other", percentage: 100 }]);
    setEditReturns(returnForm(reviewMonth, selectedHolding.returnSnapshot));
    setEditMessage("");
  }, [reviewMonth, selectedHolding, state.transactions]);

  useEffect(() => {
    if (!sipHolding) return;
    setSipEnabled(sipHolding.sip.enabled);
    setSipOriginalStartMonth(sipHolding.sip.originalStartMonth ?? "");
    setSipPreviousAmount(String(sipHolding.sip.previousAmount || ""));
    setSipLastPaidMonth(sipHolding.sip.lastPaidMonth ?? "");
    setSipAmount(String(sipHolding.sip.amount || ""));
    setSipTrackingMonth((sipHolding.sip.trackingStartDate || sipHolding.sip.startDate || monthToDate(currentMonth)).slice(0, 7));
    setSipDay(String(sipHolding.sip.dayOfMonth || 5));
    setSipAccountId(sipHolding.sip.accountId || state.accounts[0]?.id || "");
    setSipStepUp(String(sipHolding.sip.stepUpPercent || 0));
    setSipMessage("");
  }, [currentMonth, sipHolding, state.accounts]);

  const activeSipHoldings = useMemo(() => state.holdings.filter((holding) => holding.sip.enabled), [state.holdings]);
  const sipCalendarRows = useMemo(() => activeSipHoldings.map((holding) => ({
    holding,
    months: monthLabels.map((label, index) => {
      const monthKey = `${sipYear}-${String(index + 1).padStart(2, "0")}`;
      const display = sipDisplayAmountForMonth(holding, monthKey);
      const previousKey = addMonthsToKey(monthKey, -1);
      const previousAmount = sipDisplayAmountForMonth(holding, previousKey).amount;
      const transactionId = `sip-${holding.id}-${monthKey}`;
      const recorded = state.transactions.some((transaction) => transaction.id === transactionId);
      const trackingStart = (holding.sip.trackingStartDate || holding.sip.startDate || "").slice(0, 7);
      const trackable = Boolean(display.amount > 0 && trackingStart && monthKey >= trackingStart && monthKey <= currentMonth);
      const status = display.historical
        ? "historical"
        : recorded
          ? "recorded"
          : trackable
            ? "due"
            : display.amount > 0 && monthKey > currentMonth
              ? "planned"
              : "empty";
      return {
        label,
        monthKey,
        amount: display.amount,
        previousAmount,
        historical: display.historical,
        increased: display.amount > previousAmount && previousAmount > 0,
        recorded,
        trackable,
        status,
        transactionId
      };
    })
  })), [activeSipHoldings, currentMonth, sipYear, state.transactions]);

  const sipYearSummary = useMemo(() => {
    const firstYear = activeSipHoldings
      .map((holding) => Number((holding.sip.originalStartMonth || holding.sip.startDate || currentMonth).slice(0, 4)))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0] || Number(currentMonth.slice(0, 4));
    const currentYear = Number(currentMonth.slice(0, 4));
    const startYear = Math.max(firstYear, currentYear - 20);
    return Array.from({ length: currentYear - startYear + 1 }, (_, index) => startYear + index).map((year) => {
      const months = monthLabels.map((label, monthIndex) => {
        const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
        const scheduled = activeSipHoldings.reduce((sum, holding) => sum + sipDisplayAmountForMonth(holding, monthKey).amount, 0);
        const historical = activeSipHoldings.some((holding) => sipDisplayAmountForMonth(holding, monthKey).historical);
        const paid = state.transactions
          .filter((transaction) => transaction.id.startsWith("sip-") && transaction.date.startsWith(monthKey))
          .reduce((sum, transaction) => sum + transaction.amount, 0);
        const previousKey = addMonthsToKey(monthKey, -1);
        const previousScheduled = activeSipHoldings.reduce((sum, holding) => sum + sipDisplayAmountForMonth(holding, previousKey).amount, 0);
        const status = historical
          ? "historical"
          : paid > 0
            ? "recorded"
            : scheduled > 0 && monthKey <= currentMonth
              ? "due"
              : scheduled > 0
                ? "planned"
                : "empty";
        return {
          label,
          monthKey,
          scheduled,
          paid: historical ? scheduled : paid,
          increased: scheduled > previousScheduled && previousScheduled > 0,
          status
        };
      });
      return {
        year: String(year),
        months,
        planned: months.reduce((sum, month) => sum + month.scheduled, 0),
        recorded: months.reduce((sum, month) => sum + month.paid, 0)
      };
    });
  }, [activeSipHoldings, currentMonth, state.transactions]);

  const firstSipMonth = useMemo(() => {
    const months = activeSipHoldings.map((holding) => (holding.sip.originalStartMonth || holding.sip.startDate.slice(0, 7))).filter(Boolean);
    return months.sort()[0] || "";
  }, [activeSipHoldings]);

  const goalAnalytics = useMemo(() => goals.map((goal) => {
    const expected = goal.expectedReturn || weightedExpectedReturn(state, stableMonth) || 12;
    const currentAssigned = Math.max(0, Number(goal.allocatedCurrentValue ?? summary.current) || 0);
    const monthlyAssigned = Math.max(0, Number(goal.monthlyContribution ?? currentMonthlySip) || 0);
    const targetMonth = goal.targetDate ? goal.targetDate.slice(0, 7) : stableMonth;
    const months = Math.max(0, ((Number(targetMonth.slice(0, 4)) - Number(stableMonth.slice(0, 4))) * 12) + (Number(targetMonth.slice(5, 7)) - Number(stableMonth.slice(5, 7))));
    const projectedValue = (() => {
      const monthlyRate = Math.pow(1 + expected / 100, 1 / 12) - 1;
      let value = currentAssigned;
      let monthly = monthlyAssigned;
      for (let index = 0; index < months; index += 1) {
        value = value * (1 + monthlyRate) + monthly;
        if ((index + 1) % 12 === 0) monthly *= 1 + Math.max(0, goal.stepUpPercent || 0) / 100;
      }
      return value;
    })();
    const requiredMonthly = requiredMonthlySipForGoal(currentAssigned, goal.targetAmount, expected, months, goal.stepUpPercent || 0);
    const monthlyIncrease = Math.max(0, requiredMonthly - monthlyAssigned);
    const increasePercent = monthlyAssigned > 0 ? (monthlyIncrease / monthlyAssigned) * 100 : monthlyIncrease > 0 ? 100 : 0;
    const projectedGap = Math.max(0, goal.targetAmount - projectedValue);
    const currentGap = Math.max(0, goal.targetAmount - currentAssigned);
    const action = projectedGap > 0
      ? `Increase the SIP assigned to ${goal.name} from ${currency(monthlyAssigned)} to about ${currency(requiredMonthly)} per month, an increase of ${currency(monthlyIncrease)} (${increasePercent.toFixed(1)}%). Continue the ${goal.stepUpPercent.toFixed(1)}% annual step-up. If that increase is not practical, extend the target date and test the alternative in the custom predictor.`
      : `The assigned plan is currently sufficient. Continue ${currency(monthlyAssigned)} per month with the ${goal.stepUpPercent.toFixed(1)}% annual step-up. The modelled minimum monthly SIP is ${currency(requiredMonthly)}.`;
    return {
      ...goal,
      expectedReturn: expected,
      stepUpPercent: Math.max(0, Number(goal.stepUpPercent) || 0),
      months,
      currentAssigned,
      monthlyAssigned,
      currentGap,
      projectedValue,
      projectedGap,
      requiredMonthly,
      monthlyIncrease,
      increasePercent,
      action
    };
  }), [currentMonthlySip, goals, stableMonth, state, summary.current]);

  const assignedGoalCurrent = goals.reduce((sum, goal) => sum + Math.max(0, Number(goal.allocatedCurrentValue ?? 0) || 0), 0);
  const assignedGoalSip = goals.reduce((sum, goal) => sum + Math.max(0, Number(goal.monthlyContribution ?? 0) || 0), 0);

  function submitHolding(event: FormEvent) {
    event.preventDefault();
    const openingInvested = Number(invested);
    const value = Number(currentValue);
    const allocationValid = !isFundAsset(assetClass) || Math.abs(allocationTotal(newAllocation) - 100) <= 0.5;

    if (!name.trim() || openingInvested < 0 || value < 0 || !snapshotMonth) {
      setAddMessage("Enter the holding name, invested amount, current value and snapshot month.");
      return;
    }
    if (!allocationValid) {
      setAddMessage("Asset allocation must total 100%.");
      return;
    }

    const primaryCategory = isFundAsset(assetClass) ? ([...newAllocation].sort((a, b) => b.percentage - a.percentage)[0]?.category ?? "Other") : undefined;
    const approximateDate = monthToDate(snapshotMonth);
    addHolding({
      name: name.trim(),
      symbol: symbol.trim() || undefined,
      assetClass,
      ...(primaryCategory ? { fundCategory: primaryCategory } : {}),
      allocationBreakdown: isFundAsset(assetClass) ? newAllocation : [],
      investmentDate: approximateDate,
      invested: openingInvested,
      currentValue: value,
      goalAmount: Number(fundGoal) || 0,
      expectedAnnualReturn: Number(expectedReturn) || 12,
      returnSnapshot: isFundAsset(assetClass) ? parseReturnForm(newReturns) : parseReturnForm(returnForm(snapshotMonth)),
      monthlyValues: [{ month: snapshotMonth, value }],
      additionalInvestments: [],
      sip: {
        enabled: false,
        amount: 0,
        startDate: approximateDate,
        trackingStartDate: approximateDate,
        dayOfMonth: 1,
        accountId: "",
        stepUpPercent: 0
      }
    });

    setName("");
    setSymbol("");
    setInvested("");
    setCurrentValue("");
    setFundGoal("");
    setNewReturns(returnForm(currentMonth));
    setAddMessage("Holding added as an opening snapshot.");
  }

  function saveHoldingChanges(event: FormEvent) {
    event.preventDefault();
    if (!selectedHolding) return;
    const openingInvested = Number(editOpeningInvested);
    const current = Number(editCurrentValue);
    const allocationValid = !isFundAsset(editAssetClass) || Math.abs(allocationTotal(editAllocation) - 100) <= 0.5;

    if (!editName.trim() || openingInvested < 0 || current < 0 || !editValueMonth) {
      setEditMessage("Enter valid holding details, invested amount, current value and month.");
      return;
    }
    if (!allocationValid) {
      setEditMessage("Asset allocation must total 100%.");
      return;
    }

    const primaryCategory = isFundAsset(editAssetClass) ? ([...editAllocation].sort((a, b) => b.percentage - a.percentage)[0]?.category ?? "Other") : undefined;
    updateHolding(selectedHolding.id, {
      name: editName.trim(),
      symbol: editSymbol.trim() || undefined,
      assetClass: editAssetClass,
      fundCategory: primaryCategory,
      allocationBreakdown: isFundAsset(editAssetClass) ? editAllocation : [],
      invested: openingInvested,
      goalAmount: Number(editGoal) || 0,
      expectedAnnualReturn: Number(editExpectedReturn) || 12,
      returnSnapshot: isFundAsset(editAssetClass) ? parseReturnForm(editReturns) : selectedHolding.returnSnapshot
    });
    updateHoldingValuation(selectedHolding.id, editValueMonth, current);
    setEditMessage(`Holding and ${monthLabel(editValueMonth)} value saved.`);
  }

  function submitAdditional(event: FormEvent) {
    event.preventDefault();
    const amount = Number(additionalAmount);
    if (!selectedHolding || amount <= 0 || !additionalDate || !additionalAccountId) {
      setAdditionalMessage("Select a holding and enter a valid amount, date and source account.");
      return;
    }
    addHoldingInvestment(selectedHolding.id, { date: additionalDate, amount, label: "Additional investment" });
    addTransaction({
      type: "investment",
      description: `Additional investment · ${selectedHolding.name}`,
      amount,
      date: additionalDate,
      accountId: additionalAccountId,
      category: selectedHolding.assetClass === "Mutual Fund" ? "Mutual Funds" : selectedHolding.assetClass,
      subcategory: "Additional Investment",
      mainCategory: "Investment",
      note: "Created from portfolio tracker."
    });
    setAdditionalAmount("");
    setAdditionalMessage("Investment added and deducted from the selected account.");
  }

  function saveSip(event: FormEvent) {
    event.preventDefault();
    if (!sipHolding) {
      setSipMessage("Select a holding first.");
      return;
    }
    const day = Number(sipDay);
    if (sipEnabled && (Number(sipAmount) <= 0 || !sipTrackingMonth || day < 1 || day > 28 || !sipAccountId)) {
      setSipMessage("Enter the current SIP amount, tracking month, debit day and account.");
      return;
    }

    const effectiveTrackingMonth = sipLastPaidMonth && sipTrackingMonth <= sipLastPaidMonth
      ? addMonthsToKey(sipLastPaidMonth, 1)
      : sipTrackingMonth;
    const trackingDate = monthToDate(effectiveTrackingMonth, day);
    updateHolding(sipHolding.id, {
      sip: {
        enabled: sipEnabled,
        amount: sipEnabled ? Number(sipAmount) : 0,
        ...(sipOriginalStartMonth ? { originalStartMonth: sipOriginalStartMonth } : {}),
        ...(Number(sipPreviousAmount) > 0 ? { previousAmount: Number(sipPreviousAmount) } : {}),
        ...(sipLastPaidMonth ? { lastPaidMonth: sipLastPaidMonth } : {}),
        startDate: trackingDate,
        trackingStartDate: trackingDate,
        dayOfMonth: sipEnabled ? day : 1,
        accountId: sipEnabled ? sipAccountId : "",
        stepUpPercent: sipEnabled ? Math.max(0, Number(sipStepUp) || 0) : 0
      }
    });
    setSipTrackingMonth(effectiveTrackingMonth);
    setSipMessage(sipEnabled ? `SIP saved. Months from ${monthLabel(effectiveTrackingMonth)} through the current month can be ticked in Holdings and performance.` : "SIP disabled for this holding.");
  }

  function useNextMonthAfterLastPaid() {
    if (!sipLastPaidMonth) return;
    setSipTrackingMonth(addMonthsToKey(sipLastPaidMonth, 1));
  }

  function toggleSipPaid(holding: Holding, monthKey: string, checked: boolean) {
    setSipPayment(holding.id, monthKey, checked);
  }

  function resetGoalForm() {
    setGoalName("");
    setGoalAmount("");
    setGoalDate("");
    setGoalExpectedReturn(String(state.preferences.portfolioExpectedReturn || 12));
    setGoalStepUp(String(state.preferences.portfolioDefaultStepUpPercent || 0));
    setGoalCurrentAllocation(String(Math.max(0, summary.current - assignedGoalCurrent) || 0));
    setGoalMonthlyContribution(String(Math.max(0, currentMonthlySip - assignedGoalSip) || 0));
    setEditingGoalId(null);
    setGoalMessage("");
  }

  function saveGoal(event: FormEvent) {
    event.preventDefault();
    if (!goalName.trim() || Number(goalAmount) <= 0 || !goalDate) {
      setGoalMessage("Enter goal name, target amount and target date.");
      return;
    }
    const item: PortfolioGoal = {
      id: editingGoalId || goalId(),
      name: goalName.trim(),
      targetAmount: Number(goalAmount),
      targetDate: goalDate,
      expectedReturn: Number(goalExpectedReturn) || 12,
      stepUpPercent: Math.max(0, Number(goalStepUp) || 0),
      allocatedCurrentValue: Math.max(0, Number(goalCurrentAllocation) || 0),
      monthlyContribution: Math.max(0, Number(goalMonthlyContribution) || 0)
    };
    const nextGoals = editingGoalId
      ? goals.map((goal) => goal.id === editingGoalId ? item : goal)
      : [...goals, item];
    updatePreferences({
      ...state.preferences,
      portfolioGoals: nextGoals,
      portfolioGoalAmount: nextGoals[0]?.targetAmount || 0,
      portfolioGoalDate: nextGoals[0]?.targetDate || "",
      portfolioExpectedReturn: Number(goalExpectedReturn) || 12,
      portfolioDefaultStepUpPercent: Math.max(0, Number(goalStepUp) || 0)
    });
    setGoalMessage(editingGoalId ? "Goal updated." : "Goal added.");
    setGoalSetupOpen(false);
    window.setTimeout(resetGoalForm, 100);
  }

  function startGoalEdit(goal: PortfolioGoal) {
    setEditingGoalId(goal.id);
    setGoalName(goal.name);
    setGoalAmount(String(goal.targetAmount));
    setGoalDate(goal.targetDate);
    setGoalExpectedReturn(String(goal.expectedReturn));
    setGoalStepUp(String(goal.stepUpPercent));
    setGoalCurrentAllocation(String(goal.allocatedCurrentValue ?? summary.current));
    setGoalMonthlyContribution(String(goal.monthlyContribution ?? currentMonthlySip));
    setGoalSetupOpen(true);
    window.setTimeout(() => document.getElementById("goal-setup")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function removeGoal(goalIdValue: string) {
    const nextGoals = goals.filter((goal) => goal.id !== goalIdValue);
    updatePreferences({
      ...state.preferences,
      portfolioGoals: nextGoals,
      portfolioGoalAmount: nextGoals[0]?.targetAmount || 0,
      portfolioGoalDate: nextGoals[0]?.targetDate || ""
    });
    if (editingGoalId === goalIdValue) resetGoalForm();
  }

  function editHolding(id: string) {
    setSelectedHoldingId(id);
    setDetailsTab("update");
    window.setTimeout(() => document.getElementById("portfolio-details")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Portfolio</h2>
          <p>Review the latest stored portfolio, mark monthly SIPs, and plan each goal with a clear monthly action.</p>
        </div>
        <div className="heading-actions">
          <label className="month-selector">
            <span>Holdings review month</span>
            <input className="month-input" type="month" max={stableMonth} value={reviewMonth} onChange={(event) => setReviewMonth(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="grid metrics portfolio-metrics">
        <MetricCard icon="IN" label="Invested" value={currency(summary.invested)} helper={rupeesInWords(summary.invested)} change={`Latest snapshot · ${monthLabel(stableMonth)}`} />
        <MetricCard icon="PV" label="Portfolio value" value={currency(summary.current)} helper={rupeesInWords(summary.current)} change={`Latest snapshot · ${monthLabel(stableMonth)}`} />
        <MetricCard icon="RT" label="Total gain / loss" value={currency(summary.gain)} helper={rupeesInWords(summary.gain)} change={`${summary.gainPercent >= 0 ? "+" : ""}${summary.gainPercent.toFixed(1)}%`} />
        <MetricCard icon="XR" label="Portfolio XIRR" value={`${summary.xirr.toFixed(1)}%`} change="Based on stored cash flows" />
        <MetricCard icon="SP" label="Current SIP" value={currency(currentMonthlySip)} helper={rupeesInWords(currentMonthlySip)} change="Across active SIPs" />
      </div>

      <div className="grid three section-gap portfolio-layout">
        <CollapsibleCard title="Portfolio analytics" eyebrow="Latest stored snapshot + projection" className="span-2">
          {stableProjectionSeries.length ? <LineChart data={stableProjectionSeries} series={[{ key: "value", label: "Actual value" }, { key: "invested", label: "Invested" }, { key: "projection", label: "Projection" }]} height={290} /> : <EmptyState title="No portfolio data" text="Add your current holdings to start analytics." />}
          <div className="projection-disclaimer">Snapshot: {monthLabel(stableMonth)}. This card changes only when you update a holding value, add an investment or mark a SIP paid.</div>
        </CollapsibleCard>

        <CollapsibleCard title="Asset allocation" eyebrow={`Latest mix · ${monthLabel(stableMonth)}`}>
          {stableAllocation.length ? <DonutChart data={stableAllocation} centerLabel={currency(summary.current)} /> : <EmptyState title="No allocation yet" text="Add allocation percentages for funds or ETFs." />}
          {summary.current > 0 && <div className="projection-disclaimer">Total represented: {currency(summary.current)} — {rupeesInWords(summary.current)}.</div>}
        </CollapsibleCard>

        <CollapsibleCard title={`Holdings and performance · ${monthLabel(reviewMonth)}`} eyebrow="Holdings + monthly SIP payment" className="span-3">
          <div className="table-wrap">
            <table className="holdings-table simple-holdings-table">
              <thead><tr><th>Asset</th><th>Allocation</th><th>Invested</th><th>Value</th><th>Gain / loss</th><th>Goal gap</th><th>SIP</th><th /></tr></thead>
              <tbody>{state.holdings.map((holding) => <HoldingRow key={holding.id} holding={holding} month={reviewMonth} onEdit={() => editHolding(holding.id)} />)}</tbody>
            </table>
            {!state.holdings.length && <EmptyState title="Your portfolio is empty" text="Add the current invested total and value for your first holding." />}
          </div>

          {state.holdings.length > 0 && <details className="simple-details section-gap"><summary>Show fund-wise gain chart</summary><div className="simple-details-body"><BarChart data={state.holdings.map((holding) => ({ label: holding.name, value: holdingReturn(holding, reviewMonth, state.transactions).gain }))} /></div></details>}

          <div className="simple-sip-plan section-gap integrated-sip-calendar">
            <div className="simple-sip-plan-head">
              <div><strong>Monthly SIP payment</strong><span>Tick only when the installment has actually been paid. Historical months are already included in the opening invested amount.</span></div>
              <label className="month-selector"><span>Year</span><input className="month-input" type="number" min="2000" max="2100" value={sipYear} onChange={(event) => setSipYear(Number(event.target.value))} /></label>
            </div>
            <div className="notice calendar-rule-note">Tickable months run from each SIP’s tracking-start month through the current month. Future months unlock when due. To tick July, the “Last SIP already paid” value must be June or earlier.</div>
            {sipCalendarRows.length ? <div className="sip-common-grid">
              {sipCalendarRows.map((row) => (
                <div className="sip-common-row" key={row.holding.id}>
                  <div className="sip-common-title"><strong>{row.holding.name}</strong><span>{currency(row.months.reduce((sum, monthCell) => sum + monthCell.amount, 0))} planned this year · {rupeesInWords(row.months.reduce((sum, monthCell) => sum + monthCell.amount, 0))}</span></div>
                  <div className="sip-common-months">
                    {row.months.map((cell) => (
                      <div className={`sip-common-cell ${cell.status}`} key={cell.monthKey} title={cell.amount > 0 ? `${currency(cell.amount)} — ${rupeesInWords(cell.amount)}` : "No SIP"}>
                        <span>{cell.label}</span>
                        <label className="sip-check-label">
                          <input
                            type="checkbox"
                            checked={cell.recorded || cell.historical}
                            onChange={(event) => toggleSipPaid(row.holding, cell.monthKey, event.target.checked)}
                            disabled={!cell.trackable || cell.amount <= 0 || !row.holding.sip.accountId}
                          />
                          <strong>{cell.amount > 0 ? compactCurrency(cell.amount) : "—"}</strong>
                        </label>
                        <small>{cell.historical ? "Previous paid" : cell.recorded ? "Paid" : cell.trackable ? "Tick when paid" : cell.status === "planned" ? "Upcoming" : "Not tracked"}</small>
                        {cell.increased && <b className="sip-increase-mark">↑ Increased</b>}
                        {cell.historical && cell.recorded && <button type="button" className="legacy-fix-button" onClick={() => toggleSipPaid(row.holding, cell.monthKey, false)}>Remove duplicate</button>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div> : <EmptyState title="No active SIPs" text="Configure SIP details below to activate the monthly tracker." />}

            <details className="simple-details section-gap">
              <summary>Yearly progress from the first SIP</summary>
              <div className="simple-details-body sip-history-list">
                {sipYearSummary.map((item) => (
                  <div className="sip-history-year" key={item.year}>
                    <div className="sip-history-head">
                      <div><strong>{item.year}</strong><span>{currency(item.recorded)} paid or historically included · {rupeesInWords(item.recorded)}</span></div>
                      <small>{currency(item.planned)} planned</small>
                    </div>
                    <div className="sip-common-months">
                      {item.months.map((month) => (
                        <div className={`sip-common-cell ${month.status}`} key={month.monthKey} title={month.scheduled > 0 ? rupeesInWords(month.scheduled) : "No SIP"}>
                          <span>{month.label}</span>
                          <strong>{month.scheduled > 0 ? compactCurrency(month.scheduled) : "—"}</strong>
                          <small>{month.status === "historical" ? "Previous" : month.status === "recorded" ? "Paid" : month.status === "due" ? "Due" : month.status === "planned" ? "Upcoming" : "No SIP"}</small>
                          {month.increased && <b className="sip-increase-mark">↑ Increased</b>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
            {firstSipMonth && <div className="projection-disclaimer">History begins from {monthLabel(firstSipMonth)}. Previous paid months are informational and are never added again to the opening invested amount.</div>}
          </div>
        </CollapsibleCard>

        <CollapsibleCard title={editingGoalId ? "Edit goal" : "Goal setup"} eyebrow="Create and allocate one or many goals" className="span-3" open={goalSetupOpen} onOpenChange={setGoalSetupOpen}>
          <div id="goal-setup" />
          <form className="form-grid" onSubmit={saveGoal}>
            <div className="field"><label>Goal name</label><input value={goalName} onChange={(event) => setGoalName(event.target.value)} placeholder="Home down payment" /></div>
            <div className="field"><label>Target amount</label><input type="number" min="0" value={goalAmount} onChange={(event) => setGoalAmount(event.target.value)} /></div>
            <div className="field"><label>Target date</label><input type="date" value={goalDate} onChange={(event) => setGoalDate(event.target.value)} /></div>
            <div className="field"><label>Current amount assigned to goal</label><input type="number" min="0" value={goalCurrentAllocation} onChange={(event) => setGoalCurrentAllocation(event.target.value)} /></div>
            <div className="field"><label>Monthly SIP assigned to goal</label><input type="number" min="0" value={goalMonthlyContribution} onChange={(event) => setGoalMonthlyContribution(event.target.value)} /></div>
            <div className="field"><label>Expected annual return</label><div className="percentage-input"><input type="number" min="-50" max="50" step="0.1" value={goalExpectedReturn} onChange={(event) => setGoalExpectedReturn(event.target.value)} /><span>%</span></div></div>
            <div className="field"><label>Annual SIP step-up</label><div className="percentage-input"><input type="number" min="0" max="100" step="0.5" value={goalStepUp} onChange={(event) => setGoalStepUp(event.target.value)} /><span>%</span></div></div>
            <div className="field action-field"><button className="button full">{editingGoalId ? "Update goal" : "Add goal"}</button></div>
            {editingGoalId && <div className="field action-field"><button className="button secondary full" type="button" onClick={() => { resetGoalForm(); setGoalSetupOpen(false); }}>Cancel edit</button></div>}
            {goalMessage && <div className={`form-message field full ${goalMessage.includes("added") || goalMessage.includes("updated") ? "success" : "info"}`}>{goalMessage}</div>}
          </form>
          <div className="allocation-warning section-gap">
            Assigned across goals: {currency(assignedGoalCurrent)} of {currency(summary.current)} current value and {currency(assignedGoalSip)} of {currency(currentMonthlySip)} monthly SIP.
          </div>
          {goals.length > 0 && <div className="goal-chip-list section-gap">
            {goals.map((goal) => <div className="goal-chip-card" key={goal.id}><div><strong>{goal.name}</strong><span>{currency(goal.targetAmount)} ({rupeesInWords(goal.targetAmount)}) by {goal.targetDate}</span></div><div className="table-actions"><button className="text-button" type="button" onClick={() => startGoalEdit(goal)}>Edit</button><button className="text-button danger-text" type="button" onClick={() => removeGoal(goal.id)}>Delete</button></div></div>)}
          </div>}
        </CollapsibleCard>

        <CollapsibleCard title="Goal analytics" eyebrow="Exact SIP action for every goal" className="span-3">
          {goalAnalytics.length ? <div className="goal-list">
            {goalAnalytics.map((goal) => {
              const progress = clampPercentage(goal.targetAmount ? (goal.currentAssigned / goal.targetAmount) * 100 : 0);
              return (
                <div className="goal-holding-card" key={goal.id}>
                  <div className="goal-progress-head"><div><strong>{goal.name}</strong><span>{currency(goal.currentGap)} away — {rupeesInWords(goal.currentGap)} · target {goal.targetDate}</span></div><b>{progress}%</b></div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                  <div className="goal-advice-grid">
                    <div className="advice-stat"><span>Current assigned value</span><MoneyValue value={goal.currentAssigned} /></div>
                    <div className="advice-stat"><span>Assigned monthly SIP</span><MoneyValue value={goal.monthlyAssigned} /></div>
                    <div className="advice-stat"><span>Projected by target date</span><MoneyValue value={goal.projectedValue} /></div>
                    <div className="advice-stat"><span>Required monthly SIP</span><MoneyValue value={goal.requiredMonthly} /></div>
                    <div className="advice-stat"><span>Monthly increase needed</span><MoneyValue value={goal.monthlyIncrease} /></div>
                    <div className="advice-stat"><span>Return and step-up</span><strong>{goal.expectedReturn.toFixed(1)}% return · {goal.stepUpPercent.toFixed(1)}% step-up</strong></div>
                  </div>
                  <div className={`notice goal-words ${goal.projectedGap > 0 ? "warning" : ""}`}>
                    <strong>{goal.projectedGap > 0 ? "Specific SIP action" : "Plan status"}</strong>
                    <p>{goal.action}</p>
                    {goal.projectedGap > 0 && <p>The modelled shortfall is {currency(goal.projectedGap)}, which is {rupeesInWords(goal.projectedGap)}.</p>}
                  </div>
                  <button className="text-button goal-edit-inline" type="button" onClick={() => startGoalEdit(goal)}>Edit this goal</button>
                </div>
              );
            })}
          </div> : <EmptyState title="No goals yet" text="Open Goal setup, add a goal and assign the current amount and monthly SIP intended for it." />}
        </CollapsibleCard>

        <CollapsibleCard title="Year-wise growth" eyebrow="Actual stored history" className="span-2">
          {yearlyGrowthData.length ? <LineChart data={yearlyGrowthData} series={[{ key: "invested", label: "Invested" }, { key: "value", label: "Value" }]} height={250} /> : <EmptyState title="Not enough history" text="Record monthly values over time to see year-wise growth." />}
        </CollapsibleCard>

        <CollapsibleCard title="Custom year predictor" eyebrow="Select start and end year" className="span-1">
          <form className="form-grid compact-predictor-grid" onSubmit={(event) => event.preventDefault()}>
            <div className="field"><label>Starting year</label><input type="number" min="2000" max="2100" value={customStartYear} onChange={(event) => setCustomStartYear(event.target.value)} /></div>
            <div className="field"><label>Ending year</label><input type="number" min={customStartYear || "2000"} max="2100" value={customEndYear} onChange={(event) => setCustomEndYear(event.target.value)} /></div>
            <div className="field"><label>Monthly SIP</label><input type="number" min="0" value={customMonthlySip} onChange={(event) => setCustomMonthlySip(event.target.value)} /></div>
            <div className="field"><label>Annual return</label><div className="percentage-input"><input type="number" min="-50" max="50" step="0.1" value={customReturn} onChange={(event) => setCustomReturn(event.target.value)} /><span>%</span></div></div>
            <div className="field"><label>Annual step-up</label><div className="percentage-input"><input type="number" min="0" max="100" step="0.5" value={customStepUp} onChange={(event) => setCustomStepUp(event.target.value)} /><span>%</span></div></div>
          </form>
        </CollapsibleCard>

        <CollapsibleCard title="Custom projection by year" eyebrow={`${customStartYear || stableYear} to ${customEndYear || stableYear}`} className="span-3">
          {customProjectionRows.length ? <>
            <LineChart data={customProjectionRows} series={[{ key: "capital", label: "Current value + contributions" }, { key: "projected", label: "Projected value" }]} height={260} />
            <div className="table-wrap section-gap">
              <table className="prediction-table">
                <thead><tr><th>Year</th><th>SIP added that year</th><th>Total new SIP added</th><th>Projected value</th><th>Projected market gain</th></tr></thead>
                <tbody>{customProjectionRows.map((row) => <tr key={row.year}><td><strong>{row.year}</strong></td><td><MoneyValue value={row.annualContribution} /></td><td><MoneyValue value={row.cumulativeContribution} /></td><td><MoneyValue value={row.projected} /></td><td className={row.gain >= 0 ? "positive" : "negative"}><MoneyValue value={row.gain} signed /></td></tr>)}</tbody>
              </table>
            </div>
            <div className="projection-disclaimer">Projection starts with the latest stored portfolio value of {currency(summary.current)} ({rupeesInWords(summary.current)}). It is an estimate, not a guaranteed return.</div>
          </> : <EmptyState title="Choose a valid year range" text="Ending year must be the same as or later than the starting year." />}
        </CollapsibleCard>

        <CollapsibleCard title="SIP details" eyebrow="Previous SIP history + future manual tracking" className="span-3" defaultOpen={false}>
          <div id="sip-details" className="manage-anchor" />
          <div className="field manage-selector"><label>Select holding</label><select value={sipHoldingId} onChange={(event) => setSipHoldingId(event.target.value)}><option value="">Select holding</option>{state.holdings.map((holding) => <option value={holding.id} key={holding.id}>{holding.name}</option>)}</select></div>
          {!sipHolding ? <EmptyState title="No holding selected" text="Add or select a holding before adding SIP details." /> : <form className="form-grid section-gap" onSubmit={saveSip}>
            <label className="toggle-field field full"><input type="checkbox" checked={sipEnabled} onChange={(event) => setSipEnabled(event.target.checked)} /><span><strong>Active SIP</strong><small>Previous SIPs remain inside the opening invested amount. New SIPs are added only when ticked in the calendar.</small></span></label>
            <div className="field"><label>SIP originally started</label><input type="month" max={currentMonth} value={sipOriginalStartMonth} onChange={(event) => setSipOriginalStartMonth(event.target.value)} /></div>
            <div className="field"><label>Previous SIP amount</label><input type="number" min="0" value={sipPreviousAmount} onChange={(event) => setSipPreviousAmount(event.target.value)} placeholder="Optional" /></div>
            <div className="field"><label>Last SIP already included in opening invested</label><input type="month" max={currentMonth} value={sipLastPaidMonth} onChange={(event) => setSipLastPaidMonth(event.target.value)} /></div>
            <div className="field"><label>Current monthly SIP</label><input type="number" min="0" value={sipAmount} onChange={(event) => setSipAmount(event.target.value)} /></div>
            <div className="field"><label>First month to tick manually</label><input type="month" min={sipLastPaidMonth ? addMonthsToKey(sipLastPaidMonth, 1) : currentMonth} value={sipTrackingMonth} onChange={(event) => setSipTrackingMonth(event.target.value)} />{sipLastPaidMonth && <button type="button" className="inline-helper" onClick={useNextMonthAfterLastPaid}>Use month after last paid</button>}</div>
            <div className="field"><label>Debit day</label><input type="number" min="1" max="28" value={sipDay} onChange={(event) => setSipDay(event.target.value)} /></div>
            <div className="field"><label>Debit account</label><select value={sipAccountId} onChange={(event) => setSipAccountId(event.target.value)}>{state.accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div>
            <div className="field"><label>Annual step-up</label><div className="percentage-input"><input type="number" min="0" max="100" step="0.5" value={sipStepUp} onChange={(event) => setSipStepUp(event.target.value)} /><span>%</span></div></div>
            <div className="field full"><button className="button full">Save SIP details</button></div>
            {sipMessage && <div className={`form-message field full ${sipMessage.includes("saved") || sipMessage.includes("disabled") ? "success" : "info"}`}>{sipMessage}</div>}
          </form>}
        </CollapsibleCard>

        <Card title="Portfolio details" eyebrow="Occasional add or update" className="span-3" action={<div className="tabs compact-tabs"><button type="button" className={detailsTab === "add" ? "active" : ""} onClick={() => setDetailsTab("add")}>Add holding</button><button type="button" className={detailsTab === "update" ? "active" : ""} onClick={() => setDetailsTab("update")}>Update holding</button></div>}>
          <div id="portfolio-details" className="manage-anchor" />
          {detailsTab === "add" ? <form className="form-grid" onSubmit={submitHolding}>
            <div className="form-intro field full"><strong>Add an existing holding</strong><span>Enter the invested total and current value once. Previous SIPs must already be included in the invested total.</span></div>
            <div className="field"><label>Fund / asset name</label><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nifty 50 Index Fund" /></div>
            <div className="field"><label>Symbol <span className="optional">optional</span></label><input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="NIFTY50" /></div>
            <div className="field"><label>Asset class</label><select value={assetClass} onChange={(event) => setAssetClass(event.target.value as AssetClass)}>{assetClasses.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="field"><label>Snapshot month</label><input type="month" max={currentMonth} value={snapshotMonth} onChange={(event) => { setSnapshotMonth(event.target.value); setNewReturns((current) => ({ ...current, asOfMonth: event.target.value })); }} /></div>
            <div className="field"><label>Total invested till this month</label><input type="number" min="0" value={invested} onChange={(event) => setInvested(event.target.value)} /></div>
            <div className="field"><label>Current value</label><input type="number" min="0" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} /></div>
            <div className="field"><label>Individual holding goal</label><input type="number" min="0" value={fundGoal} onChange={(event) => setFundGoal(event.target.value)} /></div>
            <div className="field"><label>Expected annual return</label><div className="percentage-input"><input type="number" min="-50" max="50" step="0.1" value={expectedReturn} onChange={(event) => setExpectedReturn(event.target.value)} /><span>%</span></div></div>
            {isFundAsset(assetClass) && <><AllocationEditor value={newAllocation} onChange={setNewAllocation} /><ReturnSnapshotEditor value={newReturns} onChange={setNewReturns} /></>}
            <div className="field full"><button className="button full">Add holding</button></div>
            {addMessage && <div className={`form-message field full ${addMessage.includes("added") ? "success" : "info"}`}>{addMessage}</div>}
          </form> : <>
            <div className="field manage-selector"><label>Select holding</label><select value={selectedHoldingId} onChange={(event) => setSelectedHoldingId(event.target.value)}><option value="">Select holding</option>{state.holdings.map((holding) => <option value={holding.id} key={holding.id}>{holding.name}</option>)}</select></div>
            {!selectedHolding ? <EmptyState title="No holding selected" text="Add or select a holding to update it." /> : <>
              <form className="form-grid section-gap" onSubmit={saveHoldingChanges}>
                <div className="field"><label>Name</label><input value={editName} onChange={(event) => setEditName(event.target.value)} /></div>
                <div className="field"><label>Symbol</label><input value={editSymbol} onChange={(event) => setEditSymbol(event.target.value)} /></div>
                <div className="field"><label>Asset class</label><select value={editAssetClass} onChange={(event) => setEditAssetClass(event.target.value as AssetClass)}>{assetClasses.map((item) => <option key={item}>{item}</option>)}</select></div>
                <div className="field"><label>Opening invested total</label><input type="number" min="0" value={editOpeningInvested} onChange={(event) => setEditOpeningInvested(event.target.value)} /></div>
                <div className="field"><label>Value month</label><input type="month" max={currentMonth} value={editValueMonth} onChange={(event) => setEditValueMonth(event.target.value)} /></div>
                <div className="field"><label>Current value for month</label><input type="number" min="0" value={editCurrentValue} onChange={(event) => setEditCurrentValue(event.target.value)} /></div>
                <div className="field"><label>Individual holding goal</label><input type="number" min="0" value={editGoal} onChange={(event) => setEditGoal(event.target.value)} /></div>
                <div className="field"><label>Expected annual return</label><div className="percentage-input"><input type="number" min="-50" max="50" step="0.1" value={editExpectedReturn} onChange={(event) => setEditExpectedReturn(event.target.value)} /><span>%</span></div></div>
                {isFundAsset(editAssetClass) && <><AllocationEditor value={editAllocation} onChange={setEditAllocation} /><ReturnSnapshotEditor value={editReturns} onChange={setEditReturns} /></>}
                <div className="field full"><button className="button full">Save holding and monthly value</button></div>
                {editMessage && <div className={`form-message field full ${editMessage.includes("saved") ? "success" : "info"}`}>{editMessage}</div>}
              </form>
              <details className="simple-details section-gap">
                <summary>Add a new lump-sum investment</summary>
                <form className="form-grid simple-details-body" onSubmit={submitAdditional}>
                  <div className="field"><label>Date</label><input type="date" value={additionalDate} onChange={(event) => setAdditionalDate(event.target.value)} /></div>
                  <div className="field"><label>Amount</label><input type="number" min="1" value={additionalAmount} onChange={(event) => setAdditionalAmount(event.target.value)} /></div>
                  <div className="field"><label>Source account</label><select value={additionalAccountId} onChange={(event) => setAdditionalAccountId(event.target.value)}>{state.accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></div>
                  <div className="field action-field"><button className="button secondary full">Add investment</button></div>
                  {additionalMessage && <div className={`form-message field full ${additionalMessage.includes("added") ? "success" : "info"}`}>{additionalMessage}</div>}
                </form>
              </details>
            </>}
          </>}
        </Card>
      </div>
    </>
  );
}
