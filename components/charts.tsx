"use client";

import { useId } from "react";
import { compactCurrency } from "@/lib/analytics";

const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

export function LineChart({
  data,
  series,
  valueFormatter = compactCurrency,
  height = 240
}: {
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; label: string }>;
  valueFormatter?: (value: number) => string;
  height?: number;
}) {
  const id = useId().replace(/:/g, "");
  const width = 720;
  const padding = { left: 48, right: 18, top: 18, bottom: 36 };
  const values = data.flatMap((row) => series.map((item) => Number(row[item.key] ?? 0)));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const x = (index: number) => padding.left + (index / Math.max(data.length - 1, 1)) * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + ((max - value) / range) * (height - padding.top - padding.bottom);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart" className="chart-svg">
        <defs>
          {series.map((item, index) => (
            <linearGradient key={item.key} id={`${id}-${item.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={palette[index % palette.length]} stopOpacity=".28" />
              <stop offset="100%" stopColor={palette[index % palette.length]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const yy = padding.top + step * (height - padding.top - padding.bottom);
          const value = max - step * range;
          return <g key={step}><line x1={padding.left} x2={width - padding.right} y1={yy} y2={yy} className="grid-line" /><text x={padding.left - 8} y={yy + 4} textAnchor="end" className="axis-label">{valueFormatter(value)}</text></g>;
        })}
        {series.map((item, seriesIndex) => {
          const points = data.map((row, index) => `${x(index)},${y(Number(row[item.key] ?? 0))}`).join(" ");
          const area = `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`;
          return <g key={item.key}><polygon points={area} fill={`url(#${id}-${item.key})`} /><polyline points={points} fill="none" stroke={palette[seriesIndex % palette.length]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /></g>;
        })}
        {data.map((row, index) => {
          if (index % Math.ceil(data.length / 6) !== 0 && index !== data.length - 1) return null;
          return <text key={index} x={x(index)} y={height - 10} textAnchor="middle" className="axis-label">{String(row.label)}</text>;
        })}
      </svg>
      <div className="chart-legend">{series.map((item, index) => <span key={item.key}><i style={{ background: palette[index % palette.length] }} />{item.label}</span>)}</div>
    </div>
  );
}

export function BarChart({ data, comparisonKey, valueFormatter = compactCurrency }: { data: Array<{ label: string; value: number; comparison?: number }>; comparisonKey?: string; valueFormatter?: (value: number) => string }) {
  const max = Math.max(...data.flatMap((item) => [item.value, item.comparison ?? 0]), 1);
  return (
    <div className="bar-chart">
      {data.map((item) => (
        <div className="bar-row" key={item.label}>
          <div className="bar-label"><span>{item.label}</span><strong>{valueFormatter(item.value)}</strong></div>
          <div className="bar-track"><div className={`bar-fill ${item.value < 0 ? "negative-bar" : ""}`} style={{ width: `${(Math.abs(item.value) / max) * 100}%` }} /></div>
          {typeof item.comparison === "number" && <><div className="bar-track secondary"><div className="bar-fill secondary" style={{ width: `${(Math.abs(item.comparison) / max) * 100}%` }} /></div><small>{comparisonKey}: {valueFormatter(item.comparison)}</small></>}
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data, centerLabel }: { data: Array<{ label: string; value: number }>; centerLabel: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  let offset = 25;
  return (
    <div className="donut-layout">
      <div className="donut">
        <svg viewBox="0 0 42 42">
          <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="var(--chart-track)" strokeWidth="6" />
          {data.map((item, index) => {
            const length = (item.value / total) * 100;
            const currentOffset = offset;
            offset -= length;
            return <circle key={item.label} cx="21" cy="21" r="15.9155" fill="transparent" stroke={palette[index % palette.length]} strokeWidth="6" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={currentOffset} />;
          })}
        </svg>
        <div><strong>{centerLabel}</strong><span>Total</span></div>
      </div>
      <div className="donut-legend">{data.map((item, index) => <div key={item.label}><i style={{ background: palette[index % palette.length] }} /><span>{item.label}</span><strong>{Math.round((item.value / total) * 100)}%</strong></div>)}</div>
    </div>
  );
}
