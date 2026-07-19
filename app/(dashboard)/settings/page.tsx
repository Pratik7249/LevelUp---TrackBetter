"use client";

import { useState, type FormEvent } from "react";
import { Card, Pill } from "@/components/ui";
import { currency } from "@/lib/analytics";
import { useTracker } from "@/lib/store";
import type { MainCategory, MoneySourceType } from "@/lib/types";

export default function SettingsPage() {
  const { state, addAccount, removeAccount, addCategory, removeCategory, resetData, cloudEnabled, user, syncStatus } = useTracker();
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<MoneySourceType>("bank");
  const [balance, setBalance] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [mainCategory, setMainCategory] = useState<MainCategory>("Needs");
  const [subcategories, setSubcategories] = useState("");
  const [message, setMessage] = useState("");

  function submitAccount(event: FormEvent) {
    event.preventDefault();
    if (!accountName.trim()) return;
    addAccount({ name: accountName.trim(), type: accountType, balance: Number(balance) || 0 });
    setAccountName(""); setBalance(""); setMessage("Money source added.");
  }

  function submitCategory(event: FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) return;
    addCategory({ name: categoryName.trim(), mainCategory, subcategories: subcategories.split(",").map((item) => item.trim()).filter(Boolean) });
    setCategoryName(""); setSubcategories(""); setMessage("Category added.");
  }

  function reset() {
    if (window.confirm("Remove all tracker data and restore the default categories?")) {
      resetData();
      setMessage("Tracker data reset.");
    }
  }

  return (
    <>
      <div className="page-heading"><div><h2>Settings</h2><p>Manage accounts, categories and synchronization.</p></div></div>
      {message && <div className="form-message success page-message">{message}</div>}
      <div className="grid two">
        <Card title="Money sources"><div className="list">{state.accounts.map((account) => { const used = state.transactions.some((item) => item.accountId === account.id); return <div className="list-item" key={account.id}><div><strong>{account.name}</strong><span>{account.type} · Balance {currency(account.balance)}</span></div><button className="text-button danger-text" disabled={used || state.accounts.length <= 1} title={used ? "Delete its transactions first" : "Delete account"} onClick={() => removeAccount(account.id)}>Delete</button></div>; })}</div><form onSubmit={submitAccount} className="form-grid card-action"><div className="field"><label>Account name</label><input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="HDFC Bank" /></div><div className="field"><label>Type</label><select value={accountType} onChange={(event) => setAccountType(event.target.value as MoneySourceType)}><option value="bank">Bank</option><option value="wallet">Wallet</option><option value="cash">Cash</option></select></div><div className="field"><label>Opening balance</label><input type="number" value={balance} onChange={(event) => setBalance(event.target.value)} /></div><div className="field align-end"><button className="button full">Add account</button></div></form></Card>
        <Card title="Categories"><div className="list">{state.categories.map((category) => <div className="list-item" key={category.id}><div><strong>{category.name}</strong><span>{category.subcategories.join(" · ") || "No subcategories"}</span></div><div className="row-actions"><Pill tone={category.mainCategory === "Needs" ? "good" : category.mainCategory === "Wants" ? "orange" : "neutral"}>{category.mainCategory}</Pill><button className="text-button danger-text" onClick={() => removeCategory(category.id)}>Delete</button></div></div>)}</div><form onSubmit={submitCategory} className="form-grid card-action"><div className="field"><label>Category name</label><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Education" /></div><div className="field"><label>Type</label><select value={mainCategory} onChange={(event) => setMainCategory(event.target.value as MainCategory)}><option>Needs</option><option>Wants</option><option>Investment</option></select></div><div className="field full"><label>Subcategories <span className="optional">comma separated</span></label><input value={subcategories} onChange={(event) => setSubcategories(event.target.value)} placeholder="Courses, Books, Certifications" /></div><div className="field full"><button className="button full">Add category</button></div></form></Card>
        <Card title="Account and sync"><div className="list"><div className="list-item"><div><strong>{cloudEnabled ? "Google account connected" : "Local browser mode"}</strong><span>{user?.email ?? "Firebase web variables are not configured"}</span></div><Pill tone={cloudEnabled ? "good" : "orange"}>{cloudEnabled ? "Cloud" : "Local"}</Pill></div><div className="list-item"><div><strong>Synchronization</strong><span>{syncStatus === "syncing" ? "Saving your latest changes" : syncStatus === "error" ? "Check Firebase configuration and rules" : syncStatus === "synced" ? "Latest data saved in Firestore" : "Data is stored in this browser"}</span></div><Pill>{syncStatus}</Pill></div></div></Card>
        <Card title="Reset tracker"><div className="notice warning">This removes your transactions, holdings and daily progress. Default categories and one Cash account will remain.</div><button className="button danger full card-action" onClick={reset}>Reset all data</button></Card>
      </div>
    </>
  );
}
