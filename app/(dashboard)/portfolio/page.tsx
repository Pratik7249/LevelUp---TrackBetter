"use client";

import { useState, type FormEvent } from "react";
import { BarChart, DonutChart, LineChart } from "@/components/charts";
import { Card, EmptyState, MetricCard, Pill } from "@/components/ui";
import { currency, portfolioSeries, portfolioTotals } from "@/lib/analytics";
import { useTracker } from "@/lib/store";
import type { Holding } from "@/lib/types";

function HoldingValueEditor({ holding }: { holding: Holding }) {
  const { updateHolding, removeHolding } = useTracker();
  const [value, setValue] = useState(String(holding.currentValue));
  const gain = holding.currentValue - holding.invested;

  function save() {
    const next = Number(value);
    if (next >= 0) updateHolding(holding.id, { currentValue: next });
  }

  return <tr><td><strong>{holding.name}</strong><span className="table-subtitle">{holding.symbol || holding.assetClass}</span></td><td><Pill>{holding.assetClass}</Pill></td><td>{currency(holding.invested)}</td><td><div className="inline-edit"><input type="number" min="0" value={value} onChange={(event) => setValue(event.target.value)} /><button className="text-button" onClick={save}>Save</button></div></td><td className={gain >= 0 ? "positive" : "negative"}>{gain >= 0 ? "+" : ""}{currency(gain)}</td><td className={gain >= 0 ? "positive" : "negative"}>{holding.invested ? ((gain / holding.invested) * 100).toFixed(1) : "0.0"}%</td><td><button className="text-button danger-text" onClick={() => removeHolding(holding.id)}>Delete</button></td></tr>;
}

export default function PortfolioPage() {
  const { state, addHolding } = useTracker();
  const summary = portfolioTotals(state);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [assetClass, setAssetClass] = useState<Holding["assetClass"]>("Mutual Fund");
  const [invested, setInvested] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [message, setMessage] = useState("");
  const allocation = Object.entries(state.holdings.reduce<Record<string, number>>((map, item) => { map[item.assetClass] = (map[item.assetClass] ?? 0) + item.currentValue; return map; }, {})).map(([label, value]) => ({ label, value }));
  const returns = state.holdings.map((holding) => ({ label: holding.name, value: holding.currentValue - holding.invested }));
  const best = [...state.holdings].sort((a, b) => (b.currentValue - b.invested) - (a.currentValue - a.invested))[0];

  function submit(event: FormEvent) {
    event.preventDefault();
    const investedAmount = Number(invested);
    const valueAmount = Number(currentValue);
    if (!name.trim() || investedAmount < 0 || valueAmount < 0) {
      setMessage("Enter a name and valid amounts.");
      return;
    }
    const month = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(new Date());
    addHolding({ name: name.trim(), symbol: symbol.trim() || undefined, assetClass, invested: investedAmount, currentValue: valueAmount, monthlyValues: [{ month, value: valueAmount }] });
    setName(""); setSymbol(""); setInvested(""); setCurrentValue(""); setMessage("Holding added.");
  }

  return (
    <>
      <div className="page-heading"><div><h2>Investment portfolio</h2><p>Review allocation, returns and progress. Update current values whenever needed.</p></div></div>
      <div className="grid four">
        <MetricCard icon="PF" label="Portfolio value" value={currency(summary.current)} change={`${summary.gain >= 0 ? "+" : ""}${summary.gainPercent.toFixed(1)}% overall`} />
        <MetricCard icon="IV" label="Total invested" value={currency(summary.invested)} />
        <MetricCard icon="GL" label="Gain or loss" value={currency(summary.gain)} change={`${summary.gainPercent.toFixed(1)}% return`} />
        <MetricCard icon="HD" label="Holdings" value={String(state.holdings.length)} />
      </div>
      <div className="grid three section-gap">
        <Card title="Portfolio progress" className="span-2">{state.holdings.length ? <LineChart data={portfolioSeries(state)} series={[{ key: "value", label: "Portfolio value" }]} height={270} /> : <EmptyState title="No portfolio data" text="Add your first holding to start the progress line." />}</Card>
        <Card title="Asset allocation">{allocation.length ? <DonutChart data={allocation} centerLabel={currency(summary.current)} /> : <EmptyState title="No allocation yet" text="Your asset-class split will appear here." />}</Card>
        <Card title="Add holding"><form className="form-grid" onSubmit={submit}><div className="field full"><label>Investment name</label><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nifty 50 Index Fund" /></div><div className="field"><label>Symbol <span className="optional">optional</span></label><input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="NIFTY" /></div><div className="field"><label>Asset class</label><select value={assetClass} onChange={(event) => setAssetClass(event.target.value as Holding["assetClass"])}><option>Equity</option><option>Mutual Fund</option><option>Gold</option><option>Debt</option><option>Crypto</option><option>Cash</option></select></div><div className="field"><label>Invested amount</label><input type="number" min="0" value={invested} onChange={(event) => setInvested(event.target.value)} /></div><div className="field"><label>Current value</label><input type="number" min="0" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} /></div><div className="field full"><button className="button full">Add holding</button></div>{message && <div className="form-message success field full">{message}</div>}</form></Card>
        <Card title="Gain by holding" className="span-2">{returns.length ? <BarChart data={returns} /> : <EmptyState title="No returns yet" text="Add holdings to compare their gain or loss." />}</Card>
        <Card title="Portfolio review"><div className="list"><div className="list-item"><div><strong>Diversification</strong><span>{allocation.length} asset class{allocation.length === 1 ? "" : "es"}</span></div><Pill tone={allocation.length >= 3 ? "good" : "orange"}>{allocation.length >= 3 ? "Good" : "Build more"}</Pill></div><div className="list-item"><div><strong>Best performer</strong><span>{best?.name ?? "No holdings"}</span></div>{best && <strong className={best.currentValue >= best.invested ? "positive" : "negative"}>{currency(best.currentValue - best.invested)}</strong>}</div><div className="list-item"><div><strong>Overall position</strong><span>Current value minus invested amount</span></div><strong className={summary.gain >= 0 ? "positive" : "negative"}>{currency(summary.gain)}</strong></div></div></Card>
        <Card title="Holdings" className="span-3"><div className="table-wrap"><table><thead><tr><th>Asset</th><th>Class</th><th>Invested</th><th>Current value</th><th>Gain / loss</th><th>Return</th><th /></tr></thead><tbody>{state.holdings.map((holding) => <HoldingValueEditor key={holding.id} holding={holding} />)}</tbody></table>{!state.holdings.length && <EmptyState title="Your portfolio is empty" text="Add investments using the form above." />}</div></Card>
      </div>
    </>
  );
}
