"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User
} from "firebase/auth";
import { ensureAuthPersistence, firebaseAuth, firestore, isFirebaseConfigured } from "./firebase/client";
import {
  createTransaction,
  deleteAccount as deleteAccountDocument,
  deleteCategory as deleteCategoryDocument,
  deleteHabit as deleteHabitDocument,
  deleteHolding as deleteHoldingDocument,
  deleteTransaction as deleteTransactionDocument,
  initializeUserWorkspace,
  resetWorkspace,
  saveAccount,
  saveCategory,
  saveHabit,
  saveHolding,
  savePreferences,
  saveReportSettings,
  setHabitCompletion,
  setMessCompletion,
  subscribeToWorkspace
} from "./firebase/state-repository";
import { cloneDefaultState, normalizeState } from "./sample-data";
import type {
  Account,
  AppPreferences,
  Category,
  Habit,
  Holding,
  TrackerState,
  Transaction
} from "./types";

const LOCAL_KEY = "trackbetter-state-v3";
const REQUIRED_SNAPSHOTS = 9;

type SyncStatus = "local" | "loading" | "syncing" | "synced" | "error";

type StoreValue = {
  state: TrackerState;
  ready: boolean;
  authReady: boolean;
  cloudEnabled: boolean;
  user: User | null;
  syncStatus: SyncStatus;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
  waitForSync: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  removeTransaction: (transactionId: string) => void;
  addAccount: (account: Omit<Account, "id">) => void;
  removeAccount: (accountId: string) => void;
  addCategory: (category: Omit<Category, "id">) => void;
  removeCategory: (categoryId: string) => void;
  addHolding: (holding: Omit<Holding, "id">) => void;
  updateHolding: (holdingId: string, values: Partial<Pick<Holding, "invested" | "currentValue">>) => void;
  removeHolding: (holdingId: string) => void;
  addHabit: (habit: Omit<Habit, "id" | "completions">) => void;
  removeHabit: (habitId: string) => void;
  toggleHabit: (habitId: string, date: string) => void;
  toggleMess: (date: string) => void;
  updateReportSettings: (settings: TrackerState["reportSettings"]) => void;
  updatePreferences: (preferences: AppPreferences) => void;
  resetData: () => void;
};

const TrackerContext = createContext<StoreValue | null>(null);
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function friendlyAuthError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was cancelled.";
  if (code.includes("unauthorized-domain")) return "This domain is not authorized in Firebase Authentication.";
  if (code.includes("network-request-failed")) return "Network error. Check your connection and try again.";
  return error instanceof Error ? error.message : "Unable to sign in with Google.";
}

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TrackerState>(() => cloneDefaultState());
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isFirebaseConfigured ? "loading" : "local");
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const loadedSnapshotsRef = useRef(new Set<string>());
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const markLoaded = useCallback((key: string) => {
    loadedSnapshotsRef.current.add(key);
    if (loadedSnapshotsRef.current.size >= REQUIRED_SNAPSHOTS) {
      hydratedRef.current = true;
      setReady(true);
      setSyncStatus("synced");
    }
  }, []);

  const queueCloudWrite = useCallback((operation: () => Promise<void>) => {
    if (!firestore || !user) return Promise.resolve();
    setSyncStatus("syncing");

    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(operation)
      .then(() => {
        setSyncStatus("synced");
        setError(null);
      })
      .catch((writeError) => {
        console.error("Firestore synchronization failed:", writeError);
        setSyncStatus("error");
        setError(writeError instanceof Error ? writeError.message : "Cloud synchronization failed.");
      });

    return writeQueueRef.current;
  }, [user]);

  const setOptimisticState = useCallback((recipe: (current: TrackerState) => TrackerState) => {
    setState((current) => {
      const next = normalizeState(recipe(current));
      if (hydratedRef.current && (!isFirebaseConfigured || !user)) {
        window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        setSyncStatus("local");
      }
      return next;
    });
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth || !firestore) {
      const saved = window.localStorage.getItem(LOCAL_KEY);
      if (saved) {
        try {
          setState(normalizeState(JSON.parse(saved) as Partial<TrackerState>));
        } catch {
          window.localStorage.removeItem(LOCAL_KEY);
        }
      }
      hydratedRef.current = true;
      setReady(true);
      setAuthReady(true);
      setSyncStatus("local");
      return;
    }

    let unsubscribeWorkspace: (() => void) | undefined;
    let active = true;

    void ensureAuthPersistence().catch((persistenceError) => {
      console.error("Unable to enable local auth persistence:", persistenceError);
    });

    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      if (!active) return;
      unsubscribeWorkspace?.();
      unsubscribeWorkspace = undefined;
      loadedSnapshotsRef.current = new Set();
      hydratedRef.current = false;
      setUser(nextUser);
      setAuthReady(true);
      setError(null);

      if (!nextUser) {
        setState(cloneDefaultState());
        setReady(true);
        setSyncStatus("loading");
        return;
      }

      setReady(false);
      setSyncStatus("loading");

      try {
        await initializeUserWorkspace(firestore!, nextUser);
        if (!active) return;

        unsubscribeWorkspace = subscribeToWorkspace(firestore!, nextUser.uid, {
          accounts: (accounts) => {
            setState((current) => ({ ...current, accounts }));
            markLoaded("accounts");
          },
          categories: (categories) => {
            setState((current) => ({ ...current, categories }));
            markLoaded("categories");
          },
          transactions: (transactions) => {
            setState((current) => ({ ...current, transactions }));
            markLoaded("transactions");
          },
          holdings: (holdings) => {
            setState((current) => ({ ...current, holdings }));
            markLoaded("holdings");
          },
          habits: (definitions) => {
            setState((current) => ({
              ...current,
              habits: definitions.map((habit) => ({
                ...habit,
                completions: current.habits.find((item) => item.id === habit.id)?.completions ?? {}
              }))
            }));
            markLoaded("habits");
          },
          habitLogs: (logs) => {
            const byHabit = new Map<string, Record<string, boolean>>();
            logs.forEach((log) => {
              const completions = byHabit.get(log.habitId) ?? {};
              completions[log.dateKey] = log.completed;
              byHabit.set(log.habitId, completions);
            });
            setState((current) => ({
              ...current,
              habits: current.habits.map((habit) => ({ ...habit, completions: byHabit.get(habit.id) ?? {} }))
            }));
            markLoaded("habitLogs");
          },
          messLogs: (messCompletions) => {
            setState((current) => ({ ...current, messCompletions }));
            markLoaded("messLogs");
          },
          reports: (reportSettings) => {
            setState((current) => ({ ...current, reportSettings }));
            markLoaded("reports");
          },
          preferences: (preferences) => {
            setState((current) => ({ ...current, preferences }));
            markLoaded("preferences");
          },
          error: (snapshotError) => {
            console.error("Firestore subscription failed:", snapshotError);
            setError(snapshotError.message);
            setSyncStatus("error");
            setReady(true);
          }
        });
      } catch (initializationError) {
        console.error("Unable to initialize Firestore workspace:", initializationError);
        setError(initializationError instanceof Error ? initializationError.message : "Unable to initialize cloud data.");
        setSyncStatus("error");
        setReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribeWorkspace?.();
      unsubscribeAuth();
    };
  }, [markLoaded]);

  const signInGoogle = useCallback(async () => {
    if (!firebaseAuth || !isFirebaseConfigured) {
      setError("Add the Firebase web environment variables before using Google login.");
      return;
    }

    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await ensureAuthPersistence();
      await signInWithPopup(firebaseAuth, provider);
    } catch (authError) {
      const code = typeof authError === "object" && authError && "code" in authError ? String((authError as { code: unknown }).code) : "";
      if (code.includes("popup-blocked")) {
        await signInWithRedirect(firebaseAuth, provider);
        return;
      }
      setError(friendlyAuthError(authError));
      throw authError;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (!firebaseAuth) return;
    await writeQueueRef.current.catch(() => undefined);
    await signOut(firebaseAuth);
  }, []);

  const value = useMemo<StoreValue>(() => ({
    state,
    ready,
    authReady,
    cloudEnabled: isFirebaseConfigured,
    user,
    syncStatus,
    error,
    signInWithGoogle: signInGoogle,
    signOutUser,
    getAuthToken: async () => firebaseAuth?.currentUser ? firebaseAuth.currentUser.getIdToken() : null,
    waitForSync: () => writeQueueRef.current.catch(() => undefined),
    addTransaction: (transactionInput) => {
      const transaction: Transaction = { ...transactionInput, id: makeId("txn") };
      setOptimisticState((current) => ({
        ...current,
        accounts: current.accounts.map((account) => account.id === transaction.accountId
          ? { ...account, balance: account.balance + (transaction.type === "income" ? transaction.amount : -transaction.amount) }
          : account),
        transactions: [transaction, ...current.transactions]
      }));
      if (firestore && user) void queueCloudWrite(() => createTransaction(firestore!, user.uid, transaction));
    },
    removeTransaction: (transactionId) => {
      const transaction = state.transactions.find((item) => item.id === transactionId);
      if (!transaction) return;
      setOptimisticState((current) => ({
        ...current,
        accounts: current.accounts.map((account) => account.id === transaction.accountId
          ? { ...account, balance: account.balance - (transaction.type === "income" ? transaction.amount : -transaction.amount) }
          : account),
        transactions: current.transactions.filter((item) => item.id !== transactionId)
      }));
      if (firestore && user) void queueCloudWrite(() => deleteTransactionDocument(firestore!, user.uid, transactionId));
    },
    addAccount: (accountInput) => {
      const account: Account = { ...accountInput, id: makeId("account") };
      setOptimisticState((current) => ({ ...current, accounts: [...current.accounts, account] }));
      if (firestore && user) void queueCloudWrite(() => saveAccount(firestore!, user.uid, account));
    },
    removeAccount: (accountId) => {
      if (state.transactions.some((item) => item.accountId === accountId) || state.accounts.length <= 1) return;
      setOptimisticState((current) => ({ ...current, accounts: current.accounts.filter((item) => item.id !== accountId) }));
      if (firestore && user) void queueCloudWrite(() => deleteAccountDocument(firestore!, user.uid, accountId));
    },
    addCategory: (categoryInput) => {
      const category: Category = { ...categoryInput, id: makeId("category") };
      setOptimisticState((current) => ({ ...current, categories: [...current.categories, category] }));
      if (firestore && user) void queueCloudWrite(() => saveCategory(firestore!, user.uid, category));
    },
    removeCategory: (categoryId) => {
      setOptimisticState((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== categoryId) }));
      if (firestore && user) void queueCloudWrite(() => deleteCategoryDocument(firestore!, user.uid, categoryId));
    },
    addHolding: (holdingInput) => {
      const holding: Holding = { ...holdingInput, id: makeId("holding") };
      const nextHoldings = [...state.holdings, holding];
      setOptimisticState((current) => ({ ...current, holdings: [...current.holdings, holding] }));
      if (firestore && user) void queueCloudWrite(() => saveHolding(firestore!, user.uid, holding, nextHoldings));
    },
    updateHolding: (holdingId, values) => {
      const existing = state.holdings.find((item) => item.id === holdingId);
      if (!existing) return;
      const currentValue = values.currentValue ?? existing.currentValue;
      const month = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(new Date());
      const monthlyValues = existing.monthlyValues.some((point) => point.month === month)
        ? existing.monthlyValues.map((point) => point.month === month ? { ...point, value: currentValue } : point)
        : [...existing.monthlyValues, { month, value: currentValue }];
      const updated: Holding = { ...existing, ...values, monthlyValues };
      const nextHoldings = state.holdings.map((item) => item.id === holdingId ? updated : item);
      setOptimisticState((current) => ({ ...current, holdings: current.holdings.map((item) => item.id === holdingId ? updated : item) }));
      if (firestore && user) void queueCloudWrite(() => saveHolding(firestore!, user.uid, updated, nextHoldings));
    },
    removeHolding: (holdingId) => {
      const nextHoldings = state.holdings.filter((item) => item.id !== holdingId);
      setOptimisticState((current) => ({ ...current, holdings: current.holdings.filter((item) => item.id !== holdingId) }));
      if (firestore && user) void queueCloudWrite(() => deleteHoldingDocument(firestore!, user.uid, holdingId, nextHoldings));
    },
    addHabit: (habitInput) => {
      const habit: Habit = { ...habitInput, id: makeId("habit"), completions: {} };
      setOptimisticState((current) => ({ ...current, habits: [...current.habits, habit] }));
      if (firestore && user) void queueCloudWrite(() => saveHabit(firestore!, user.uid, habit));
    },
    removeHabit: (habitId) => {
      if (state.habits.length <= 1) return;
      setOptimisticState((current) => ({ ...current, habits: current.habits.filter((item) => item.id !== habitId) }));
      if (firestore && user) void queueCloudWrite(() => deleteHabitDocument(firestore!, user.uid, habitId));
    },
    toggleHabit: (habitId, date) => {
      const habit = state.habits.find((item) => item.id === habitId);
      if (!habit) return;
      const completed = !habit.completions[date];
      setOptimisticState((current) => ({
        ...current,
        habits: current.habits.map((item) => item.id === habitId
          ? { ...item, completions: { ...item.completions, [date]: completed } }
          : item)
      }));
      if (firestore && user) void queueCloudWrite(() => setHabitCompletion(firestore!, user.uid, habitId, date, completed));
    },
    toggleMess: (date) => {
      const completed = !state.messCompletions[date];
      setOptimisticState((current) => ({ ...current, messCompletions: { ...current.messCompletions, [date]: completed } }));
      if (firestore && user) void queueCloudWrite(() => setMessCompletion(firestore!, user.uid, date, completed));
    },
    updateReportSettings: (reportSettings) => {
      setOptimisticState((current) => ({ ...current, reportSettings }));
      if (firestore && user) void queueCloudWrite(() => saveReportSettings(firestore!, user.uid, reportSettings));
    },
    updatePreferences: (preferences) => {
      setOptimisticState((current) => ({ ...current, preferences }));
      if (firestore && user) void queueCloudWrite(() => savePreferences(firestore!, user.uid, preferences));
    },
    resetData: () => {
      setOptimisticState(() => cloneDefaultState());
      if (firestore && user) void queueCloudWrite(() => resetWorkspace(firestore!, user.uid));
    }
  }), [authReady, error, queueCloudWrite, ready, setOptimisticState, signInGoogle, signOutUser, state, syncStatus, user]);

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker() {
  const value = useContext(TrackerContext);
  if (!value) throw new Error("useTracker must be used inside TrackerProvider");
  return value;
}
