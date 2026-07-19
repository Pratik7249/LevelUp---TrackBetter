import type { User } from "firebase/auth";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type Unsubscribe
} from "firebase/firestore";
import { monthSnapshotKey, stripUndefinedDeep } from "@/lib/firestore-utils";
import { cloneDefaultState, normalizeState } from "@/lib/sample-data";
import type {
  Account,
  AppPreferences,
  Category,
  Habit,
  Holding,
  ReportSettings,
  TrackerState,
  Transaction
} from "@/lib/types";

const SUBCOLLECTIONS = [
  "accounts",
  "categories",
  "transactions",
  "holdings",
  "portfolioSnapshots",
  "habits",
  "habitLogs",
  "messLogs"
] as const;

function userDocument(db: Firestore, uid: string) {
  return doc(db, "users", uid);
}

function validDate(dateKey: string) {
  const parsed = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function transactionPayload(transaction: Transaction, source = "web") {
  return stripUndefinedDeep({
    id: transaction.id,
    type: transaction.type,
    description: transaction.description.trim(),
    amount: Number(transaction.amount) || 0,
    accountId: transaction.accountId,
    category: transaction.category,
    subcategory: transaction.subcategory?.trim() || null,
    mainCategory: transaction.mainCategory ?? null,
    note: transaction.note?.trim() || null,
    dateKey: transaction.date,
    occurredAt: Timestamp.fromDate(validDate(transaction.date)),
    source,
    updatedAt: serverTimestamp()
  });
}

function accountPayload(account: Account) {
  return stripUndefinedDeep({
    ...account,
    balance: Number(account.balance) || 0,
    isActive: true,
    updatedAt: serverTimestamp()
  });
}

function categoryPayload(category: Category) {
  return stripUndefinedDeep({
    ...category,
    subcategories: category.subcategories.filter(Boolean),
    isActive: true,
    updatedAt: serverTimestamp()
  });
}

function holdingPayload(holding: Holding) {
  return stripUndefinedDeep({
    ...holding,
    symbol: holding.symbol?.trim() || null,
    invested: Number(holding.invested) || 0,
    currentValue: Number(holding.currentValue) || 0,
    monthlyValues: Array.isArray(holding.monthlyValues) ? holding.monthlyValues : [],
    updatedAt: serverTimestamp()
  });
}

function habitPayload(habit: Habit) {
  return stripUndefinedDeep({
    id: habit.id,
    name: habit.name.trim(),
    targetDays: Number(habit.targetDays) || 0,
    frequency: "daily",
    isActive: true,
    updatedAt: serverTimestamp()
  });
}

function snapshotPayload(holdings: Holding[]) {
  const investedAmount = holdings.reduce((sum, item) => sum + item.invested, 0);
  const currentValue = holdings.reduce((sum, item) => sum + item.currentValue, 0);
  const gainAmount = currentValue - investedAmount;
  return {
    investedAmount,
    currentValue,
    gainAmount,
    gainPercentage: investedAmount ? (gainAmount / investedAmount) * 100 : 0,
    holdingsCount: holdings.length,
    recordedAt: serverTimestamp(),
    source: "web"
  };
}

async function hasDocuments(db: Firestore, uid: string, collectionName: string) {
  const result = await getDocs(query(collection(db, "users", uid, collectionName), limit(1)));
  return !result.empty;
}

type SetOperation = {
  ref: DocumentReference;
  data: Record<string, unknown>;
  merge?: boolean;
};

async function commitSetOperations(db: Firestore, operations: SetOperation[]) {
  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = writeBatch(db);
    operations.slice(offset, offset + 400).forEach((operation) => {
      const data = stripUndefinedDeep(operation.data);
      if (operation.merge) batch.set(operation.ref, data, { merge: true });
      else batch.set(operation.ref, data);
    });
    await batch.commit();
  }
}

async function seedDefaults(db: Firestore, uid: string) {
  const defaults = cloneDefaultState();
  const [hasAccounts, hasCategories, hasHabits, reportDoc, preferenceDoc] = await Promise.all([
    hasDocuments(db, uid, "accounts"),
    hasDocuments(db, uid, "categories"),
    hasDocuments(db, uid, "habits"),
    getDoc(doc(db, "users", uid, "reports", "settings")),
    getDoc(doc(db, "users", uid, "settings", "preferences"))
  ]);

  const operations: SetOperation[] = [];
  if (!hasAccounts) {
    defaults.accounts.forEach((item) => operations.push({
      ref: doc(db, "users", uid, "accounts", item.id),
      data: { ...accountPayload(item), createdAt: serverTimestamp() }
    }));
  }
  if (!hasCategories) {
    defaults.categories.forEach((item) => operations.push({
      ref: doc(db, "users", uid, "categories", item.id),
      data: { ...categoryPayload(item), createdAt: serverTimestamp() }
    }));
  }
  if (!hasHabits) {
    defaults.habits.forEach((item) => operations.push({
      ref: doc(db, "users", uid, "habits", item.id),
      data: { ...habitPayload(item), createdAt: serverTimestamp() }
    }));
  }
  if (!reportDoc.exists()) {
    operations.push({
      ref: doc(db, "users", uid, "reports", "settings"),
      data: { ...defaults.reportSettings, updatedAt: serverTimestamp() }
    });
  }
  if (!preferenceDoc.exists()) {
    operations.push({
      ref: doc(db, "users", uid, "settings", "preferences"),
      data: { ...defaults.preferences, updatedAt: serverTimestamp() }
    });
  }

  if (operations.length) await commitSetOperations(db, operations);
}

async function migrateLegacyState(db: Firestore, uid: string, state: TrackerState) {
  const operations: SetOperation[] = [];

  state.accounts.forEach((item) => operations.push({
    ref: doc(db, "users", uid, "accounts", item.id),
    data: { ...accountPayload(item), createdAt: serverTimestamp() }
  }));
  state.categories.forEach((item) => operations.push({
    ref: doc(db, "users", uid, "categories", item.id),
    data: { ...categoryPayload(item), createdAt: serverTimestamp() }
  }));
  state.transactions.forEach((item) => operations.push({
    ref: doc(db, "users", uid, "transactions", item.id),
    data: { ...transactionPayload(item, "legacy-web"), createdAt: serverTimestamp() }
  }));
  state.holdings.forEach((item) => operations.push({
    ref: doc(db, "users", uid, "holdings", item.id),
    data: { ...holdingPayload(item), createdAt: serverTimestamp() }
  }));
  state.habits.forEach((habit) => {
    operations.push({
      ref: doc(db, "users", uid, "habits", habit.id),
      data: { ...habitPayload(habit), createdAt: serverTimestamp() }
    });
    Object.entries(habit.completions).forEach(([dateKey, completed]) => operations.push({
      ref: doc(db, "users", uid, "habitLogs", `${habit.id}_${dateKey}`),
      data: { habitId: habit.id, dateKey, completed: Boolean(completed), source: "legacy-web", updatedAt: serverTimestamp() }
    }));
  });
  Object.entries(state.messCompletions).forEach(([dateKey, completed]) => operations.push({
    ref: doc(db, "users", uid, "messLogs", dateKey),
    data: { dateKey, completed: Boolean(completed), source: "legacy-web", updatedAt: serverTimestamp() }
  }));
  operations.push({
    ref: doc(db, "users", uid, "reports", "settings"),
    data: { ...state.reportSettings, updatedAt: serverTimestamp() }
  });
  operations.push({
    ref: doc(db, "users", uid, "settings", "preferences"),
    data: { ...state.preferences, updatedAt: serverTimestamp() }
  });
  operations.push({
    ref: doc(db, "users", uid, "portfolioSnapshots", monthSnapshotKey()),
    data: snapshotPayload(state.holdings)
  });

  await commitSetOperations(db, operations);
  await setDoc(userDocument(db, uid), {
    schemaVersion: 3,
    reportAutomationEnabled: Boolean(state.reportSettings.enabled),
    updatedAt: serverTimestamp()
  }, { merge: true });
  await deleteDoc(doc(db, "users", uid, "tracker", "state"));
}

export async function initializeUserWorkspace(db: Firestore, user: User) {
  const rootRef = userDocument(db, user.uid);
  const rootSnapshot = await getDoc(rootRef);
  await setDoc(rootRef, stripUndefinedDeep({
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    provider: "google",
    schemaVersion: 3,
    timezone: "Asia/Kolkata",
    ...(rootSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp()
  }), { merge: true });

  const [hasAccounts, hasCategories, hasTransactions, legacySnapshot] = await Promise.all([
    hasDocuments(db, user.uid, "accounts"),
    hasDocuments(db, user.uid, "categories"),
    hasDocuments(db, user.uid, "transactions"),
    getDoc(doc(db, "users", user.uid, "tracker", "state"))
  ]);

  if (!hasAccounts && !hasCategories && !hasTransactions && legacySnapshot.exists()) {
    await migrateLegacyState(db, user.uid, normalizeState(legacySnapshot.data() as Partial<TrackerState>));
  }

  await seedDefaults(db, user.uid);
}

export type WorkspaceCallbacks = {
  accounts: (items: Account[]) => void;
  categories: (items: Category[]) => void;
  transactions: (items: Transaction[]) => void;
  holdings: (items: Holding[]) => void;
  habits: (items: Array<Omit<Habit, "completions">>) => void;
  habitLogs: (items: Array<{ habitId: string; dateKey: string; completed: boolean }>) => void;
  messLogs: (items: Record<string, boolean>) => void;
  reports: (settings: ReportSettings) => void;
  preferences: (preferences: AppPreferences) => void;
  error: (error: Error) => void;
};

export function subscribeToWorkspace(db: Firestore, uid: string, callbacks: WorkspaceCallbacks): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const onError = (error: Error) => callbacks.error(error);

  unsubs.push(onSnapshot(collection(db, "users", uid, "accounts"), (snapshot) => {
    callbacks.accounts(snapshot.docs.map((item) => {
      const data = item.data();
      return { id: item.id, name: String(data.name ?? "Account"), type: data.type ?? "bank", balance: Number(data.balance ?? 0) } as Account;
    }).sort((a, b) => a.name.localeCompare(b.name)));
  }, onError));

  unsubs.push(onSnapshot(collection(db, "users", uid, "categories"), (snapshot) => {
    callbacks.categories(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        name: String(data.name ?? "Category"),
        mainCategory: data.mainCategory ?? "Needs",
        subcategories: Array.isArray(data.subcategories) ? data.subcategories.map(String) : []
      } as Category;
    }).sort((a, b) => a.name.localeCompare(b.name)));
  }, onError));

  unsubs.push(onSnapshot(query(collection(db, "users", uid, "transactions"), orderBy("dateKey", "desc")), (snapshot) => {
    callbacks.transactions(snapshot.docs.map((item) => {
      const data = item.data();
      const occurredAt = data.occurredAt instanceof Timestamp ? data.occurredAt.toDate() : null;
      const dateKey = String(data.dateKey ?? (occurredAt ? occurredAt.toISOString().slice(0, 10) : ""));
      return {
        id: item.id,
        type: data.type,
        description: String(data.description ?? "Transaction"),
        amount: Number(data.amount ?? 0),
        date: dateKey,
        accountId: String(data.accountId ?? ""),
        category: String(data.category ?? "Uncategorized"),
        ...(data.subcategory ? { subcategory: String(data.subcategory) } : {}),
        ...(data.mainCategory ? { mainCategory: data.mainCategory } : {}),
        ...(data.note ? { note: String(data.note) } : {})
      } as Transaction;
    }));
  }, onError));

  unsubs.push(onSnapshot(collection(db, "users", uid, "holdings"), (snapshot) => {
    callbacks.holdings(snapshot.docs.map((item) => {
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
    }).sort((a, b) => a.name.localeCompare(b.name)));
  }, onError));

  unsubs.push(onSnapshot(collection(db, "users", uid, "habits"), (snapshot) => {
    callbacks.habits(snapshot.docs.map((item) => {
      const data = item.data();
      return { id: item.id, name: String(data.name ?? "Habit"), targetDays: Number(data.targetDays ?? 0) };
    }).sort((a, b) => a.name.localeCompare(b.name)));
  }, onError));

  unsubs.push(onSnapshot(collection(db, "users", uid, "habitLogs"), (snapshot) => {
    callbacks.habitLogs(snapshot.docs.map((item) => {
      const data = item.data();
      return { habitId: String(data.habitId ?? ""), dateKey: String(data.dateKey ?? ""), completed: Boolean(data.completed) };
    }).filter((item) => item.habitId && item.dateKey));
  }, onError));

  unsubs.push(onSnapshot(collection(db, "users", uid, "messLogs"), (snapshot) => {
    callbacks.messLogs(Object.fromEntries(snapshot.docs.map((item) => {
      const data = item.data();
      return [String(data.dateKey ?? item.id), Boolean(data.completed)];
    })));
  }, onError));

  unsubs.push(onSnapshot(doc(db, "users", uid, "reports", "settings"), (snapshot) => {
    const defaults = cloneDefaultState().reportSettings;
    callbacks.reports({ ...defaults, ...(snapshot.exists() ? snapshot.data() : {}) } as ReportSettings);
  }, onError));

  unsubs.push(onSnapshot(doc(db, "users", uid, "settings", "preferences"), (snapshot) => {
    const defaults = cloneDefaultState().preferences;
    callbacks.preferences({ ...defaults, ...(snapshot.exists() ? snapshot.data() : {}) } as AppPreferences);
  }, onError));

  return () => unsubs.forEach((unsubscribe) => unsubscribe());
}

export async function createTransaction(db: Firestore, uid: string, transaction: Transaction) {
  const transactionRef = doc(db, "users", uid, "transactions", transaction.id);
  const accountRef = doc(db, "users", uid, "accounts", transaction.accountId);
  await runTransaction(db, async (operation) => {
    const accountSnapshot = await operation.get(accountRef);
    operation.set(transactionRef, { ...transactionPayload(transaction), createdAt: serverTimestamp() });
    if (accountSnapshot.exists()) {
      const currentBalance = Number(accountSnapshot.data().balance ?? 0);
      const delta = transaction.type === "income" ? transaction.amount : -transaction.amount;
      operation.update(accountRef, { balance: currentBalance + delta, updatedAt: serverTimestamp() });
    }
  });
}

export async function deleteTransaction(db: Firestore, uid: string, transactionId: string) {
  const transactionRef = doc(db, "users", uid, "transactions", transactionId);
  await runTransaction(db, async (operation) => {
    const transactionSnapshot = await operation.get(transactionRef);
    if (!transactionSnapshot.exists()) return;
    const data = transactionSnapshot.data();
    const accountId = String(data.accountId ?? "");
    const accountRef = accountId ? doc(db, "users", uid, "accounts", accountId) : null;
    const accountSnapshot = accountRef ? await operation.get(accountRef) : null;
    if (accountRef && accountSnapshot?.exists()) {
      const amount = Number(data.amount ?? 0);
      const currentBalance = Number(accountSnapshot.data().balance ?? 0);
      const reversedDelta = data.type === "income" ? -amount : amount;
      operation.update(accountRef, { balance: currentBalance + reversedDelta, updatedAt: serverTimestamp() });
    }
    operation.delete(transactionRef);
  });
}

export async function saveAccount(db: Firestore, uid: string, account: Account) {
  await setDoc(doc(db, "users", uid, "accounts", account.id), { ...accountPayload(account), createdAt: serverTimestamp() });
}

export async function deleteAccount(db: Firestore, uid: string, accountId: string) {
  await deleteDoc(doc(db, "users", uid, "accounts", accountId));
}

export async function saveCategory(db: Firestore, uid: string, category: Category) {
  await setDoc(doc(db, "users", uid, "categories", category.id), { ...categoryPayload(category), createdAt: serverTimestamp() });
}

export async function deleteCategory(db: Firestore, uid: string, categoryId: string) {
  await deleteDoc(doc(db, "users", uid, "categories", categoryId));
}

export async function saveHolding(db: Firestore, uid: string, holding: Holding, nextHoldings: Holding[]) {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid, "holdings", holding.id), { ...holdingPayload(holding), createdAt: serverTimestamp() }, { merge: true });
  batch.set(doc(db, "users", uid, "portfolioSnapshots", monthSnapshotKey()), snapshotPayload(nextHoldings), { merge: true });
  await batch.commit();
}

export async function deleteHolding(db: Firestore, uid: string, holdingId: string, nextHoldings: Holding[]) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid, "holdings", holdingId));
  batch.set(doc(db, "users", uid, "portfolioSnapshots", monthSnapshotKey()), snapshotPayload(nextHoldings), { merge: true });
  await batch.commit();
}

export async function saveHabit(db: Firestore, uid: string, habit: Habit) {
  await setDoc(doc(db, "users", uid, "habits", habit.id), { ...habitPayload(habit), createdAt: serverTimestamp() });
}

export async function deleteHabit(db: Firestore, uid: string, habitId: string) {
  const logs = await getDocs(query(collection(db, "users", uid, "habitLogs"), where("habitId", "==", habitId)));
  const batch = writeBatch(db);
  logs.docs.forEach((item) => batch.delete(item.ref));
  batch.delete(doc(db, "users", uid, "habits", habitId));
  await batch.commit();
}

export async function setHabitCompletion(db: Firestore, uid: string, habitId: string, dateKey: string, completed: boolean) {
  await setDoc(doc(db, "users", uid, "habitLogs", `${habitId}_${dateKey}`), {
    habitId,
    dateKey,
    completed,
    source: "web",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function setMessCompletion(db: Firestore, uid: string, dateKey: string, completed: boolean) {
  await setDoc(doc(db, "users", uid, "messLogs", dateKey), {
    dateKey,
    completed,
    source: "web",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function saveReportSettings(db: Firestore, uid: string, settings: ReportSettings) {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", uid, "reports", "settings"), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
  batch.set(userDocument(db, uid), {
    reportAutomationEnabled: Boolean(settings.enabled),
    reportEmail: settings.email.trim(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  await batch.commit();
}

export async function savePreferences(db: Firestore, uid: string, preferences: AppPreferences) {
  await setDoc(doc(db, "users", uid, "settings", "preferences"), {
    ...preferences,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function deleteDocuments(db: Firestore, references: DocumentReference[]) {
  for (let offset = 0; offset < references.length; offset += 400) {
    const batch = writeBatch(db);
    references.slice(offset, offset + 400).forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

export async function resetWorkspace(db: Firestore, uid: string) {
  const snapshots = await Promise.all(SUBCOLLECTIONS.map((name) => getDocs(collection(db, "users", uid, name))));
  const references = snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.ref));
  references.push(doc(db, "users", uid, "reports", "settings"));
  references.push(doc(db, "users", uid, "settings", "preferences"));
  references.push(doc(db, "users", uid, "tracker", "state"));
  await deleteDocuments(db, references);
  await setDoc(userDocument(db, uid), {
    schemaVersion: 3,
    reportAutomationEnabled: false,
    reportEmail: "",
    updatedAt: serverTimestamp()
  }, { merge: true });
  await seedDefaults(db, uid);
}
