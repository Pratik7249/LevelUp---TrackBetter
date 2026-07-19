import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { cloneDefaultState, normalizeState } from "@/lib/sample-data";
import type { Account, Category, Habit, Holding, ReportSettings, TrackerState, Transaction } from "@/lib/types";

function transactionFromDocument(item: QueryDocumentSnapshot<DocumentData>): Transaction {
  const data = item.data();
  const occurredAt = data.occurredAt?.toDate?.() as Date | undefined;
  return {
    id: item.id,
    type: data.type,
    description: String(data.description ?? "Transaction"),
    amount: Number(data.amount ?? 0),
    date: String(data.dateKey ?? (occurredAt ? occurredAt.toISOString().slice(0, 10) : "")),
    accountId: String(data.accountId ?? ""),
    category: String(data.category ?? "Uncategorized"),
    ...(data.subcategory ? { subcategory: String(data.subcategory) } : {}),
    ...(data.mainCategory ? { mainCategory: data.mainCategory } : {}),
    ...(data.note ? { note: String(data.note) } : {})
  } as Transaction;
}

export async function loadTrackerStateAdmin(uid: string): Promise<TrackerState | null> {
  const db = adminDb();
  const userRef = db.doc(`users/${uid}`);
  const [
    accountsSnapshot,
    categoriesSnapshot,
    transactionsSnapshot,
    holdingsSnapshot,
    habitsSnapshot,
    habitLogsSnapshot,
    dailyCheckinsSnapshot,
    reportSnapshot,
    preferencesSnapshot
  ] = await Promise.all([
    userRef.collection("accounts").get(),
    userRef.collection("categories").get(),
    userRef.collection("transactions").orderBy("dateKey", "desc").get(),
    userRef.collection("holdings").get(),
    userRef.collection("habits").get(),
    userRef.collection("habitLogs").get(),
    userRef.collection("dailyCheckins").get(),
    userRef.collection("reports").doc("settings").get(),
    userRef.collection("settings").doc("preferences").get()
  ]);

  const hasNewData = !accountsSnapshot.empty || !categoriesSnapshot.empty || !transactionsSnapshot.empty || !holdingsSnapshot.empty || !habitsSnapshot.empty;
  if (!hasNewData) {
    const legacy = await userRef.collection("tracker").doc("state").get();
    return legacy.exists ? normalizeState(legacy.data() as Partial<TrackerState>) : null;
  }

  const defaults = cloneDefaultState();
  const completions = new Map<string, Record<string, boolean>>();
  habitLogsSnapshot.docs.forEach((item) => {
    const data = item.data();
    const habitId = String(data.habitId ?? "");
    const dateKey = String(data.dateKey ?? "");
    if (!habitId || !dateKey) return;
    const values = completions.get(habitId) ?? {};
    values[dateKey] = Boolean(data.completed);
    completions.set(habitId, values);
  });

  const accounts: Account[] = accountsSnapshot.docs.map((item) => {
    const data = item.data();
    return { id: item.id, name: String(data.name ?? "Account"), type: data.type ?? "bank", balance: Number(data.balance ?? 0) } as Account;
  });
  const categories: Category[] = categoriesSnapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      name: String(data.name ?? "Category"),
      mainCategory: data.mainCategory ?? "Needs",
      subcategories: Array.isArray(data.subcategories) ? data.subcategories.map(String) : []
    } as Category;
  });
  const holdings: Holding[] = holdingsSnapshot.docs.map((item) => {
    const data = item.data();
    const sip = data.sip && typeof data.sip === "object" ? data.sip as Record<string, unknown> : {};
    const investmentDate = String(data.investmentDate ?? new Date().toISOString().slice(0, 10));
    return {
      id: item.id,
      name: String(data.name ?? "Holding"),
      ...(data.symbol ? { symbol: String(data.symbol) } : {}),
      assetClass: data.assetClass ?? "Mutual Fund",
      ...(data.fundCategory ? { fundCategory: data.fundCategory } : {}),
      investmentDate,
      invested: Number(data.invested ?? 0),
      currentValue: Number(data.currentValue ?? 0),
      goalAmount: Number(data.goalAmount ?? 0),
      expectedAnnualReturn: Number(data.expectedAnnualReturn ?? 12) || 12,
      returnSnapshot: (() => {
        const snapshot = data.returnSnapshot && typeof data.returnSnapshot === "object"
          ? data.returnSnapshot as Record<string, unknown>
          : {};
        const numberOrNull = (value: unknown) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        };
        return {
          asOfMonth: typeof snapshot.asOfMonth === "string" ? snapshot.asOfMonth : investmentDate.slice(0, 7),
          threeMonth: numberOrNull(snapshot.threeMonth),
          sixMonth: numberOrNull(snapshot.sixMonth),
          oneYear: numberOrNull(snapshot.oneYear),
          threeYear: numberOrNull(snapshot.threeYear),
          fiveYear: numberOrNull(snapshot.fiveYear)
        };
      })(),
      allocationBreakdown: Array.isArray(data.allocationBreakdown)
        ? data.allocationBreakdown.map((entry: { category?: unknown; percentage?: unknown }) => ({
            category: String(entry.category ?? "Other"),
            percentage: Math.max(0, Number(entry.percentage ?? 0) || 0)
          })).filter((entry: { percentage: number }) => entry.percentage > 0)
        : data.fundCategory
          ? [{ category: String(data.fundCategory), percentage: 100 }]
          : [],
      monthlyValues: Array.isArray(data.monthlyValues) ? data.monthlyValues : [],
      additionalInvestments: Array.isArray(data.additionalInvestments) ? data.additionalInvestments : [],
      sip: {
        enabled: Boolean(sip.enabled),
        amount: Number(sip.amount ?? 0),
        ...(typeof sip.originalStartMonth === "string" && /^\d{4}-\d{2}$/.test(sip.originalStartMonth)
          ? { originalStartMonth: sip.originalStartMonth }
          : {}),
        ...(Number(sip.previousAmount ?? 0) > 0
          ? { previousAmount: Number(sip.previousAmount) }
          : {}),
        ...(typeof sip.lastPaidMonth === "string" && /^\d{4}-\d{2}$/.test(sip.lastPaidMonth)
          ? { lastPaidMonth: sip.lastPaidMonth }
          : {}),
        startDate: String(sip.startDate ?? investmentDate),
        trackingStartDate: String(sip.trackingStartDate ?? new Date().toISOString().slice(0, 10)),
        dayOfMonth: Math.min(28, Math.max(1, Number(sip.dayOfMonth ?? 1) || 1)),
        accountId: String(sip.accountId ?? ""),
        stepUpPercent: Math.max(0, Number(sip.stepUpPercent ?? 0) || 0)
      }
    } as Holding;
  });
  const habits: Habit[] = habitsSnapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      name: String(data.name ?? "Habit"),
      targetDays: Number(data.targetDays ?? 0),
      completions: completions.get(item.id) ?? {}
    };
  });
  const dailyCheckins = Object.fromEntries(dailyCheckinsSnapshot.docs.map((item) => {
    const data = item.data();
    return [String(data.dateKey ?? item.id), Boolean(data.completed)];
  }));

  return normalizeState({
    schemaVersion: 4,
    accounts: accounts.length ? accounts : defaults.accounts,
    categories: categories.length ? categories : defaults.categories,
    transactions: transactionsSnapshot.docs.map(transactionFromDocument),
    holdings,
    habits: habits.length ? habits : defaults.habits,
    dailyCheckins,
    reportSettings: { ...defaults.reportSettings, ...(reportSnapshot.exists ? reportSnapshot.data() : {}) } as ReportSettings,
    preferences: { ...defaults.preferences, ...(preferencesSnapshot.exists ? preferencesSnapshot.data() : {}) }
  });
}
