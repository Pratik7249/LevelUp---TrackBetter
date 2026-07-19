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
    messLogsSnapshot,
    reportSnapshot,
    preferencesSnapshot
  ] = await Promise.all([
    userRef.collection("accounts").get(),
    userRef.collection("categories").get(),
    userRef.collection("transactions").orderBy("dateKey", "desc").get(),
    userRef.collection("holdings").get(),
    userRef.collection("habits").get(),
    userRef.collection("habitLogs").get(),
    userRef.collection("messLogs").get(),
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
    return {
      id: item.id,
      name: String(data.name ?? "Holding"),
      ...(data.symbol ? { symbol: String(data.symbol) } : {}),
      assetClass: data.assetClass ?? "Equity",
      invested: Number(data.invested ?? 0),
      currentValue: Number(data.currentValue ?? 0),
      monthlyValues: Array.isArray(data.monthlyValues) ? data.monthlyValues : []
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
  const messCompletions = Object.fromEntries(messLogsSnapshot.docs.map((item) => {
    const data = item.data();
    return [String(data.dateKey ?? item.id), Boolean(data.completed)];
  }));

  return normalizeState({
    schemaVersion: 3,
    accounts: accounts.length ? accounts : defaults.accounts,
    categories: categories.length ? categories : defaults.categories,
    transactions: transactionsSnapshot.docs.map(transactionFromDocument),
    holdings,
    habits: habits.length ? habits : defaults.habits,
    messCompletions,
    reportSettings: { ...defaults.reportSettings, ...(reportSnapshot.exists ? reportSnapshot.data() : {}) } as ReportSettings,
    preferences: { ...defaults.preferences, ...(preferencesSnapshot.exists ? preferencesSnapshot.data() : {}) }
  });
}
