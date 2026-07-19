"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toDateInput } from "@/lib/analytics";
import { useTracker } from "@/lib/store";
import type { MainCategory, TransactionType } from "@/lib/types";

export function TransactionForm({ type }: { type: Extract<TransactionType, "income" | "expense"> }) {
  const { state, addTransaction } = useTracker();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");
  const [mainCategory, setMainCategory] = useState<MainCategory>("Needs");
  const filteredCategories = useMemo(() => state.categories.filter((category) => category.mainCategory === mainCategory), [mainCategory, state.categories]);
  const [category, setCategory] = useState(type === "income" ? "Salary" : "");
  const [subcategory, setSubcategory] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const incomeCategories = ["Salary", "Freelance", "Business", "Interest", "Gift", "Other"];

  useEffect(() => {
    if (!accountId && state.accounts[0]) setAccountId(state.accounts[0].id);
  }, [accountId, state.accounts]);

  useEffect(() => {
    if (type === "income") return;
    const first = filteredCategories[0];
    if (!filteredCategories.some((item) => item.name === category)) {
      setCategory(first?.name ?? "");
      setSubcategory(first?.subcategories[0] ?? "");
    }
  }, [category, filteredCategories, type]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!description.trim() || numericAmount <= 0 || !accountId || !category || !date) {
      setMessage("Complete all required fields.");
      return;
    }

    const transactionType: TransactionType = type === "income"
      ? "income"
      : mainCategory === "Investment" ? "investment" : "expense";

    addTransaction({
      type: transactionType,
      description: description.trim(),
      amount: numericAmount,
      date,
      accountId,
      category,
      subcategory: type === "expense" ? subcategory || undefined : undefined,
      mainCategory: type === "expense" ? mainCategory : undefined,
      note: note.trim() || undefined
    });
    setDescription("");
    setAmount("");
    setNote("");
    setMessage(type === "income" ? "Income added." : transactionType === "investment" ? "Investment added." : "Expense added.");
  }

  return (
    <form onSubmit={submit} className="form-grid">
      <div className="field full"><label>{type === "income" ? "Income description" : "Expense description"}</label><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={type === "income" ? "Monthly salary" : "Weekly groceries"} /></div>
      <div className="field"><label>Amount</label><input type="number" min="1" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></div>
      <div className="field"><label>Date</label><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
      <div className="field"><label>{type === "income" ? "Received in" : "Paid from"}</label><select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</select></div>
      {type === "expense" && <div className="field"><label>Type</label><select value={mainCategory} onChange={(event) => setMainCategory(event.target.value as MainCategory)}><option>Needs</option><option>Wants</option><option>Investment</option></select></div>}
      <div className="field"><label>Category</label><select value={category} onChange={(event) => { setCategory(event.target.value); const next = state.categories.find((item) => item.name === event.target.value); setSubcategory(next?.subcategories[0] ?? ""); }}>{(type === "income" ? incomeCategories : filteredCategories.map((item) => item.name)).map((item) => <option key={item}>{item}</option>)}</select></div>
      {type === "expense" && <div className="field"><label>Subcategory</label><select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}><option value="">General</option>{(state.categories.find((item) => item.name === category)?.subcategories ?? []).map((item) => <option key={item}>{item}</option>)}</select></div>}
      <div className="field full"><label>Note <span className="optional">optional</span></label><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add context" /></div>
      <div className="field full"><button className="button full" type="submit">Add {type === "income" ? "income" : mainCategory === "Investment" ? "investment" : "expense"}</button></div>
      {message && <div className="form-message success field full">{message}</div>}
    </form>
  );
}
