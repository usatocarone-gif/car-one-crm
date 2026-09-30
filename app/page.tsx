"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, CircleAlert, Euro, FileCheck2, FileText, Gauge, GitBranch, LayoutDashboard, RefreshCw, Target, TrendingUp, Users } from "lucide-react";
import type { AppointmentItem, ChannelCohortItem, ContractHistoryItem, DashboardPayload, DashboardPeriod, LeadHistoryItem, PeriodKey, QuoteHistoryItem, ShowRateHistoryItem, SocialAppointmentHistoryItem } from "@/lib/types";
import { snapshot } from "@/lib/snapshot";

const menu = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "channels", label: "Canali", icon: GitBranch },
  { id: "sources", label: "Lead", icon: TrendingUp },
  { id: "agenda", label: "Appuntamenti social", icon: CalendarDays },
  { id: "quotes", label: "Preventivi", icon: FileText },
  { id: "contracts", label: "Contratti", icon: FileCheck2 },
  { id: "sellers", label: "Conversione venditori", icon: BarChart3 },
];
const SALES_TEAM = ["Caironi", "Grandolini", "Liguori", "Monacelli", "Bordini", "Pagliara"];

function formatNumber(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function percentage(value: number, total: number) {
  return total ? `${formatNumber((value / total) * 100)}%` : "—";
}

function comparisonDelta(value: number, previous: number) {
  return previous ? `${value >= previous ? "+" : ""}${formatNumber((value / previous - 1) * 100)}%` : "—";
}

function isLeadContract(item: ContractHistoryItem) {
  const origin = item.origin.toLowerCase();
  return ["lead", "social", "facebook", "instagram", "tiktok", "sito", "autoscout", "a24", "bdc"]
    .some((value) => origin.includes(value));
}

function isLeadQuote(item: QuoteHistoryItem) {
  const source = `${item.source} ${item.feedback} ${item.outcome}`.toLowerCase();
  return ["lead", "social", "facebook", "instagram", "tiktok", "sito", "autoscout", "a24", "bdc"]
    .some((value) => source.includes(value));
}

function YoYComparison({ rows, title = "Confronto con lo stesso periodo dell’anno scorso" }: { rows: Array<{ label: string; current: number; previous: number; format?: "number" | "currency" | "percentage" }>; title?: string }) {
  return <section className="comparison-panel"><header><div><h3>{title}</h3><p>Periodo selezionato confrontato con lo stesso periodo dell’anno precedente</p></div><TrendingUp size={18} /></header><div className="comparison-cards">
    {rows.map((row) => {
      const display = (value: number) => row.format === "currency" ? formatCurrency(value) : row.format === "percentage" ? `${formatNumber(value)}%` : formatNumber(value);
      return <div key={row.label}><span>{row.label}</span><strong>{display(row.current)}</strong><em className={row.current >= row.previous ? "positive" : "negative"}>{comparisonDelta(row.current, row.previous)}</em><small>anno scorso {display(row.previous)}</small></div>;
    })}
  </div></section>;
}

function statusLabel(status: "presented" | "no-show" | "pending") {
  if (status === "presented") return "Presentato";
  if (status === "no-show") return "No-show";
  return "Da aggiornare";
}

function Metric({ label, value, primary, secondary }: { label: string; value: string | number; primary: string; secondary: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><footer><b>{primary}</b><small>{secondary}</small></footer></article>;
}

function SalesPulse({ data, comparison }: { data: DashboardPeriod; comparison: BusinessMonthComparison }) {
  const attainment = data.target ? Math.min(100, (data.contracts / data.target) * 100) : 0;
  const pace = data.expectedToDate ? (data.contracts / data.expectedToDate) * 100 : null;
  return <section className="panel goal-panel sales-pulse">
    <header><div><span className="section-kicker sales">Vendite complessive</span><h3>Obiettivo, ritmo e forecast</h3><p>{data.target ? `Target ${data.target} contratti` : "Nessun target per il giorno selezionato"}</p></div><Target size={19} /></header>
    {data.target ? <>
      <div className="goal-big"><strong>{data.contracts}</strong><span>/ {data.target}</span></div>
      <div className="progress"><i style={{ width: `${attainment}%` }} /></div>
      <div className="goal-grid">
        <div><span>Atteso a oggi</span><strong>{data.expectedToDate}</strong></div>
        <div><span>Forecast</span><strong>{data.forecast}</strong></div>
        <div><span>Ritmo</span><strong>{pace ? `${formatNumber(pace)}%` : "—"}</strong></div>
        <div><span>Necessari/giorno</span><strong>{data.requiredPerDay ? formatNumber(data.requiredPerDay) : "—"}</strong></div>
      </div>
    </> : <div className="empty-compact"><Gauge size={24} /><span>La giornata contribuisce automaticamente agli obiettivi settimanali e mensili.</span></div>}
    <CompactComparison title={comparison.label} tone="sales" rows={[
      { label: "Preventivi", current: comparison.current.quotes, previous: comparison.previous.quotes },
      { label: "Contratti", current: comparison.current.contracts, previous: comparison.previous.contracts },
      { label: "Conversione", current: comparison.current.conversion, previous: comparison.previous.conversion, percentage: true },
    ]} />
  </section>;
}

function SocialFunnel({ data, leadContracts, comparison }: { data: DashboardPeriod; leadContracts: number; comparison: BusinessMonthComparison }) {
  const rows = [
    ["Lead digitali", data.leads, 100],
    ["Appuntamenti", data.appointments, data.leads ? data.appointments / data.leads * 100 : 0],
    ["Show", data.presented, data.leads ? data.presented / data.leads * 100 : 0],
    ["Contratti lead", leadContracts, data.leads ? leadContracts / data.leads * 100 : 0],
  ] as const;
  return <section className="panel pipeline social-funnel"><header><div><span className="section-kicker social">Acquisizione Social / BDC</span><h3>Funnel appuntamenti da lead</h3><p>Solo il percorso generato dai canali digitali</p></div><Gauge size={19} /></header>
    <div className="pipeline-list">{rows.map(([label, value, width], index) => <div className="pipeline-row" key={label}><div><span>{label}</span><strong>{value}</strong></div><div className="track"><i style={{ width: `${Math.max(value ? 3 : 0, Math.min(100, width))}%` }} /></div><small>{index === 0 ? "Ingresso" : `${percentage(value, data.leads)} dei lead`}</small></div>)}</div>
    <CompactComparison title={comparison.label} tone="social" rows={[
      { label: "Lead", current: comparison.current.leads, previous: comparison.previous.leads },
      { label: "Appuntamenti", current: comparison.current.appointments, previous: comparison.previous.appointments },
      { label: "Show", current: comparison.current.presented, previous: comparison.previous.presented },
      { label: "Contratti lead", current: comparison.current.leadContracts, previous: comparison.previous.leadContracts },
    ]} />
  </section>;
}

type CompactComparisonRow = { label: string; current: number; previous: number; percentage?: boolean };

function CompactComparison({ title, tone, rows }: { title: string; tone: "social" | "sales"; rows: CompactComparisonRow[] }) {
  return <div className={`compact-comparison ${tone}`}><header><span>{title}</span><small>stesso periodo anno precedente</small></header><div>
    {rows.map((row) => <article key={row.label}><span>{row.label}</span><strong>{row.percentage ? `${formatNumber(row.current)}%` : formatNumber(row.current)}</strong><em className={row.current >= row.previous ? "positive" : "negative"}>{comparisonDelta(row.current, row.previous)}</em><small>vs {row.percentage ? `${formatNumber(row.previous)}%` : formatNumber(row.previous)}</small></article>)}
  </div></div>;
}

type TrendPoint = {
  label: string;
  actualContracts: number | null;
  previousContracts: number;
  actualQuotes: number | null;
  previousQuotes: number;
  conversion: number | null;
  previousConversion: number | null;
  target: number | null;
  forecast: number | null;
};

function localContractDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function mondayOf(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function weekOfMonth(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.min(5, Math.floor((date.getDate() + ((first.getDay() + 6) % 7) - 1) / 7) + 1);
}

function weekLabel(year: number, month: number, week: number) {
  const dates: number[] = [];
  const end = new Date(year, month, 0).getDate();
  for (let day = 1; day <= end; day += 1) {
    if (weekOfMonth(new Date(year, month - 1, day)) === week) dates.push(day);
  }
  return dates.length ? `S${week} · ${dates[0]}–${dates[dates.length - 1]}` : `S${week}`;
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function sameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function sellingDaysThrough(start: Date, endInclusive: Date) {
  let count = 0;
  for (let cursor = new Date(start); cursor <= endInclusive; cursor = addDays(cursor, 1)) {
    if (cursor.getDay() !== 0) count += 1;
  }
  return count;
}

function buildCommercialTrend(payload: DashboardPayload, selectedPeriod: PeriodKey, anchorValue?: string) {
  const period: "week" | "month" = selectedPeriod === "week" ? "week" : "month";
  const now = new Date();
  const anchor = anchorValue ? dashboardRange(selectedPeriod, anchorValue).start : now;
  const currentStart = period === "week" ? mondayOf(anchor) : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const currentEnd = period === "week" ? addDays(currentStart, 7) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  // Ogni confronto temporale usa sempre lo stesso periodo dell'anno scorso.
  // Per la settimana usiamo la settimana omologa (52 settimane prima),
  // mantenendo lunedì-domenica; per il mese manteniamo lo stesso mese solare.
  const previousStart = period === "week"
    ? addDays(currentStart, -364)
    : new Date(currentStart.getFullYear() - 1, currentStart.getMonth(), 1);
  const previousEnd = period === "week" ? addDays(previousStart, 7) : new Date(previousStart.getFullYear(), previousStart.getMonth() + 1, 1);
  const dates: Date[] = [];
  for (let cursor = new Date(currentStart); cursor < currentEnd; cursor = addDays(cursor, 1)) dates.push(cursor);
  const contractDates = (payload.contractHistory ?? []).map((item) => localContractDate(item.date));
  const quoteDates = (payload.quoteHistory ?? []).map((item) => new Date(item.date));
  const currentDaily = dates.map((date) => contractDates.filter((item) => sameCalendarDay(item, date)).length);
  const currentQuoteDaily = dates.map((date) => quoteDates.filter((item) => sameCalendarDay(item, date)).length);
  const previousLength = Math.round((previousEnd.getTime() - previousStart.getTime()) / 86400000);
  const previousDaily = dates.map((_, index) => {
    if (index >= previousLength) return 0;
    const date = addDays(previousStart, index);
    return contractDates.filter((item) => sameCalendarDay(item, date)).length;
  });
  const previousQuoteDaily = dates.map((_, index) => {
    if (index >= previousLength) return 0;
    const date = addDays(previousStart, index);
    return quoteDates.filter((item) => sameCalendarDay(item, date)).length;
  });
  const cumulative = (values: number[]) => values.map((_, index) => values.slice(0, index + 1).reduce((sum, value) => sum + value, 0));
  const currentCumulative = cumulative(currentDaily);
  const previousCumulative = cumulative(previousDaily);
  const currentQuoteCumulative = cumulative(currentQuoteDaily);
  const previousQuoteCumulative = cumulative(previousQuoteDaily);
  const foundCurrentIndex = dates.findIndex((date) => sameCalendarDay(date, now));
  const currentIndex = now >= currentEnd ? dates.length - 1 : now < currentStart ? 0 : Math.max(0, foundCurrentIndex);
  const target = period === "week" ? 12 : 50;
  const totalSellingDays = sellingDaysThrough(currentStart, addDays(currentEnd, -1));
  const elapsedSellingDays = sellingDaysThrough(currentStart, dates[currentIndex]);
  const remainingSellingDays = Math.max(1, totalSellingDays - elapsedSellingDays);
  const actualAtCutoff = currentCumulative[currentIndex] ?? 0;
  const forecastEnd = now >= currentEnd ? actualAtCutoff : Math.round(actualAtCutoff / Math.max(1, elapsedSellingDays) * totalSellingDays);
  const points: TrendPoint[] = dates.map((date, index) => {
    const sellingToDate = sellingDaysThrough(currentStart, date);
    const futureSellingDays = Math.max(0, sellingToDate - elapsedSellingDays);
    const projected = index < currentIndex ? null : index === currentIndex
      ? actualAtCutoff
      : actualAtCutoff + ((forecastEnd - actualAtCutoff) * futureSellingDays) / remainingSellingDays;
    return {
      label: period === "week"
        ? new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date)
        : String(date.getDate()),
      actualContracts: index <= currentIndex ? currentCumulative[index] : null,
      previousContracts: previousCumulative[index] ?? previousCumulative[previousCumulative.length - 1] ?? 0,
      actualQuotes: index <= currentIndex ? currentQuoteCumulative[index] : null,
      previousQuotes: previousQuoteCumulative[index] ?? previousQuoteCumulative[previousQuoteCumulative.length - 1] ?? 0,
      conversion: index <= currentIndex && currentQuoteCumulative[index] ? currentCumulative[index] / currentQuoteCumulative[index] * 100 : null,
      previousConversion: previousQuoteCumulative[index] ? previousCumulative[index] / previousQuoteCumulative[index] * 100 : null,
      target: target ? (target * sellingToDate) / totalSellingDays : null,
      forecast: projected,
    };
  });
  const previousAtCutoff = previousCumulative[currentIndex] ?? previousCumulative[previousCumulative.length - 1] ?? 0;
  const quotesAtCutoff = currentQuoteCumulative[currentIndex] ?? 0;
  return { period, points, currentIndex, actualAtCutoff, previousAtCutoff, quotesAtCutoff, forecastEnd, target };
}

function CommercialTrend({ payload, period, anchorValue }: { payload: DashboardPayload; period: PeriodKey; anchorValue?: string }) {
  const trend = useMemo(() => buildCommercialTrend(payload, period, anchorValue), [payload, period, anchorValue]);
  const [mode, setMode] = useState<"overview" | "contracts" | "quotes" | "conversion">("overview");
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 720;
  const height = 250;
  const padding = { left: 38, right: 18, top: 18, bottom: 34 };
  const values = trend.points.flatMap((point) => mode === "contracts"
    ? [point.actualContracts, point.previousContracts, point.target, point.forecast]
    : mode === "quotes" ? [point.actualQuotes, point.previousQuotes]
      : mode === "conversion" ? [point.conversion, point.previousConversion]
        : [point.actualContracts, point.actualQuotes, point.target, point.forecast]
  ).filter((value): value is number => value !== null);
  const maximum = Math.max(1, ...values);
  const ceiling = Math.max(5, Math.ceil(maximum / 5) * 5);
  const x = (index: number) => padding.left + (index / Math.max(1, trend.points.length - 1)) * (width - padding.left - padding.right);
  const hitLeft = (index: number) => index === 0 ? padding.left : (x(index - 1) + x(index)) / 2;
  const hitRight = (index: number) => index === trend.points.length - 1 ? width - padding.right : (x(index) + x(index + 1)) / 2;
  const y = (value: number) => padding.top + (1 - value / ceiling) * (height - padding.top - padding.bottom);
  const line = (selector: (point: TrendPoint) => number | null) => trend.points
    .map((point, index) => ({ value: selector(point), index }))
    .filter((item): item is { value: number; index: number } => item.value !== null)
    .map((item) => `${x(item.index)},${y(item.value)}`)
    .join(" ");
  const delta = trend.previousAtCutoff ? ((trend.actualAtCutoff / trend.previousAtCutoff) - 1) * 100 : null;
  const active = hovered;
  const activePoint = active === null ? null : trend.points[active];
  const labelEvery = trend.period === "week" ? 1 : Math.max(1, Math.floor(trend.points.length / 5));

  return <section className="panel commercial-trend sales-trend">
    <header><div><span className="section-kicker sales">Vendite complessive</span><h3>Andamento vendite e forecast</h3><p>Solo preventivi e contratti · {trend.period === "week" ? "stessa settimana dell’anno scorso" : "stesso mese dell’anno scorso"}</p></div><div className="trend-summary"><span><b>{trend.actualAtCutoff}</b> contratti</span><span><b>{trend.quotesAtCutoff}</b> preventivi</span><span><b>{percentage(trend.actualAtCutoff, trend.quotesAtCutoff)}</b> conversione</span><span className={delta !== null && delta >= 0 ? "good" : "trend-negative"}>{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${formatNumber(delta)}%`} contratti vs anno scorso</span><span><b>{trend.forecastEnd}</b> forecast</span></div></header>
    <div className="chart-switcher"><button className={mode === "overview" ? "active" : ""} onClick={() => setMode("overview")}>Panoramica</button><button className={mode === "contracts" ? "active" : ""} onClick={() => setMode("contracts")}>Contratti</button><button className={mode === "quotes" ? "active" : ""} onClick={() => setMode("quotes")}>Preventivi</button><button className={mode === "conversion" ? "active" : ""} onClick={() => setMode("conversion")}>Conversione</button></div>
    {(payload.contractHistory ?? []).length ? <div className="trend-chart-wrap">
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Andamento cumulato contratti, ${trend.actualAtCutoff} attuali e forecast ${trend.forecastEnd}`} onMouseLeave={() => setHovered(null)}>
        {[0, .25, .5, .75, 1].map((ratio) => {
          const value = ceiling * ratio;
          return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} /><text x={padding.left - 8} y={y(value) + 4}>{Math.round(value)}</text></g>;
        })}
        {mode === "contracts" ? <polyline className="trend-line previous" points={line((point) => point.previousContracts)} /> : null}
        {mode === "quotes" ? <polyline className="trend-line quote-previous" points={line((point) => point.previousQuotes)} /> : null}
        {mode === "conversion" ? <polyline className="trend-line previous" points={line((point) => point.previousConversion)} /> : null}
        {(mode === "overview" || mode === "contracts") && trend.target ? <polyline className="trend-line target" points={line((point) => point.target)} /> : null}
        {(mode === "overview" || mode === "contracts") ? <polyline className="trend-line forecast" points={line((point) => point.forecast)} /> : null}
        {(mode === "overview" || mode === "contracts") ? <polyline className="trend-line actual" points={line((point) => point.actualContracts)} /> : null}
        {(mode === "overview" || mode === "quotes") ? <polyline className="trend-line quotes" points={line((point) => point.actualQuotes)} /> : null}
        {mode === "conversion" ? <polyline className="trend-line conversion" points={line((point) => point.conversion)} /> : null}
        {trend.points.map((point, index) => <g key={index}>
          {(index % labelEvery === 0 || index === trend.points.length - 1) ? <text className="trend-x-label" x={x(index)} y={height - 9}>{point.label}</text> : null}
          <rect className="trend-hit" x={hitLeft(index)} y={padding.top} width={Math.max(1, hitRight(index) - hitLeft(index))} height={height - padding.top - padding.bottom} tabIndex={0} aria-label={`${point.label}: ${point.actualContracts ?? 0} contratti, ${point.actualQuotes ?? 0} preventivi`} onMouseEnter={() => setHovered(index)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} />
        </g>)}
        {activePoint ? <g className="trend-marker"><line x1={x(active ?? 0)} x2={x(active ?? 0)} y1={padding.top} y2={height - padding.bottom} /><circle cx={x(active ?? 0)} cy={y(mode === "quotes" ? activePoint.actualQuotes ?? 0 : mode === "conversion" ? activePoint.conversion ?? 0 : activePoint.actualContracts ?? activePoint.forecast ?? 0)} r="5" /></g> : null}
      </svg>
      {activePoint ? <div className="trend-tooltip" style={{ left: `${Math.min(92, Math.max(8, (x(active ?? 0) / width) * 100))}%` }}><b>{activePoint.label}</b><span>Contratti {activePoint.actualContracts ?? "—"}</span><span>Preventivi {activePoint.actualQuotes ?? "—"}</span><span>Conversione {activePoint.conversion === null ? "—" : `${formatNumber(activePoint.conversion)}%`}</span><span>Contratti anno scorso {formatNumber(activePoint.previousContracts)}</span><span>Preventivi anno scorso {formatNumber(activePoint.previousQuotes)}</span><span>Obiettivo {activePoint.target === null ? "—" : formatNumber(activePoint.target)}</span><span>Forecast {activePoint.forecast === null ? "—" : formatNumber(activePoint.forecast)}</span></div> : null}
    </div> : <div className="empty-compact">Il grafico sarà disponibile quando lo storico contratti live è caricato.</div>}
    <div className="trend-legend"><span><i className="actual" />Contratti</span><span><i className="quotes" />Preventivi</span><span><i className="forecast" />Forecast contratti</span><span><i className="target" />Ritmo obiettivo</span><span><i className="previous" />Stesso periodo anno scorso</span></div>
  </section>;
}

function WeeklyFlowChart({ payload }: { payload: DashboardPayload }) {
  const history = payload.weeklyHistory ?? [];
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 720;
  const height = 250;
  const padding = { left: 38, right: 18, top: 18, bottom: 38 };
  const ceiling = Math.max(5, Math.ceil(Math.max(1, ...history.flatMap((item) => [item.appointments, item.quotes, item.contracts])) / 5) * 5);
  const x = (index: number) => padding.left + (index / Math.max(1, history.length - 1)) * (width - padding.left - padding.right);
  const hitLeft = (index: number) => index === 0 ? padding.left : (x(index - 1) + x(index)) / 2;
  const hitRight = (index: number) => index === history.length - 1 ? width - padding.right : (x(index) + x(index + 1)) / 2;
  const y = (value: number) => padding.top + (1 - value / ceiling) * (height - padding.top - padding.bottom);
  const line = (selector: (item: typeof history[number]) => number) => history.map((item, index) => `${x(index)},${y(selector(item))}`).join(" ");
  const active = hovered;
  const activePoint = active === null ? null : history[active];
  return <section className="panel commercial-trend weekly-flow"><header><div><h3>Funnel settimana per settimana</h3><p>Appuntamenti, preventivi e contratti nelle ultime {history.length || 12} settimane</p></div>{activePoint ? <div className="trend-summary"><span><b>{activePoint.appointments}</b> app.</span><span><b>{activePoint.quotes}</b> preventivi</span><span><b>{activePoint.contracts}</b> contratti</span></div> : null}</header>
    {history.length >= 10 ? <div className="trend-chart-wrap"><svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Andamento settimanale di appuntamenti, preventivi e contratti" onMouseLeave={() => setHovered(null)}>
      {[0, .25, .5, .75, 1].map((ratio) => { const value = ceiling * ratio; return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} /><text x={padding.left - 8} y={y(value) + 4}>{Math.round(value)}</text></g>; })}
      <polyline className="trend-line appointments" points={line((item) => item.appointments)} /><polyline className="trend-line quotes" points={line((item) => item.quotes)} /><polyline className="trend-line actual" points={line((item) => item.contracts)} />
      {history.map((item, index) => <g key={item.weekStart}><text className="trend-x-label" x={x(index)} y={height - 10}>{item.label}</text><rect className="trend-hit" x={hitLeft(index)} y={padding.top} width={Math.max(1, hitRight(index) - hitLeft(index))} height={height - padding.top - padding.bottom} tabIndex={0} aria-label={`${item.label}: ${item.appointments} appuntamenti, ${item.quotes} preventivi, ${item.contracts} contratti`} onMouseEnter={() => setHovered(index)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} /></g>)}
      {activePoint ? <g className="trend-marker"><line x1={x(active ?? 0)} x2={x(active ?? 0)} y1={padding.top} y2={height - padding.bottom} /><circle cx={x(active ?? 0)} cy={y(activePoint.quotes)} r="5" /></g> : null}
    </svg>{activePoint ? <div className="trend-tooltip" style={{ left: `${Math.min(92, Math.max(8, (x(active ?? 0) / width) * 100))}%` }}><b>{activePoint.label}</b><span>Appuntamenti {activePoint.appointments}</span><span>Preventivi {activePoint.quotes}</span><span>Contratti {activePoint.contracts}</span><span>App. → preventivo {percentage(activePoint.quotes, activePoint.appointments)}</span><span>Preventivo → contratto {percentage(activePoint.contracts, activePoint.quotes)}</span></div> : null}</div> : <div className="empty-compact">Il grafico si attiverà dopo l’aggiornamento Apps Script con almeno 10 settimane.</div>}
    <div className="trend-legend"><span><i className="appointments" />Appuntamenti</span><span><i className="quotes" />Preventivi</span><span><i className="actual" />Contratti</span></div>
  </section>;
}

function AppointmentsPanel({ payload }: { payload: DashboardPayload }) {
  const [view, setView] = useState<"today" | "upcoming">("today");
  const items: Array<AppointmentItem & { date?: string }> = view === "today" ? payload.todayAgenda : (payload.upcomingAgenda ?? []);
  return <section className="panel appointments-panel">
    <header><div><h3>{view === "today" ? "Agenda di oggi" : "Prossime opportunità"}</h3><p>{view === "today" ? "Appuntamenti odierni e relativi esiti" : "Appuntamenti futuri nei prossimi 7 giorni"}</p></div><div className="mini-tabs"><button className={view === "today" ? "active" : ""} onClick={() => setView("today")}>Oggi</button><button className={view === "upcoming" ? "active" : ""} onClick={() => setView("upcoming")}>Futuri</button></div></header>
    <div className="agenda-list">{items.length ? items.map((item) => <div className="agenda-item" key={item.id}>
      <strong>{item.time}</strong><div><b>{item.seller}</b><span>{item.date ?? "Appuntamento showroom"}</span></div><em className={view === "upcoming" ? "opportunity" : item.status}>{view === "upcoming" ? "Opportunità" : statusLabel(item.status)}</em>
    </div>) : <div className="empty-compact">{view === "upcoming" ? "Nessun appuntamento futuro caricato." : "Nessun appuntamento in agenda."}</div>}</div>
  </section>;
}

function dashboardRange(period: PeriodKey, anchorValue: string) {
  const parsed = period === "month" ? new Date(`${anchorValue}-01T12:00:00`) : new Date(`${anchorValue}T12:00:00`);
  const anchor = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const start = period === "today" ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()) : period === "week" ? mondayOf(anchor) : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = period === "today" ? addDays(start, 1) : period === "week" ? addDays(start, 7) : new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end };
}

function buildSelectedDashboardPeriod(payload: DashboardPayload, period: PeriodKey, anchorValue: string): DashboardPeriod {
  const { start, end } = dashboardRange(period, anchorValue);
  const inSelectedRange = (value: string) => {
    const date = value.length === 10 ? localContractDate(value) : new Date(value);
    return date >= start && date < end;
  };
  const daily = (payload.dailyHistory ?? []).filter((item) => inSelectedRange(item.date));
  if (!payload.dailyHistory?.length) return payload.periods[period];
  const sum = <K extends keyof typeof daily[number]>(key: K) => daily.reduce((total, item) => total + Number(item[key] ?? 0), 0);
  const contracts = (payload.contractHistory ?? []).filter((item) => inSelectedRange(item.date));
  const socialAppointments = (payload.socialAppointmentHistory ?? []).filter((item) => inSelectedRange(item.date));
  const sellerNames = [...new Set([...contracts.map((item) => item.seller), ...socialAppointments.map((item) => item.seller)])].filter(Boolean);
  const sellers = sellerNames.map((name) => {
    const sellerContracts = contracts.filter((item) => item.seller === name);
    return {
      name,
      contracts: sellerContracts.length,
      carOne: sellerContracts.filter((item) => item.company === "Car One").length,
      adMotor: sellerContracts.filter((item) => item.company === "AD Motor").length,
      appointments: socialAppointments.filter((item) => item.seller === name).length,
    };
  }).sort((a, b) => b.contracts - a.contracts);
  const now = new Date();
  const isCurrentRange = now >= start && now < end;
  const target = period === "week" ? 12 : period === "month" ? 50 : null;
  const totalDays = sellingDaysThrough(start, addDays(end, -1));
  const cutoff = now < start ? start : now >= end ? addDays(end, -1) : now;
  const elapsedDays = Math.max(1, sellingDaysThrough(start, cutoff));
  const contractsCount = sum("contracts");
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const futureAppointments = socialAppointments.filter((item) => localContractDate(item.date) > now).length;
  return {
    label: period === "today" ? "Giorno" : period === "week" ? "Settimana" : "Mese",
    subtitle: period === "today"
      ? new Intl.DateTimeFormat("it-IT", { dateStyle: "full" }).format(start)
      : `${new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(start)} – ${new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(addDays(end, -1))}`,
    // Foglio1 contiene sempre i lead del mese corrente. Per il periodo in
    // corso usiamo quindi il totale live restituito da Apps Script, senza
    // sostituirlo con lo storico giornaliero (che può arrivare in ritardo).
    leads: isCurrentRange ? payload.periods[period].leads : sum("leads"),
    appointments: sum("appointments"),
    presented: sum("presented"),
    noShows: sum("noShows"),
    pendingAppointments: sum("pending"),
    upcomingAppointments: futureAppointments,
    overdueAppointments: Math.max(0, sum("pending") - futureAppointments),
    quotes: sum("quotes"),
    contracts: contractsCount,
    revenue: sum("revenue"),
    carOneContracts: contracts.filter((item) => item.company === "Car One").length,
    adMotorContracts: contracts.filter((item) => item.company === "AD Motor").length,
    target,
    forecast: target ? Math.round((contractsCount / elapsedDays) * totalDays) : null,
    expectedToDate: target ? Math.round(target * elapsedDays / totalDays) : null,
    remainingToTarget: target ? Math.max(0, target - contractsCount) : null,
    requiredPerDay: target && remainingDays ? Math.max(0, target - contractsCount) / remainingDays : null,
    sellers,
  };
}

type BusinessMonthMetrics = {
  leads: number;
  appointments: number;
  presented: number;
  leadContracts: number;
  quotes: number;
  contracts: number;
  conversion: number;
};

type BusinessMonthComparison = {
  label: string;
  current: BusinessMonthMetrics;
  previous: BusinessMonthMetrics;
};

function monthMetrics(payload: DashboardPayload, year: number, month: number, liveMonth: boolean): BusinessMonthMetrics {
  const appointments = (payload.socialAppointmentHistory ?? []).filter((item) => item.year === year && item.month === month);
  const contracts = (payload.contractHistory ?? []).filter((item) => item.year === year && item.month === month);
  const quotes = (payload.quoteHistory ?? []).filter((item) => item.year === year && item.month === month).length;
  const historyLeads = (payload.leadHistory ?? []).filter((item) => item.year === year && item.month === month).reduce((sum, item) => sum + item.leads, 0);
  const cohortLeadContracts = (payload.channelAnalysis?.leadCohorts ?? []).filter((item) => item.year === year && item.month === month).reduce((sum, item) => sum + item.contracts, 0);
  const totalContracts = contracts.length;
  return {
    leads: liveMonth ? payload.periods.month.leads : historyLeads,
    appointments: appointments.length,
    presented: appointments.filter((item) => item.status === "presented").length,
    leadContracts: payload.channelAnalysis?.leadCohorts?.length ? cohortLeadContracts : contracts.filter(isLeadContract).length,
    quotes,
    contracts: totalContracts,
    conversion: quotes ? totalContracts / quotes * 100 : 0,
  };
}

function buildBusinessMonthComparison(payload: DashboardPayload, period: PeriodKey, anchorValue: string): BusinessMonthComparison {
  const anchor = dashboardRange(period, anchorValue).start;
  const year = anchor.getFullYear();
  const month = anchor.getMonth() + 1;
  const now = new Date();
  const liveMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  return {
    label: `${new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(anchor)} vs ${year - 1}`,
    current: monthMetrics(payload, year, month, liveMonth),
    previous: monthMetrics(payload, year - 1, month, false),
  };
}

function selectedLeadContracts(payload: DashboardPayload, period: PeriodKey, start: Date, end: Date) {
  const contracts = (payload.contractHistory ?? []).filter((item) => {
    const date = localContractDate(item.date);
    return date >= start && date < end && isLeadContract(item);
  }).length;
  const cohorts = payload.channelAnalysis?.leadCohorts ?? [];
  if (!cohorts.length || period === "today") return contracts;
  const buckets = new Set<string>();
  for (let cursor = new Date(start); cursor < end; cursor = addDays(cursor, 1)) {
    buckets.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}-${weekOfMonth(cursor)}`);
  }
  return cohorts.filter((item) => buckets.has(`${item.year}-${item.month}-${item.week}`)).reduce((sum, item) => sum + item.contracts, 0);
}

function Dashboard({ payload, period, setPeriod }: { payload: DashboardPayload; period: PeriodKey; setPeriod: (period: PeriodKey) => void }) {
  const now = new Date();
  const [dayValue, setDayValue] = useState(now.toISOString().slice(0, 10));
  const [weekValue, setWeekValue] = useState(now.toISOString().slice(0, 10));
  const [monthValue, setMonthValue] = useState(now.toISOString().slice(0, 7));
  const anchorValue = period === "today" ? dayValue : period === "week" ? weekValue : monthValue;
  const data = useMemo(() => buildSelectedDashboardPeriod(payload, period, anchorValue), [payload, period, anchorValue]);
  const comparison = useMemo(() => buildBusinessMonthComparison(payload, period, anchorValue), [payload, period, anchorValue]);
  const selectedRange = dashboardRange(period, anchorValue);
  const leadContracts = selectedLeadContracts(payload, period, selectedRange.start, selectedRange.end);
  const resolved = data.presented + data.noShows;
  const upcomingAppointments = data.upcomingAppointments ?? 0;
  const overdueAppointments = data.overdueAppointments ?? Math.max(0, data.pendingAppointments - upcomingAppointments);
  return <>
    <header className="page-head dashboard-head"><div><p className="eyebrow">Controllo commerciale</p><h1>Buongiorno, David</h1><span>{data.subtitle}</span></div><div className="dashboard-period-control"><div className="period-tabs">{(["today", "week", "month"] as PeriodKey[]).map((key) => <button key={key} className={period === key ? "active" : ""} onClick={() => setPeriod(key)}>{key === "today" ? "Giorno" : key === "week" ? "Settimana" : "Mese"}</button>)}</div>{period === "month" ? <input aria-label="Mese dashboard" type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} /> : <input aria-label={period === "today" ? "Giorno dashboard" : "Settimana dashboard"} type="date" value={period === "today" ? dayValue : weekValue} onChange={(event) => period === "today" ? setDayValue(event.target.value) : setWeekValue(event.target.value)} />}</div></header>
    <div className="business-overview">
      <section className="business-cluster social-cluster"><header><span>01</span><div><b>Acquisizione Social / BDC</b><small>Dal lead all’appuntamento e al contratto lead</small></div></header><div className="metrics-grid social-metrics">
        <Metric label="Lead digitali" value={data.leads} primary={period === "today" ? "Nuovi oggi" : `${percentage(data.appointments, data.leads)} con appuntamento`} secondary="Make Leads" />
        <Metric label="Appuntamenti da lead" value={data.appointments} primary={`${upcomingAppointments} opportunità future`} secondary={`${overdueAppointments} da aggiornare`} />
        <Metric label="Show appuntamenti" value={data.presented} primary={`${percentage(data.presented, resolved)} show rate`} secondary={`${data.noShows} no-show`} />
        <Metric label="Contratti da lead" value={leadContracts} primary={percentage(leadContracts, data.appointments)} secondary="appuntamento → contratto" />
      </div></section>
      <section className="business-cluster sales-cluster"><header><span>02</span><div><b>Vendite complessive</b><small>Tutti i canali: walk-in, conoscenze, digital e altri</small></div></header><div className="metrics-grid sales-metrics">
        <Metric label="Preventivi totali" value={data.quotes ?? 0} primary="Tutti i canali" secondary="nessun legame automatico con gli app." />
        <Metric label="Contratti totali" value={data.contracts} primary={`${data.carOneContracts} Car One`} secondary={`${data.adMotorContracts} AD Motor`} />
        <Metric label="Conversione vendite" value={percentage(data.contracts, data.quotes ?? 0)} primary={`${data.contracts} su ${data.quotes ?? 0}`} secondary="preventivi → contratti" />
      </div></section>
    </div>
    <div className="business-detail-grid"><SocialFunnel data={data} leadContracts={leadContracts} comparison={comparison} /><SalesPulse data={data} comparison={comparison} /></div>
    <CommercialTrend payload={payload} period={period} anchorValue={anchorValue} />
    <div className="two-columns lower">
      <AppointmentsPanel payload={payload} />
      <section className="panel"><header><div><h3>Performance venditori</h3><p>Contratti Car One + AD Motor</p></div><BarChart3 size={19} /></header><div className="seller-list">{data.sellers.length ? data.sellers.map((seller) => <div className="seller-row" key={seller.name}><div><b>{seller.name}</b><span>{seller.carOne} Car One · {seller.adMotor} AD</span></div><strong>{seller.contracts}</strong><div className="track"><i style={{ width: `${Math.max(8, seller.contracts / Math.max(...data.sellers.map((s) => s.contracts)) * 100)}%` }} /></div></div>) : <div className="empty-compact">I risultati venditore sono disponibili nelle viste settimanale e mensile.</div>}</div></section>
    </div>
  </>;
}

function sumLeadHistory(items: LeadHistoryItem[], key: (item: LeadHistoryItem) => string) {
  const result = new Map<string, number>();
  items.forEach((item) => result.set(key(item), (result.get(key(item)) ?? 0) + item.leads));
  return [...result.entries()].sort((a, b) => b[1] - a[1]);
}

type LeadManagementItem = {
  year: number;
  month: number;
  week: number;
  seller: string;
  channel: string;
  total: number;
  managed: number;
  unmanaged: number;
};

type LeadManagementSummary = { total: number; managed: number; unmanaged: number };

function sumLeadManagement(items: LeadManagementItem[]): LeadManagementSummary {
  return items.reduce((sum, item) => ({
    total: sum.total + item.total,
    managed: sum.managed + item.managed,
    unmanaged: sum.unmanaged + item.unmanaged,
  }), { total: 0, managed: 0, unmanaged: 0 });
}

function LeadManagementPanel({ current, previous, sourceLeadTotal, comparisonEnabled }: { current: LeadManagementItem[]; previous: LeadManagementItem[]; sourceLeadTotal: number; comparisonEnabled: boolean }) {
  const sellers = SALES_TEAM;
  const rows = sellers.map((seller) => {
    const currentTotals = sumLeadManagement(current.filter((item) => item.seller === seller));
    const previousTotals = sumLeadManagement(previous.filter((item) => item.seller === seller));
    const rate = currentTotals.total ? currentTotals.managed / currentTotals.total * 100 : 0;
    const previousRate = previousTotals.total ? previousTotals.managed / previousTotals.total * 100 : null;
    return { seller, ...currentTotals, rate, previousTotal: previousTotals.total, previousRate };
  }).sort((a, b) => a.rate - b.rate || b.unmanaged - a.unmanaged || a.seller.localeCompare(b.seller));
  const totals = sumLeadManagement(current);
  const previousTotals = sumLeadManagement(previous);
  const rate = totals.total ? totals.managed / totals.total * 100 : 0;
  const previousRate = previousTotals.total ? previousTotals.managed / previousTotals.total * 100 : null;

  return <section className="panel lead-management-panel">
    <header><div><h3>Gestione lead per venditore</h3><p>Feedback valorizzato = gestito · feedback vuoto = non gestito</p></div><CheckCircle2 size={19} /></header>
    {rows.length ? <>
      <div className="lead-management-summary">
        <article><span>Righe nei fogli venditori</span><strong>{totals.total}</strong><small>{sourceLeadTotal ? `${sourceLeadTotal} lead Make Leads nello stesso filtro` : "Periodo senza totale Make Leads"}</small></article>
        <article><span>Gestiti</span><strong>{totals.managed}</strong><small>{percentage(totals.managed, totals.total)} del carico assegnato</small></article>
        <article className="attention"><span>Non gestiti</span><strong>{totals.unmanaged}</strong><small>feedback ancora vuoto</small></article>
        <article><span>Tasso di gestione</span><strong>{formatNumber(rate)}%</strong><small>{comparisonEnabled && previousRate !== null ? `${rate >= previousRate ? "+" : ""}${formatNumber(rate - previousRate)} punti vs anno scorso` : "anno scorso non disponibile"}</small></article>
      </div>
      <div className="lead-management-bars">{rows.map((row) => <article key={row.seller}>
        <header><b>{row.seller}</b><strong>{formatNumber(row.rate)}%</strong></header>
        <div className="lead-management-track"><i style={{ width: `${row.rate}%` }} /><em style={{ width: `${100 - row.rate}%` }} /></div>
        <footer><span>{row.managed} gestiti</span><span>{row.unmanaged} non gestiti</span></footer>
      </article>)}</div>
      <div className="data-table lead-management-table">
        <div className="data-row data-head"><span>Venditore</span><span>Lead</span><span>Gestiti</span><span>Non gestiti</span><span>Tasso gestione</span><span>Anno scorso</span><span>Δ punti</span></div>
        {rows.map((row) => <div className="data-row" key={row.seller}><b>{row.seller}</b><strong>{row.total}</strong><span>{row.managed}</span><strong className={row.unmanaged ? "management-alert" : "good"}>{row.unmanaged}</strong><strong className={row.rate >= 80 ? "good" : row.rate < 50 ? "management-alert" : ""}>{formatNumber(row.rate)}%</strong><span>{comparisonEnabled && row.previousRate !== null ? `${formatNumber(row.previousRate)}%` : "n.d."}</span><span>{comparisonEnabled && row.previousRate !== null ? `${row.rate >= row.previousRate ? "+" : ""}${formatNumber(row.rate - row.previousRate)}` : "—"}</span></div>)}
        <div className="data-row data-total"><b>TOTALE</b><strong>{totals.total}</strong><strong>{totals.managed}</strong><strong>{totals.unmanaged}</strong><strong>{formatNumber(rate)}%</strong><span>{comparisonEnabled && previousRate !== null ? `${formatNumber(previousRate)}%` : "n.d."}</span><span>{comparisonEnabled && previousRate !== null ? `${rate >= previousRate ? "+" : ""}${formatNumber(rate - previousRate)}` : "—"}</span></div>
      </div>
      <div className="notice"><CircleAlert size={17} /><span>Il confronto annuale resta sempre visibile. Quando compare “n.d.” significa che il foglio del venditore non contiene lo stesso periodo dell’anno precedente; la dashboard non inventa un valore zero.</span></div>
    </> : <div className="empty-compact">Nessun lead assegnato nei fogli venditori per il periodo selezionato.</div>}
  </section>;
}

function SourcesView({ payload }: { payload: DashboardPayload }) {
  const history = payload.leadHistory ?? [];
  const management = ((payload as DashboardPayload & { leadManagement?: LeadManagementItem[] }).leadManagement ?? []);
  const years = [...new Set(history.map((item) => item.year))].sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState(years.includes(currentYear) ? String(currentYear) : "all");
  const [month, setMonth] = useState(history.some((item) => item.year === currentYear && item.month === currentMonth) ? String(currentMonth) : "all");
  const [channel, setChannel] = useState("all");
  const [region, setRegion] = useState("all");
  const channels = [...new Set(history.map((item) => item.channel))].sort();
  const regions = [...new Set(history.map((item) => item.region))].sort((a, b) => a === "Da classificare" ? 1 : b === "Da classificare" ? -1 : a.localeCompare(b));
  const filtered = history.filter((item) =>
    (year === "all" || item.year === Number(year)) &&
    (month === "all" || item.month === Number(month)) &&
    (channel === "all" || item.channel === channel) &&
    (region === "all" || item.region === region)
  );
  const total = filtered.reduce((sum, item) => sum + item.leads, 0);
  const byChannel = sumLeadHistory(filtered, (item) => item.channel);
  const byRegion = sumLeadHistory(filtered, (item) => item.region);
  const byCity = sumLeadHistory(filtered, (item) => item.city);
  const byMonth = sumLeadHistory(filtered, (item) => `${item.year}-${String(item.month).padStart(2, "0")}`)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => {
      const [itemYear, itemMonth] = key.split("-").map(Number);
      return [`${MONTHS[itemMonth - 1]} ${String(itemYear).slice(-2)}`, value] as [string, number];
    });
  const classified = filtered.filter((item) => item.region !== "Da classificare").reduce((sum, item) => sum + item.leads, 0);
  const topChannel = byChannel[0];
  const topRegion = byRegion.find(([name]) => name !== "Da classificare") ?? byRegion[0];
  const visibleChannels = sumLeadHistory(filtered, (item) => item.channel).slice(0, 5).map(([name]) => name);
  const visibleRegions = byRegion.filter(([name]) => name !== "Da classificare").slice(0, 8).map(([name]) => name);
  const matrixValue = (regionName: string, channelName: string) => filtered
    .filter((item) => item.region === regionName && item.channel === channelName)
    .reduce((sum, item) => sum + item.leads, 0);
  const comparisonYear = year === "all" ? currentYear : Number(year);
  const comparisonFilter = (item: LeadHistoryItem, targetYear: number) =>
    item.year === targetYear &&
    (month === "all" || item.month === Number(month)) &&
    (channel === "all" || item.channel === channel) &&
    (region === "all" || item.region === region);
  const comparisonCurrent = history.filter((item) => comparisonFilter(item, comparisonYear)).reduce((sum, item) => sum + item.leads, 0);
  const comparisonPrevious = history.filter((item) => comparisonFilter(item, comparisonYear - 1)).reduce((sum, item) => sum + item.leads, 0);
  const managementFilter = (item: LeadManagementItem, targetYear?: number) =>
    (targetYear === undefined ? (year === "all" || item.year === Number(year)) : item.year === targetYear) &&
    (month === "all" || item.month === Number(month)) &&
    (channel === "all" || item.channel === channel);
  const managementCurrent = management.filter((item) => managementFilter(item));
  const managementPrevious = year === "all" ? [] : management.filter((item) => managementFilter(item, comparisonYear - 1));
  const managementSourceTotal = history.filter((item) =>
    (year === "all" || item.year === Number(year)) &&
    (month === "all" || item.month === Number(month)) &&
    (channel === "all" || item.channel === channel)
  ).reduce((sum, item) => sum + item.leads, 0);

  return <>
    <header className="page-head"><div><p className="eyebrow">Acquisizione</p><h1>Lead e gestione commerciale</h1><span>Provenienza, territorio e lavorazione dei lead assegnati ai venditori</span></div></header>
    <section className="filter-bar">
      <label><span>Anno</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Tutti</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>Mese</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">Tutti</option>{MONTHS.map((item, index) => <option value={index + 1} key={item}>{item}</option>)}</select></label>
      <label><span>Canale</span><select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">Tutti</option>{channels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>Regione</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">Tutte</option>{regions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <button onClick={() => { setYear("all"); setMonth("all"); setChannel("all"); setRegion("all"); }}>Azzera filtri</button>
    </section>
    {history.length ? <>
      <div className="metrics-grid source-metrics">
        <Metric label="Lead analizzati" value={total} primary={`${byChannel.length} canali`} secondary="nel periodo filtrato" />
        <Metric label="Canale principale" value={topChannel?.[0] ?? "—"} primary={topChannel ? `${topChannel[1]} lead` : "Nessun dato"} secondary={topChannel ? percentage(topChannel[1], total) : "—"} />
        <Metric label="Prima regione" value={topRegion?.[0] ?? "—"} primary={topRegion ? `${topRegion[1]} lead` : "Nessun dato"} secondary={topRegion ? percentage(topRegion[1], total) : "—"} />
        <Metric label="Zone classificate" value={percentage(classified, total)} primary={`${classified} lead`} secondary={`${total - classified} da verificare`} />
      </div>
      <YoYComparison rows={[{ label: "Lead", current: comparisonCurrent, previous: comparisonPrevious }]} />
      <LeadManagementPanel current={managementCurrent} previous={managementPrevious} sourceLeadTotal={managementSourceTotal} comparisonEnabled={year !== "all"} />
      <div className="history-grid source-history-grid">
        <section className="panel"><header><div><h3>Andamento mensile</h3><p>Volumi e stagionalità dei lead</p></div><TrendingUp size={19} /></header><BarList rows={byMonth} maxRows={18} /></section>
        <section className="panel"><header><div><h3>Canali di acquisizione</h3><p>Facebook, Instagram, TikTok e altri</p></div><BarChart3 size={19} /></header><BarList rows={byChannel} /></section>
        <section className="panel"><header><div><h3>Cluster regionali</h3><p>Lead attribuiti alle regioni italiane</p></div><Users size={19} /></header><BarList rows={byRegion} maxRows={20} /></section>
        <section className="panel"><header><div><h3>Zone più attive</h3><p>Comuni e località dichiarate nei moduli</p></div><Target size={19} /></header><BarList rows={byCity} maxRows={15} /></section>
      </div>
      <section className="panel table-panel cluster-panel">
        <header><div><h3>Matrice canale × regione</h3><p>Concentrazione geografica dei canali principali</p></div><Gauge size={19} /></header>
        <div className="cluster-matrix" style={{ gridTemplateColumns: `minmax(150px, 1.25fr) repeat(${visibleChannels.length}, minmax(82px, .7fr)) 74px` }}>
          <div className="cluster-cell cluster-head">Regione</div>{visibleChannels.map((item) => <div className="cluster-cell cluster-head" key={item}>{item}</div>)}<div className="cluster-cell cluster-head">Totale</div>
          {visibleRegions.map((regionName) => {
            const rowTotal = filtered.filter((item) => item.region === regionName).reduce((sum, item) => sum + item.leads, 0);
            return <div className="cluster-row" style={{ gridColumn: `1 / span ${visibleChannels.length + 2}` }} key={regionName}>
              <div className="cluster-cell"><b>{regionName}</b></div>
              {visibleChannels.map((channelName) => <div className="cluster-cell" key={channelName}><span>{matrixValue(regionName, channelName)}</span></div>)}
              <div className="cluster-cell"><strong>{rowTotal}</strong></div>
            </div>;
          })}
        </div>
        <div className="notice"><CircleAlert size={17} /><span>Le località non riconosciute restano nel cluster “Da classificare”. In questo modo non attribuiamo automaticamente una regione sbagliata ai dati sporchi o ambigui.</span></div>
      </section>
    </> : <section className="placeholder compact"><CircleAlert size={30} /><h2>Storico lead in attesa</h2><p>Aggiorna Apps Script alla versione cluster per caricare le tab mensili di Make Leads.</p></section>}
  </>;
}

type ChannelSummary = { channel: string; entries: number; appointments: number; quotes: number; reconstructedQuotes: number; contracts: number };

function summarizeChannels(items: ChannelCohortItem[]) {
  const grouped = new Map<string, ChannelSummary>();
  items.forEach((item) => {
    const current = grouped.get(item.channel) ?? { channel: item.channel, entries: 0, appointments: 0, quotes: 0, reconstructedQuotes: 0, contracts: 0 };
    current.entries += item.entries; current.appointments += item.appointments; current.quotes += item.quotes; current.reconstructedQuotes += item.reconstructedQuotes ?? 0; current.contracts += item.contracts;
    grouped.set(item.channel, current);
  });
  return [...grouped.values()].sort((a, b) => b.entries - a.entries || b.contracts - a.contracts || a.channel.localeCompare(b.channel));
}

function ChannelFunnel({ title, subtitle, rows }: { title: string; subtitle: string; rows: Array<[string, number]> }) {
  const base = Math.max(1, rows[0]?.[1] ?? 1);
  return <section className="panel channel-funnel"><header><div><h3>{title}</h3><p>{subtitle}</p></div><GitBranch size={19} /></header><div className="channel-funnel-list">
    {rows.map(([label, value], index) => <div className="channel-funnel-row" key={label}><div><span>{label}</span><strong>{value}</strong></div><div className="channel-funnel-track"><i style={{ width: `${Math.max(value ? 5 : 0, Math.min(100, value / base * 100))}%` }} /></div><small>{index === 0 ? "Ingresso" : percentage(value, base)}</small></div>)}
  </div></section>;
}

type ChannelSellerSummary = { name: string; leadAppointments: number; leadQuotes: number; leadContracts: number; directQuotes: number; directContracts: number };

function summarizeChannelSellers(leadItems: ChannelCohortItem[], directItems: ChannelCohortItem[]) {
  const grouped = new Map<string, ChannelSellerSummary>();
  const add = (items: ChannelCohortItem[], kind: "lead" | "direct") => items.forEach((item) => (item.sellers ?? []).forEach((seller) => {
    if (kind === "direct" && seller.quotes === 0 && seller.contracts === 0) return;
    const current = grouped.get(seller.name) ?? { name: seller.name, leadAppointments: 0, leadQuotes: 0, leadContracts: 0, directQuotes: 0, directContracts: 0 };
    if (kind === "lead") { current.leadAppointments += seller.appointments; current.leadQuotes += seller.quotes; current.leadContracts += seller.contracts; }
    else { current.directQuotes += seller.quotes; current.directContracts += seller.contracts; }
    grouped.set(seller.name, current);
  }));
  add(leadItems, "lead"); add(directItems, "direct");
  return [...grouped.values()].sort((a, b) => (b.leadContracts + b.directContracts) - (a.leadContracts + a.directContracts) || (b.leadQuotes + b.directQuotes) - (a.leadQuotes + a.directQuotes) || b.leadAppointments - a.leadAppointments);
}

type ShowRateSellerSummary = { name: string; leadAppointments: number; leadPresented: number; leadNoShows: number; leadPending: number };

function summarizeShowRateSellers(items: ShowRateHistoryItem[]) {
  const grouped = new Map<string, ShowRateSellerSummary>();
  items.forEach((item) => (item.sellers ?? []).forEach((seller) => {
    const current = grouped.get(seller.name) ?? { name: seller.name, leadAppointments: 0, leadPresented: 0, leadNoShows: 0, leadPending: 0 };
    current.leadAppointments += seller.leadAppointments ?? 0;
    current.leadPresented += seller.leadPresented ?? 0;
    current.leadNoShows += seller.leadNoShows ?? 0;
    current.leadPending += seller.leadPending ?? 0;
    grouped.set(seller.name, current);
  }));
  return [...grouped.values()].filter((item) => item.leadAppointments > 0).sort((a, b) => showRateNumber(b) - showRateNumber(a) || b.leadAppointments - a.leadAppointments);
}

function showRateNumber(item: Pick<ShowRateSellerSummary, "leadPresented" | "leadNoShows">) {
  const resolved = item.leadPresented + item.leadNoShows;
  return resolved ? item.leadPresented / resolved : 0;
}

function currentWeekOfMonth(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.min(5, Math.floor((date.getDate() + (first.getDay() + 6) % 7 - 1) / 7) + 1);
}

function ChannelPeriodChart({ leadItems, directItems, view }: { leadItems: ChannelCohortItem[]; directItems: ChannelCohortItem[]; view: "monthly" | "weekly" }) {
  const all = [...leadItems, ...directItems];
  const keys = view === "weekly"
    ? [...new Set(all.map((item) => item.week).filter(Boolean))].sort((a, b) => a - b).map((week) => `S${week}`)
    : [...new Set(all.map((item) => `${item.year}-${String(item.month).padStart(2, "0")}`))].sort().slice(-12);
  const rows = keys.map((key) => {
    const matching = (item: ChannelCohortItem) => view === "weekly" ? item.week === Number(key.slice(1)) : `${item.year}-${String(item.month).padStart(2, "0")}` === key;
    const sample = all.find(matching);
    const leads = leadItems.filter(matching).reduce((sum, item) => sum + item.entries, 0);
    const quotes = all.filter(matching).reduce((sum, item) => sum + item.quotes, 0);
    const contracts = all.filter(matching).reduce((sum, item) => sum + item.contracts, 0);
    return { key, label: view === "weekly" ? key : sample ? `${MONTHS[sample.month - 1]} ${String(sample.year).slice(-2)}` : key, leads, quotes, contracts };
  });
  const ceiling = Math.max(1, ...rows.flatMap((item) => [item.leads, item.quotes, item.contracts]));
  return <section className="panel channel-monthly"><header><div><h3>{view === "weekly" ? "Andamento per settimana del mese" : "Andamento per mese di ingresso"}</h3><p>{view === "weekly" ? "Confronto S1–S5: lead, preventivi e contratti" : "Coorti mensili: lead, preventivi e contratti maturati"}</p></div><TrendingUp size={19} /></header>
    {rows.length ? <div className="channel-month-chart" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(46px, 1fr))` }}>{rows.map((item) => <div className="channel-month" key={item.key}><div className="channel-bars"><i className="leads" style={{ height: `${Math.max(item.leads ? 3 : 0, item.leads / ceiling * 100)}%` }} title={`${item.label}: ${item.leads} lead`} /><i className="quotes" style={{ height: `${Math.max(item.quotes ? 3 : 0, item.quotes / ceiling * 100)}%` }} title={`${item.label}: ${item.quotes} preventivi`} /><i className="contracts" style={{ height: `${Math.max(item.contracts ? 3 : 0, item.contracts / ceiling * 100)}%` }} title={`${item.label}: ${item.contracts} contratti`} /></div><span>{item.label}</span></div>)}</div> : <div className="empty-compact">Nessuna coorte disponibile.</div>}
    <div className="trend-legend"><span><i className="channel-leads" />Lead</span><span><i className="quotes" />Preventivi</span><span><i className="actual" />Contratti</span></div>
  </section>;
}

function ChannelsView({ payload }: { payload: DashboardPayload }) {
  const analysis = payload.channelAnalysis;
  const leadHistory = analysis?.leadCohorts ?? [];
  const directHistory = analysis?.directCohorts ?? [];
  const allHistory = [...leadHistory, ...directHistory];
  const currentDate = new Date();
  const years = [...new Set(allHistory.map((item) => item.year))].sort((a, b) => b - a);
  const channels = [...new Set(allHistory.map((item) => item.channel))].sort((a, b) => a === "Non attribuiti" ? 1 : b === "Non attribuiti" ? -1 : a.localeCompare(b));
  const sellers = [...new Set(allHistory.flatMap((item) => (item.sellers ?? []).map((seller) => seller.name)))].sort();
  const [view, setView] = useState<"monthly" | "weekly">("monthly");
  const [year, setYear] = useState(String(currentDate.getFullYear()));
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [week, setWeek] = useState(String(currentWeekOfMonth(currentDate)));
  const [channel, setChannel] = useState("all");
  const [seller, setSeller] = useState("all");
  const filter = (item: ChannelCohortItem) => (year === "all" || item.year === Number(year)) && (month === "all" || item.month === Number(month)) && (channel === "all" || item.channel === channel) && (view === "monthly" || week === "all" || item.week === Number(week));
  const filteredLeads = leadHistory.filter(filter); const filteredDirect = directHistory.filter(filter);
  const leadRows = summarizeChannels(filteredLeads); const directRows = summarizeChannels(filteredDirect).filter((item) => item.quotes > 0 || item.contracts > 0);
  const total = (rows: ChannelSummary[]) => rows.reduce((sum, item) => ({ entries: sum.entries + item.entries, appointments: sum.appointments + item.appointments, quotes: sum.quotes + item.quotes, reconstructedQuotes: sum.reconstructedQuotes + item.reconstructedQuotes, contracts: sum.contracts + item.contracts }), { entries: 0, appointments: 0, quotes: 0, reconstructedQuotes: 0, contracts: 0 });
  const leadTotals = total(leadRows); const directTotals = total(directRows);
  const quotes = leadTotals.quotes + directTotals.quotes; const contracts = leadTotals.contracts + directTotals.contracts;
  const reconstructedQuotes = leadTotals.reconstructedQuotes + directTotals.reconstructedQuotes;
  const sellerRows = summarizeChannelSellers(filteredLeads, filteredDirect).filter((item) => seller === "all" || item.name === seller);
  const filteredShowRate = (analysis?.showRateHistory ?? []).filter((item) => (year === "all" || item.year === Number(year)) && (month === "all" || item.month === Number(month)) && (view === "monthly" || week === "all" || item.week === Number(week)));
  const showSellerRows = summarizeShowRateSellers(filteredShowRate).filter((item) => seller === "all" || item.name === seller);
  const showSellerTotals = showSellerRows.reduce((sum, item) => ({ leadAppointments: sum.leadAppointments + item.leadAppointments, leadPresented: sum.leadPresented + item.leadPresented, leadNoShows: sum.leadNoShows + item.leadNoShows, leadPending: sum.leadPending + item.leadPending }), { leadAppointments: 0, leadPresented: 0, leadNoShows: 0, leadPending: 0 });
  const leadContractsTotal = sellerRows.reduce((sum, item) => sum + item.leadContracts, 0);
  const chartFilter = (item: ChannelCohortItem) => (year === "all" || item.year === Number(year)) && (channel === "all" || item.channel === channel) && (view === "monthly" || month === "all" || item.month === Number(month));
  const chartLeads = leadHistory.filter(chartFilter); const chartDirect = directHistory.filter(chartFilter);
  const comparisonYear = year === "all" ? currentDate.getFullYear() : Number(year);
  const comparisonFilter = (item: ChannelCohortItem, targetYear: number) => item.year === targetYear && (month === "all" || item.month === Number(month)) && (channel === "all" || item.channel === channel) && (view === "monthly" || week === "all" || item.week === Number(week));
  const previousLeadTotals = total(summarizeChannels(leadHistory.filter((item) => comparisonFilter(item, comparisonYear - 1))));
  const previousDirectTotals = total(summarizeChannels(directHistory.filter((item) => comparisonFilter(item, comparisonYear - 1))));
  return <><header className="page-head"><div><p className="eyebrow">Acquisizione e conversione</p><h1>Canali</h1><span>Totali, dettaglio venditori e coorti mensili o settimanali</span></div><div className="period-tabs"><button className={view === "monthly" ? "active" : ""} onClick={() => setView("monthly")}>Mensile</button><button className={view === "weekly" ? "active" : ""} onClick={() => setView("weekly")}>Settimanale</button></div></header>
    <section className="filter-bar"><label><span>Anno di ingresso</span><select value={year} onChange={(e) => setYear(e.target.value)}><option value="all">Tutti</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label><span>Mese di ingresso</span><select value={month} onChange={(e) => setMonth(e.target.value)}><option value="all">Tutti</option>{MONTHS.map((item, index) => <option value={index + 1} key={item}>{item}</option>)}</select></label>{view === "weekly" ? <label><span>Settimana del mese</span><select value={week} onChange={(e) => setWeek(e.target.value)}><option value="all">Tutte</option>{[1, 2, 3, 4, 5].map((item) => <option value={item} key={item}>S{item}</option>)}</select></label> : null}<label><span>Canale / fonte</span><select value={channel} onChange={(e) => setChannel(e.target.value)}><option value="all">Tutti</option>{channels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label><span>Venditore (dettaglio)</span><select value={seller} onChange={(e) => setSeller(e.target.value)}><option value="all">Tutti</option>{sellers.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><button onClick={() => { setYear(String(currentDate.getFullYear())); setMonth(String(currentDate.getMonth() + 1)); setWeek(String(currentWeekOfMonth(currentDate))); setChannel("all"); setSeller("all"); }}>Azzera filtri</button></section>
    {analysis ? <><div className="metrics-grid channel-metrics"><Metric label="Lead in ingresso" value={leadTotals.entries} primary={percentage(leadTotals.appointments, leadTotals.entries)} secondary="lead → appuntamento" /><Metric label="Preventivi fisici" value={directTotals.quotes} primary={`${directRows.length} fonti`} secondary="walk-in e fonti dirette" /><Metric label="Preventivi totali" value={quotes} primary={percentage(contracts, quotes)} secondary={reconstructedQuotes ? `${reconstructedQuotes} ricostruiti esclusi dal totale` : "preventivi → contratti"} /><Metric label="Contratti totali" value={contracts} primary={`${leadTotals.contracts} lead · ${directTotals.contracts} fisici`} secondary="dal file Venduto" /><Metric label="Show rate lead" value={percentage(showSellerTotals.leadPresented, showSellerTotals.leadPresented + showSellerTotals.leadNoShows)} primary={`${showSellerTotals.leadPresented} SI · ${showSellerTotals.leadNoShows} NO`} secondary={`${showSellerTotals.leadPending} da aggiornare`} /></div>
      <YoYComparison rows={[
        { label: "Lead", current: leadTotals.entries, previous: previousLeadTotals.entries },
        { label: "Appuntamenti social", current: leadTotals.appointments, previous: previousLeadTotals.appointments },
        { label: "Preventivi", current: quotes, previous: previousLeadTotals.quotes + previousDirectTotals.quotes },
        { label: "Contratti", current: contracts, previous: previousLeadTotals.contracts + previousDirectTotals.contracts },
      ]} />
      <div className="two-columns channel-funnels"><ChannelFunnel title="Funnel generato dai lead" subtitle={view === "weekly" ? `Settimana ${week === "all" ? "S1–S5" : `S${week}`}` : "Totale mensile della coorte"} rows={[["Lead", leadTotals.entries], ["Appuntamenti", leadTotals.appointments], ["Preventivi", leadTotals.quotes], ["Contratti", leadTotals.contracts]]} /><ChannelFunnel title="Ingressi fisici" subtitle="Walk-in, loyalty, conoscenza e fonti dirette" rows={[["Preventivi", directTotals.quotes], ["Contratti", directTotals.contracts]]} /></div>
      <ChannelPeriodChart leadItems={chartLeads} directItems={chartDirect} view={view} />
      <section className="panel table-panel channel-table simplified"><header><div><h3>Conversione dei lead per canale</h3><p>Totale completo del periodo selezionato · lettura essenziale</p></div><BarChart3 size={19} /></header><div className="data-table"><div className="data-row data-head"><span>Canale</span><span>Lead</span><span>App.</span><span>Preventivi</span><span>Contratti</span><span>Lead → Contr.</span></div>{leadRows.map((item) => <div className="data-row" key={item.channel}><b>{item.channel}</b><strong>{item.entries}</strong><strong>{item.appointments}</strong><strong>{item.quotes}</strong><strong>{item.contracts}</strong><strong>{percentage(item.contracts, item.entries)}</strong></div>)}<div className="data-row data-total"><b>TOTALE LEAD</b><strong>{leadTotals.entries}</strong><strong>{leadTotals.appointments}</strong><strong>{leadTotals.quotes}</strong><strong>{leadTotals.contracts}</strong><strong>{percentage(leadTotals.contracts, leadTotals.entries)}</strong></div></div></section>
      <section className="panel table-panel direct-channel-table"><header><div><h3>Conversione degli ingressi fisici</h3><p>Gli ingressi fisici partono direttamente dal preventivo</p></div><FileText size={19} /></header><div className="data-table"><div className="data-row data-head"><span>Fonte</span><span>Preventivi</span><span>Contratti</span><span>Prev. → Contr.</span></div>{directRows.map((item) => <div className="data-row" key={item.channel}><b>{item.channel}</b><strong>{item.quotes}</strong><strong>{item.contracts}</strong><span>{percentage(item.contracts, item.quotes)}</span></div>)}<div className="data-row data-total"><b>TOTALE FISICI</b><strong>{directTotals.quotes}</strong><strong>{directTotals.contracts}</strong><strong>{percentage(directTotals.contracts, directTotals.quotes)}</strong></div></div></section>
      <section className="panel table-panel channel-seller-table"><header><div><h3>Divisione per venditore</h3><p>Appuntamenti solo Lead; gli ingressi Fisici iniziano dai preventivi</p></div><Users size={19} /></header><div className="data-table"><div className="data-row data-head"><span>Venditore</span><span>App. lead</span><span>Prev. lead</span><span>Contr. lead</span><span>Prev. fisici</span><span>Contr. fisici</span><span>Prev. totali</span><span>Contr. totali</span><span>CR totale</span></div>{sellerRows.map((item) => <div className="data-row" key={item.name}><b>{item.name}</b><span>{item.leadAppointments}</span><span>{item.leadQuotes}</span><strong>{item.leadContracts}</strong><span>{item.directQuotes}</span><strong>{item.directContracts}</strong><strong>{item.leadQuotes + item.directQuotes}</strong><strong>{item.leadContracts + item.directContracts}</strong><span>{percentage(item.leadContracts + item.directContracts, item.leadQuotes + item.directQuotes)}</span></div>)}</div></section>
      <section className="panel table-panel show-rate-seller-table"><header><div><h3>Efficienza appuntamenti lead per venditore</h3><p>Dal primo appuntamento lead fino al contratto confermato nel file Venduto</p></div><Gauge size={19} /></header><div className="data-table"><div className="data-row data-head"><span>Venditore</span><span>App. lead</span><span>Show (SI)</span><span>No show (NO)</span><span>Da aggiornare</span><span>Show rate</span><span>Contratti lead</span><span>App. → Contr.</span></div>{showSellerRows.map((item) => { const leadContracts = sellerRows.find((row) => row.name === item.name)?.leadContracts ?? 0; return <div className="data-row" key={item.name}><b>{item.name}</b><strong>{item.leadAppointments}</strong><strong>{item.leadPresented}</strong><span>{item.leadNoShows}</span><span>{item.leadPending}</span><strong>{percentage(item.leadPresented, item.leadPresented + item.leadNoShows)}</strong><strong>{leadContracts}</strong><strong>{percentage(leadContracts, item.leadAppointments)}</strong></div>; })}<div className="data-row data-total"><b>TOTALE LEAD</b><strong>{showSellerTotals.leadAppointments}</strong><strong>{showSellerTotals.leadPresented}</strong><strong>{showSellerTotals.leadNoShows}</strong><strong>{showSellerTotals.leadPending}</strong><strong>{percentage(showSellerTotals.leadPresented, showSellerTotals.leadPresented + showSellerTotals.leadNoShows)}</strong><strong>{leadContractsTotal}</strong><strong>{percentage(leadContractsTotal, showSellerTotals.leadAppointments)}</strong></div></div></section>
      <div className="notice"><CircleAlert size={17} /><span><b>Riconciliazione:</b> i preventivi mostrati sono esclusivamente le righe datate del tab Preventivi. {reconstructedQuotes ? `${reconstructedQuotes} contratti senza preventivo collegato sono segnalati separatamente e non gonfiano il totale.` : "Non risultano contratti senza preventivo collegato nel periodo."} I contratti del mese corrente arrivano da PROIEZ. REDDITIVITA&apos;, escludendo righe vuote, interne e future.</span></div></> : <section className="placeholder compact"><CircleAlert size={30} /><h2>Analisi canali in attesa</h2><p>Aggiorna Apps Script con la versione Canali.</p></section>}
  </>;
}

function sumSocialAppointments(items: SocialAppointmentHistoryItem[], key: (item: SocialAppointmentHistoryItem) => string) {
  const result = new Map<string, number>();
  items.forEach((item) => result.set(key(item), (result.get(key(item)) ?? 0) + 1));
  return [...result.entries()].sort((a, b) => b[1] - a[1]);
}

function AppointmentForecastChart({ items, previousItems, year, month }: { items: SocialAppointmentHistoryItem[]; previousItems: SocialAppointmentHistoryItem[]; year: number; month: number }) {
  const now = new Date();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const days: Date[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) days.push(cursor);
  const daily = days.map((date) => items.filter((item) => sameCalendarDay(localContractDate(item.date), date)).length);
  const previousDaily = days.map((date) => previousItems.filter((item) => {
    const previousDate = localContractDate(item.date);
    return previousDate.getMonth() === date.getMonth() && previousDate.getDate() === date.getDate();
  }).length);
  const cumulative = (values: number[]) => values.map((_, index) => values.slice(0, index + 1).reduce((sum, value) => sum + value, 0));
  const actualCumulative = cumulative(daily);
  const previousCumulative = cumulative(previousDaily);
  const cutoffIndex = now >= end ? days.length - 1 : now < start ? 0 : Math.max(0, days.findIndex((date) => sameCalendarDay(date, now)));
  const totalSellingDays = sellingDaysThrough(start, addDays(end, -1));
  const elapsedSellingDays = Math.max(1, sellingDaysThrough(start, days[cutoffIndex]));
  const occurred = actualCumulative[cutoffIndex] ?? 0;
  const scheduled = items.length;
  const paceForecast = now >= end ? scheduled : Math.round(occurred / elapsedSellingDays * totalSellingDays);
  const forecastEnd = Math.max(scheduled, paceForecast);
  const resolved = items.filter((item) => item.status !== "pending" && localContractDate(item.date) <= now);
  const shown = resolved.filter((item) => item.status === "presented").length;
  const projectedShows = resolved.length ? Math.round(forecastEnd * shown / resolved.length) : 0;
  const width = 720; const height = 250; const padding = { left: 38, right: 18, top: 18, bottom: 34 };
  const ceiling = Math.max(10, Math.ceil(Math.max(forecastEnd, scheduled, previousCumulative.at(-1) ?? 0) / 10) * 10);
  const x = (index: number) => padding.left + index / Math.max(1, days.length - 1) * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + (1 - value / ceiling) * (height - padding.top - padding.bottom);
  const actualPoints = days.slice(0, Math.max(cutoffIndex + 1, days.findLastIndex((_, index) => daily[index] > 0) + 1)).map((_, index) => `${x(index)},${y(actualCumulative[index] ?? 0)}`).join(" ");
  const previousPoints = days.map((_, index) => `${x(index)},${y(previousCumulative[index] ?? 0)}`).join(" ");
  const forecastPoints = days.slice(cutoffIndex).map((date, offset) => {
    const index = cutoffIndex + offset;
    const sellingToDate = sellingDaysThrough(start, date);
    const value = occurred + Math.max(0, sellingToDate - elapsedSellingDays) * ((forecastEnd - occurred) / Math.max(1, totalSellingDays - elapsedSellingDays));
    return `${x(index)},${y(value)}`;
  }).join(" ");
  return <section className="panel commercial-trend appointment-forecast"><header><div><h3>Andamento appuntamenti e forecast</h3><p>{MONTHS[month - 1]} {year} · gli appuntamenti futuri già fissati sono inclusi come opportunità</p></div><div className="trend-summary"><span><b>{scheduled}</b> fissati</span><span><b>{forecastEnd}</b> forecast</span><span><b>{projectedShows}</b> show attesi</span><span><b>{percentage(shown, resolved.length)}</b> show rate</span></div></header>
    <div className="trend-chart-wrap"><svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Appuntamenti ${scheduled}, forecast ${forecastEnd}`}>
      {[0, .25, .5, .75, 1].map((ratio) => { const value = ceiling * ratio; return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} /><text x={padding.left - 8} y={y(value) + 4}>{Math.round(value)}</text></g>; })}
      <polyline className="trend-line previous" points={previousPoints} /><polyline className="trend-line appointments" points={actualPoints} /><polyline className="trend-line appointment-forecast-line" points={forecastPoints} />
      {days.map((date, index) => index % 5 === 0 || index === days.length - 1 ? <text className="trend-x-label" x={x(index)} y={height - 9} key={date.toISOString()}>{date.getDate()}</text> : null)}
    </svg></div><div className="trend-legend"><span><i className="appointments" />Appuntamenti fissati</span><span><i className="appointment-forecast-key" />Forecast</span><span><i className="previous" />Stesso mese anno scorso</span></div>
  </section>;
}

function SocialAppointmentsView({ payload }: { payload: DashboardPayload }) {
  const history = payload.socialAppointmentHistory ?? [];
  const now = new Date();
  const years = [...new Set(history.map((item) => item.year))].sort((a, b) => b - a);
  const sellers = [...new Set(history.map((item) => item.seller))].filter(Boolean).sort();
  const channels = [...new Set(history.map((item) => item.channel))].filter(Boolean).sort();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [week, setWeek] = useState("all");
  const [seller, setSeller] = useState("all");
  const [channel, setChannel] = useState("all");
  const filter = (item: SocialAppointmentHistoryItem, targetYear = year === "all" ? null : Number(year)) =>
    (targetYear === null || item.year === targetYear) &&
    (month === "all" || item.month === Number(month)) &&
    (week === "all" || item.week === Number(week)) &&
    (seller === "all" || item.seller === seller) &&
    (channel === "all" || item.channel === channel);
  const filtered = history.filter((item) => filter(item));
  const leadCohorts = payload.channelAnalysis?.leadCohorts ?? [];
  const filteredLeadCohorts = leadCohorts.filter((item) =>
    (year === "all" || item.year === Number(year)) &&
    (month === "all" || item.month === Number(month)) &&
    (week === "all" || item.week === Number(week)) &&
    (channel === "all" || item.channel === channel)
  );
  const cohortValue = (field: "quotes" | "contracts") => filteredLeadCohorts.reduce((sum, item) => {
    if (seller === "all") return sum + item[field];
    return sum + (item.sellers ?? []).filter((row) => row.name === seller).reduce((sellerSum, row) => sellerSum + row[field], 0);
  }, 0);
  const fallbackLeadQuotes = (payload.quoteHistory ?? []).filter((item) =>
    (year === "all" || item.year === Number(year)) &&
    (month === "all" || item.month === Number(month)) &&
    (week === "all" || weekOfMonth(new Date(item.date)) === Number(week)) &&
    (seller === "all" || item.seller === seller) && isLeadQuote(item)
  ).length;
  const fallbackLeadContracts = (payload.contractHistory ?? []).filter((item) =>
    (year === "all" || item.year === Number(year)) &&
    (month === "all" || item.month === Number(month)) &&
    (week === "all" || weekOfMonth(localContractDate(item.date)) === Number(week)) &&
    (seller === "all" || item.seller === seller) && isLeadContract(item)
  ).length;
  const leadQuotes = leadCohorts.length ? cohortValue("quotes") : fallbackLeadQuotes;
  const leadContracts = leadCohorts.length ? cohortValue("contracts") : fallbackLeadContracts;
  const presented = filtered.filter((item) => item.status === "presented").length;
  const noShows = filtered.filter((item) => item.status === "no-show").length;
  const pending = filtered.filter((item) => item.status === "pending").length;
  const resolved = presented + noShows;
  const future = filtered.filter((item) => localContractDate(item.date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && item.status === "pending").length;
  const byWeek = [1, 2, 3, 4, 5].map((item) => [`S${item}`, filtered.filter((row) => row.week === item).length] as [string, number]);
  const bySeller = sumSocialAppointments(filtered, (item) => item.seller || "Non assegnato");
  const byChannel = sumSocialAppointments(filtered, (item) => item.channel || "Facebook");
  const byStatus: Array<[string, number]> = [["Show (SI)", presented], ["No show (NO)", noShows], ["Da aggiornare", pending]];
  const comparisonYear = year === "all" ? now.getFullYear() : Number(year);
  const previous = history.filter((item) => filter(item, comparisonYear - 1));
  const previousPresented = previous.filter((item) => item.status === "presented").length;
  const previousNoShows = previous.filter((item) => item.status === "no-show").length;
  const effectiveYear = year === "all" ? now.getFullYear() : Number(year);
  const effectiveMonth = month === "all" ? now.getMonth() + 1 : Number(month);
  const forecastItems = history.filter((item) => item.year === effectiveYear && item.month === effectiveMonth && (seller === "all" || item.seller === seller) && (channel === "all" || item.channel === channel));
  const previousForecastItems = history.filter((item) => item.year === effectiveYear - 1 && item.month === effectiveMonth && (seller === "all" || item.seller === seller) && (channel === "all" || item.channel === channel));
  const cohortSellerRows = summarizeChannelSellers(filteredLeadCohorts, []);
  const efficiencySellerNames = [...new Set([...filtered.map((item) => item.seller), ...cohortSellerRows.map((item) => item.name)])]
    .filter((name) => name && (seller === "all" || name === seller)).sort();
  const efficiencyRows = efficiencySellerNames.map((name) => {
    const appointments = filtered.filter((item) => item.seller === name);
    const shown = appointments.filter((item) => item.status === "presented").length;
    const missed = appointments.filter((item) => item.status === "no-show").length;
    const waiting = appointments.filter((item) => item.status === "pending").length;
    const cohort = cohortSellerRows.find((item) => item.name === name);
    const quotes = cohort?.leadQuotes ?? (payload.quoteHistory ?? []).filter((item) => item.seller === name && isLeadQuote(item) && (year === "all" || item.year === Number(year)) && (month === "all" || item.month === Number(month)) && (week === "all" || weekOfMonth(new Date(item.date)) === Number(week))).length;
    const contracts = cohort?.leadContracts ?? (payload.contractHistory ?? []).filter((item) => item.seller === name && isLeadContract(item) && (year === "all" || item.year === Number(year)) && (month === "all" || item.month === Number(month)) && (week === "all" || weekOfMonth(localContractDate(item.date)) === Number(week))).length;
    return { name, appointments: appointments.length, shown, missed, waiting, quotes, contracts };
  }).sort((a, b) => (b.contracts / Math.max(1, b.quotes)) - (a.contracts / Math.max(1, a.quotes)) || b.contracts - a.contracts);
  return <>
    <header className="page-head"><div><p className="eyebrow">Funnel digitale</p><h1>Appuntamenti social</h1><span>Solo appuntamenti generati da Facebook, Instagram, TikTok, sito e canali digitali</span></div></header>
    <section className="filter-bar">
      <label><span>Anno</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Tutti</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>Mese</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">Tutti</option>{MONTHS.map((item, index) => <option value={index + 1} key={item}>{item}</option>)}</select></label>
      <label><span>Settimana</span><select value={week} onChange={(event) => setWeek(event.target.value)}><option value="all">Tutte</option>{[1, 2, 3, 4, 5].map((item) => <option value={item} key={item}>S{item}</option>)}</select></label>
      <label><span>Venditore</span><select value={seller} onChange={(event) => setSeller(event.target.value)}><option value="all">Tutti</option>{sellers.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>Canale</span><select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">Tutti</option>{channels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <button onClick={() => { setYear(String(now.getFullYear())); setMonth(String(now.getMonth() + 1)); setWeek("all"); setSeller("all"); setChannel("all"); }}>Azzera filtri</button>
    </section>
    {history.length ? <>
      <div className="metrics-grid social-appointment-metrics">
        <Metric label="Appuntamenti social" value={filtered.length} primary={`${future} opportunità future`} secondary="nel periodo selezionato" />
        <Metric label="Show" value={presented} primary={percentage(presented, resolved)} secondary={`${noShows} no-show`} />
        <Metric label="Da aggiornare" value={pending} primary={percentage(pending, filtered.length)} secondary="senza SI/NO nel Calendar" />
        <Metric label="Conversione lead" value={percentage(leadContracts, leadQuotes)} primary={`${leadContracts} contratti su ${leadQuotes} preventivi`} secondary="preventivo lead → contratto" />
      </div>
      <YoYComparison rows={[
        { label: "Appuntamenti social", current: filtered.length, previous: previous.length },
        { label: "Show", current: presented, previous: previousPresented },
        { label: "Show rate", current: resolved ? presented / resolved * 100 : 0, previous: previousPresented + previousNoShows ? previousPresented / (previousPresented + previousNoShows) * 100 : 0, format: "percentage" },
      ]} />
      <AppointmentForecastChart items={forecastItems} previousItems={previousForecastItems} year={effectiveYear} month={effectiveMonth} />
      <div className="history-grid">
        <section className="panel"><header><div><h3>Settimane del mese</h3><p>Distribuzione degli appuntamenti social S1–S5</p></div><CalendarDays size={19} /></header><BarList rows={byWeek} /></section>
        <section className="panel"><header><div><h3>Efficienza per venditore</h3><p>Volume di appuntamenti social assegnati</p></div><Users size={19} /></header><BarList rows={bySeller} /></section>
        <section className="panel"><header><div><h3>Canali social</h3><p>Origine degli appuntamenti digitali</p></div><GitBranch size={19} /></header><BarList rows={byChannel} /></section>
        <section className="panel"><header><div><h3>Esito appuntamenti</h3><p>SI, NO e appuntamenti ancora da aggiornare</p></div><Gauge size={19} /></header><BarList rows={byStatus} /></section>
      </div>
      <section className="panel table-panel social-seller-table lead-efficiency-table"><header><div><h3>Efficienza lead per venditore</h3><p>Appuntamenti e show restano operativi; la conversione commerciale è sempre contratti ÷ preventivi lead</p></div><BarChart3 size={19} /></header><div className="data-table"><div className="data-row data-head"><span>Venditore</span><span>App.</span><span>Show</span><span>Show rate</span><span>Prev. lead</span><span>Contr. lead</span><span>Prev. → Contr.</span><span>App. → Contr.</span></div>{efficiencyRows.map((row) => <div className="data-row" key={row.name}><b>{row.name}</b><strong>{row.appointments}</strong><strong>{row.shown}</strong><strong className={row.shown + row.missed && row.shown / (row.shown + row.missed) >= .7 ? "good" : ""}>{percentage(row.shown, row.shown + row.missed)}</strong><strong>{row.quotes}</strong><strong>{row.contracts}</strong><strong className="conversion-primary">{percentage(row.contracts, row.quotes)}</strong><span>{percentage(row.contracts, row.appointments)}</span></div>)}<div className="data-row data-total"><b>TOTALE</b><strong>{filtered.length}</strong><strong>{presented}</strong><strong>{percentage(presented, resolved)}</strong><strong>{leadQuotes}</strong><strong>{leadContracts}</strong><strong className="conversion-primary">{percentage(leadContracts, leadQuotes)}</strong><span>{percentage(leadContracts, filtered.length)}</span></div></div></section>
      <div className="notice"><CircleAlert size={17} /><span>I lead grezzi non vengono assegnati artificialmente a un venditore: l’attribuzione parte dall’appuntamento. La colonna <b>Prev. → Contr.</b> è il tasso di conversione; <b>App. → Contr.</b> è soltanto un indicatore operativo.</span></div>
    </> : <section className="placeholder compact"><CircleAlert size={30} /><h2>Appuntamenti social in attesa</h2><p>Incolla e distribuisci la nuova versione Apps Script per collegare Calendar ai lead social.</p></section>}
  </>;
}

function quoteOutcome(item: QuoteHistoryItem) {
  const text = `${item.outcome} ${item.feedback}`.toLowerCase();
  if (text.includes("contratt")) return "Contratto";
  if (text.includes("in contatto")) return "In contatto";
  if (text.includes("da risentire") || text.includes("richiam") || text.includes("appuntamento") || text.includes("app.to")) return "Da risentire";
  if (!text.trim()) return "Senza esito";
  if (["prezzo alto", "ritiro usato basso", "acquisto rimandato", "non abbiamo", "troppo distant", "acquistato altrove", "solo info"].some((value) => text.includes(value))) return "Perso / rimandato";
  return "Esito libero";
}

function clientKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\([^)]*\)/g, " ").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((token) => token.length > 1 && !["SIG", "SIGRA", "SIGNORE", "SIGNORA"].includes(token)).sort().join(" ");
}

function quoteMatchesContract(item: QuoteHistoryItem, contract: ContractHistoryItem) {
  const quoteClient = clientKey(item.client);
  const quoteDate = new Date(item.date);
  const contractDate = localContractDate(contract.date);
  return Boolean(quoteClient) && clientKey(contract.client ?? "") === quoteClient && contractDate >= new Date(quoteDate.getFullYear(), quoteDate.getMonth(), quoteDate.getDate());
}

function quoteIsSold(item: QuoteHistoryItem, contracts: ContractHistoryItem[]) {
  return contracts.some((contract) => quoteMatchesContract(item, contract));
}

function quoteDisplayStatus(item: QuoteHistoryItem, contracts: ContractHistoryItem[]) {
  if (quoteIsSold(item, contracts)) return "Venduto";
  const operational = quoteOutcome(item);
  return operational === "Contratto" ? "Contratto da verificare" : operational;
}

function quoteVehicleCluster(value: string) {
  const text = value.toLowerCase();
  if (!text.trim()) return "Non specificata";
  if (["vivaro", "talento", "trafic", "fiorino", "doblo", "doblò", "commerciale"].some((key) => text.includes(key))) return "Veicoli commerciali";
  if (["suv", "crossover", "q3", "q5", "x1", "x3", "x5", "x6", "stelvio", "evoque", "sportage", "2008", "3008", "5008", "mokka", "tonale", "compass", "rav 4", "rav4", "country", "kamiq", "tiguan"].some((key) => text.includes(key))) return "SUV e crossover";
  if (["500", "panda", "yaris", "clio", "polo", "corsa", "fiesta", "picanto", "lancia y", "ypsilon", "ibiza", "208", "city car"].some((key) => text.includes(key))) return "Utilitarie e city car";
  if (["audi", "bmw", "mercedes", "classe", "golf", "octavia", "superb", "mini"].some((key) => text.includes(key))) return "Premium e berline";
  return "Altro / multimodello";
}

function sumQuotes(items: QuoteHistoryItem[], key: (item: QuoteHistoryItem) => string) {
  const result = new Map<string, number>();
  items.forEach((item) => result.set(key(item), (result.get(key(item)) ?? 0) + 1));
  return [...result.entries()].sort((a, b) => b[1] - a[1]);
}

function QuoteGoalPanel({ items, sellers, selectedSeller, year, month }: { items: QuoteHistoryItem[]; sellers: string[]; selectedSeller: string; year: number; month: number }) {
  const visibleSellers = selectedSeller === "all" ? sellers : [selectedSeller];
  const target = visibleSellers.length * 40;
  const now = new Date();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const totalDays = sellingDaysThrough(start, addDays(end, -1));
  const cutoff = now >= end ? addDays(end, -1) : now < start ? start : now;
  const elapsedDays = Math.max(1, sellingDaysThrough(start, cutoff));
  const forecast = now >= end ? items.length : Math.round(items.length / elapsedDays * totalDays);
  const attainment = target ? Math.min(100, items.length / target * 100) : 0;
  return <section className="panel goal-panel quote-goal"><header><div><h3>Obiettivo e ritmo preventivi</h3><p>40 preventivi per venditore · {target} totali</p></div><Target size={19} /></header>
    <div className="goal-big"><strong>{items.length}</strong><span>/ {target}</span></div><div className="progress quote-progress"><i style={{ width: `${attainment}%` }} /></div>
    <div className="goal-grid"><div><span>Atteso a oggi</span><strong>{Math.round(target * elapsedDays / totalDays)}</strong></div><div><span>Forecast fine mese</span><strong>{forecast}</strong></div><div><span>Completamento</span><strong>{formatNumber(attainment)}%</strong></div><div><span>Mancano</span><strong>{Math.max(0, target - items.length)}</strong></div></div>
    <div className="seller-goals">{visibleSellers.map((name) => { const value = items.filter((item) => item.seller === name).length; return <div key={name}><span>{name}</span><div className="track"><i style={{ width: `${Math.min(100, value / 40 * 100)}%` }} /></div><strong>{value}/40</strong></div>; })}</div>
  </section>;
}

function QuoteForecastChart({ items, previousItems, year, month, target }: { items: QuoteHistoryItem[]; previousItems: QuoteHistoryItem[]; year: number; month: number; target: number }) {
  const now = new Date();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const days: Date[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) days.push(cursor);
  const daily = days.map((date) => items.filter((item) => sameCalendarDay(new Date(item.date), date)).length);
  const cumulative = daily.map((_, index) => daily.slice(0, index + 1).reduce((sum, value) => sum + value, 0));
  const previousDaily = days.map((date) => previousItems.filter((item) => {
    const itemDate = new Date(item.date);
    return itemDate.getMonth() === date.getMonth() && itemDate.getDate() === date.getDate();
  }).length);
  const previousCumulative = previousDaily.map((_, index) => previousDaily.slice(0, index + 1).reduce((sum, value) => sum + value, 0));
  const cutoffIndex = now >= end ? days.length - 1 : now < start ? 0 : Math.max(0, days.findIndex((date) => sameCalendarDay(date, now)));
  const totalSellingDays = sellingDaysThrough(start, addDays(end, -1));
  const elapsedSellingDays = Math.max(1, sellingDaysThrough(start, days[cutoffIndex]));
  const actual = cumulative[cutoffIndex] ?? 0;
  const forecastEnd = now >= end ? actual : Math.round(actual / elapsedSellingDays * totalSellingDays);
  const width = 720; const height = 250; const padding = { left: 38, right: 18, top: 18, bottom: 34 };
  const previousTotal = previousCumulative.at(-1) ?? 0;
  const ceiling = Math.max(10, Math.ceil(Math.max(target, forecastEnd, actual, previousTotal) / 10) * 10);
  const x = (index: number) => padding.left + index / Math.max(1, days.length - 1) * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + (1 - value / ceiling) * (height - padding.top - padding.bottom);
  const actualPoints = days.slice(0, cutoffIndex + 1).map((_, index) => `${x(index)},${y(cumulative[index] ?? 0)}`).join(" ");
  const previousPoints = days.map((_, index) => `${x(index)},${y(previousCumulative[index] ?? 0)}`).join(" ");
  const forecastPoints = days.slice(cutoffIndex).map((date, offset) => {
    const index = cutoffIndex + offset;
    const sellingToDate = sellingDaysThrough(start, date);
    const value = actual + Math.max(0, sellingToDate - elapsedSellingDays) * ((forecastEnd - actual) / Math.max(1, totalSellingDays - elapsedSellingDays));
    return `${x(index)},${y(value)}`;
  }).join(" ");
  const targetPoints = days.map((date, index) => `${x(index)},${y(target * sellingDaysThrough(start, date) / totalSellingDays)}`).join(" ");
  return <section className="panel commercial-trend quote-forecast"><header><div><h3>Trend preventivi e previsione fine mese</h3><p>{MONTHS[month - 1]} {year} · confronto con {MONTHS[month - 1]} {year - 1}</p></div><div className="trend-summary"><span><b>{actual}</b> attuali</span><span><b>{previousTotal}</b> anno scorso</span><span><b>{forecastEnd}</b> forecast</span><span><b>{target}</b> obiettivo</span></div></header>
    <div className="trend-chart-wrap"><svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Preventivi ${actual}, forecast ${forecastEnd}, obiettivo ${target}`}>
      {[0, .25, .5, .75, 1].map((ratio) => { const value = ceiling * ratio; return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} /><text x={padding.left - 8} y={y(value) + 4}>{Math.round(value)}</text></g>; })}
      <polyline className="trend-line previous" points={previousPoints} /><polyline className="trend-line target" points={targetPoints} /><polyline className="trend-line quotes" points={actualPoints} /><polyline className="trend-line quote-forecast-line" points={forecastPoints} />
      {days.map((date, index) => index % 5 === 0 || index === days.length - 1 ? <text className="trend-x-label" x={x(index)} y={height - 9} key={date.toISOString()}>{date.getDate()}</text> : null)}
    </svg></div><div className="trend-legend"><span><i className="quotes" />Preventivi reali</span><span><i className="previous" />Stesso mese anno scorso</span><span><i className="forecast-quote" />Forecast</span><span><i className="target" />Obiettivo</span></div>
  </section>;
}

function QuoteWeeklyPanel({ quotes, contracts, previousQuotes, previousContracts, year, month }: { quotes: QuoteHistoryItem[]; contracts: ContractHistoryItem[]; previousQuotes: QuoteHistoryItem[]; previousContracts: ContractHistoryItem[]; year: number; month: number }) {
  const rows = [1, 2, 3, 4, 5].map((week) => {
    const quoteCount = quotes.filter((item) => weekOfMonth(new Date(item.date)) === week).length;
    const contractCount = contracts.filter((item) => weekOfMonth(localContractDate(item.date)) === week).length;
    const previousQuoteCount = previousQuotes.filter((item) => weekOfMonth(new Date(item.date)) === week).length;
    const previousContractCount = previousContracts.filter((item) => weekOfMonth(localContractDate(item.date)) === week).length;
    return { week, label: weekLabel(year, month, week), quotes: quoteCount, contracts: contractCount, previousQuotes: previousQuoteCount, previousContracts: previousContractCount };
  });
  const totalQuotes = rows.reduce((sum, row) => sum + row.quotes, 0);
  const totalContracts = rows.reduce((sum, row) => sum + row.contracts, 0);
  const ceiling = Math.max(1, ...rows.flatMap((row) => [row.quotes, row.contracts]));
  return <section className="panel quote-weekly-panel"><header><div><h3>Preventivi settimana per settimana</h3><p>{MONTHS[month - 1]} {year} · contratti confermati dal file Venduto</p></div><CalendarDays size={19} /></header>
    <div className="quote-weekly-chart">{rows.map((row) => <article key={row.week}><div className="quote-weekly-bars"><i className="quotes" style={{ height: `${Math.max(row.quotes ? 5 : 0, row.quotes / ceiling * 100)}%` }} title={`${row.quotes} preventivi`} /><i className="contracts" style={{ height: `${Math.max(row.contracts ? 5 : 0, row.contracts / ceiling * 100)}%` }} title={`${row.contracts} contratti`} /></div><b>S{row.week}</b><span>{row.quotes} prev.</span><small>{percentage(row.contracts, row.quotes)}</small></article>)}</div>
    <div className="trend-legend"><span><i className="quotes" />Preventivi</span><span><i className="actual" />Contratti</span><span><b>{percentage(totalContracts, totalQuotes)}</b> conversione totale</span></div>
    <div className="data-table quote-weekly-table"><div className="data-row data-head"><span>Settimana</span><span>Preventivi</span><span>Anno scorso</span><span>Variazione</span><span>Contratti</span><span>Prev. → Contr.</span></div>{rows.map((row) => <div className="data-row" key={row.week}><b>{row.label}</b><strong>{row.quotes}</strong><span>{row.previousQuotes}</span><strong className={row.quotes >= row.previousQuotes ? "positive" : "negative"}>{comparisonDelta(row.quotes, row.previousQuotes)}</strong><strong>{row.contracts}</strong><strong className="conversion-primary">{percentage(row.contracts, row.quotes)}</strong></div>)}<div className="data-row data-total"><b>TOTALE MESE</b><strong>{totalQuotes}</strong><span>{previousQuotes.length}</span><strong className={totalQuotes >= previousQuotes.length ? "positive" : "negative"}>{comparisonDelta(totalQuotes, previousQuotes.length)}</strong><strong>{totalContracts}</strong><strong className="conversion-primary">{percentage(totalContracts, totalQuotes)}</strong></div></div>
  </section>;
}

function QuotesView({ payload }: { payload: DashboardPayload }) {
  const history = payload.quoteHistory ?? [];
  const soldContracts = payload.contractHistory ?? [];
  const now = new Date();
  const years = [...new Set(history.map((item) => item.year))].sort((a, b) => b - a);
  const sellers = [...new Set(history.map((item) => item.seller))].filter(Boolean).sort();
  const [year, setYear] = useState(years.includes(now.getFullYear()) ? String(now.getFullYear()) : "all");
  const [month, setMonth] = useState(history.some((item) => item.year === now.getFullYear() && item.month === now.getMonth() + 1) ? String(now.getMonth() + 1) : "all");
  const [week, setWeek] = useState("all");
  const [seller, setSeller] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const filtered = history.filter((item) =>
    (year === "all" || item.year === Number(year)) &&
    (month === "all" || item.month === Number(month)) &&
    (week === "all" || weekOfMonth(new Date(item.date)) === Number(week)) &&
    (seller === "all" || item.seller === seller) &&
    (outcome === "all" || quoteDisplayStatus(item, soldContracts) === outcome)
  );
  const selectedContracts = soldContracts.filter((contract) =>
    (year === "all" || contract.year === Number(year)) &&
    (month === "all" || contract.month === Number(month)) &&
    (week === "all" || weekOfMonth(localContractDate(contract.date)) === Number(week)) &&
    (seller === "all" || contract.seller === seller)
  );
  const converted = outcome === "all" ? selectedContracts.length : selectedContracts.filter((contract) => filtered.some((item) => quoteMatchesContract(item, contract))).length;
  const followUps = filtered.filter((item) => ["Da risentire", "In contatto"].includes(quoteOutcome(item))).length;
  const withVehicle = filtered.filter((item) => item.vehicle.trim()).length;
  const bySeller = sumQuotes(filtered, (item) => item.seller || "Non assegnato");
  const byOutcome = sumQuotes(filtered, (item) => quoteDisplayStatus(item, soldContracts));
  const byVehicle = sumQuotes(filtered, (item) => quoteVehicleCluster(item.vehicle));
  const byMonth = sumQuotes(filtered, (item) => `${item.year}-${String(item.month).padStart(2, "0")}`)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => {
      const [itemYear, itemMonth] = key.split("-").map(Number);
      return [`${MONTHS[itemMonth - 1]} ${String(itemYear).slice(-2)}`, value] as [string, number];
    });
  const recent = [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const effectiveYear = year === "all" ? now.getFullYear() : Number(year);
  const effectiveMonth = month === "all" ? now.getMonth() + 1 : Number(month);
  const goalItems = history.filter((item) => item.year === effectiveYear && item.month === effectiveMonth && (seller === "all" || item.seller === seller));
  const previousItems = history.filter((item) => item.year === effectiveYear - 1 && item.month === effectiveMonth && (seller === "all" || item.seller === seller));
  const goalConvertedContracts = soldContracts.filter((contract) => contract.year === effectiveYear && contract.month === effectiveMonth && (seller === "all" || contract.seller === seller));
  const previousConvertedContracts = soldContracts.filter((contract) => contract.year === effectiveYear - 1 && contract.month === effectiveMonth && (seller === "all" || contract.seller === seller));
  const goalConverted = goalConvertedContracts.length;
  const previousConverted = previousConvertedContracts.length;
  const goalSellers = SALES_TEAM;
  const quoteTarget = seller === "all" ? SALES_TEAM.length * 40 : 40;

  return <>
    <header className="page-head"><div><p className="eyebrow">Trattative</p><h1>Preventivi</h1><span>Make Leads · volumi, follow-up, richieste e motivi di perdita</span></div></header>
    <section className="filter-bar">
      <label><span>Anno</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Tutti</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>Mese</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">Tutti</option>{MONTHS.map((item, index) => <option value={index + 1} key={item}>{item}</option>)}</select></label>
      <label><span>Settimana</span><select value={week} onChange={(event) => setWeek(event.target.value)}><option value="all">Tutte</option>{[1, 2, 3, 4, 5].map((item) => <option value={item} key={item}>S{item}</option>)}</select></label>
      <label><span>Venditore</span><select value={seller} onChange={(event) => setSeller(event.target.value)}><option value="all">Tutti</option>{sellers.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>Esito</span><select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="all">Tutti</option>{["Venduto", "Contratto da verificare", "Da risentire", "In contatto", "Perso / rimandato", "Esito libero", "Senza esito"].map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <button onClick={() => { setYear(String(now.getFullYear())); setMonth(String(now.getMonth() + 1)); setWeek("all"); setSeller("all"); setOutcome("all"); }}>Azzera filtri</button>
    </section>
    {history.length ? <>
      <div className="metrics-grid quotes-metrics">
        <Metric label="Preventivi" value={filtered.length} primary={`${bySeller.length} venditori`} secondary="nel periodo filtrato" />
        <Metric label="Da lavorare" value={followUps} primary={percentage(followUps, filtered.length)} secondary="da risentire o in contatto" />
        <Metric label="Contratti verificati" value={converted} primary={percentage(converted, filtered.length)} secondary="dal file Venduto" />
        <Metric label="Conversione totale" value={percentage(converted, filtered.length)} primary={`${converted} contratti / ${filtered.length} preventivi`} secondary="sempre preventivi → contratti" />
        <Metric label="Richiesta descritta" value={percentage(withVehicle, filtered.length)} primary={`${withVehicle} preventivi`} secondary="utilizzabili per i cluster" />
      </div>
      <YoYComparison rows={[
        { label: "Preventivi", current: goalItems.length, previous: previousItems.length },
        { label: "Contratti da preventivo", current: goalConverted, previous: previousConverted },
        { label: "Conversione", current: goalItems.length ? goalConverted / goalItems.length * 100 : 0, previous: previousItems.length ? previousConverted / previousItems.length * 100 : 0, format: "percentage" },
      ]} />
      <div className="two-columns quote-analysis"><QuoteGoalPanel items={goalItems} sellers={goalSellers} selectedSeller={seller} year={effectiveYear} month={effectiveMonth} /><section className="panel"><header><div><h3>Preventivi per venditore</h3><p>Carico commerciale nel periodo</p></div><Users size={19} /></header><BarList rows={bySeller} /></section></div>
      <QuoteForecastChart items={goalItems} previousItems={previousItems} year={effectiveYear} month={effectiveMonth} target={quoteTarget} />
      <QuoteWeeklyPanel quotes={goalItems} contracts={goalConvertedContracts} previousQuotes={previousItems} previousContracts={previousConvertedContracts} year={effectiveYear} month={effectiveMonth} />
      <div className="history-grid">
        <section className="panel"><header><div><h3>Andamento mensile</h3><p>Numero di preventivi nel tempo</p></div><TrendingUp size={19} /></header><BarList rows={byMonth} maxRows={18} /></section>
        <section className="panel"><header><div><h3>Stato delle trattative</h3><p>Follow-up, conversioni e motivi di uscita</p></div><Target size={19} /></header><BarList rows={byOutcome} /></section>
        <section className="panel"><header><div><h3>Cluster richieste auto</h3><p>Tipologie ricavate dalla descrizione veicolo</p></div><BarChart3 size={19} /></header><BarList rows={byVehicle} /></section>
      </div>
      <section className="panel table-panel quotes-table"><header><div><h3>Preventivi recenti</h3><p>Ultime trattative nel periodo selezionato</p></div><FileText size={19} /></header><div className="data-table">
        <div className="data-row data-head"><span>Data</span><span>Cliente</span><span>Venditore</span><span>Veicolo / richiesta</span><span>Stato</span></div>
        {recent.map((item, index) => <div className="data-row" key={`${item.date}-${item.client}-${index}`}><span>{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(item.date))}</span><b>{item.client || "—"}</b><span>{item.seller || "—"}</span><span>{item.vehicle || "Non specificata"}</span><strong>{quoteDisplayStatus(item, soldContracts)}</strong></div>)}
      </div></section>
    </> : <section className="placeholder compact"><CircleAlert size={30} /><h2>Preventivi in attesa</h2><p>Aggiorna Apps Script alla versione Preventivi per caricare il tab Make Leads.</p></section>}
  </>;
}

function SellersView({ payload }: { payload: DashboardPayload }) {
  const now = new Date();
  const appointmentHistory = payload.socialAppointmentHistory ?? [];
  const quoteHistory = payload.quoteHistory ?? [];
  const contracts = payload.contractHistory ?? [];
  const years = [...new Set([...appointmentHistory.map((item) => item.year), ...quoteHistory.map((item) => item.year), ...contracts.map((item) => item.year)])].sort((a, b) => b - a);
  const sellerNames = [...new Set([...appointmentHistory.map((item) => item.seller), ...quoteHistory.map((item) => item.seller), ...contracts.map((item) => item.seller)])].filter(Boolean).sort();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [sellerFilter, setSellerFilter] = useState("all");
  const targetYear = Number(year);
  const apps = appointmentHistory.filter((item) => item.year === targetYear && (month === "all" || item.month === Number(month)) && (sellerFilter === "all" || item.seller === sellerFilter));
  const quotes = quoteHistory.filter((item) => item.year === targetYear && (month === "all" || item.month === Number(month)) && (sellerFilter === "all" || item.seller === sellerFilter));
  const sales = contracts.filter((item) => item.year === targetYear && (month === "all" || item.month === Number(month)) && (sellerFilter === "all" || item.seller === sellerFilter));
  const previousApps = appointmentHistory.filter((item) => item.year === targetYear - 1 && (month === "all" || item.month === Number(month)) && (sellerFilter === "all" || item.seller === sellerFilter));
  const previousQuotes = quoteHistory.filter((item) => item.year === targetYear - 1 && (month === "all" || item.month === Number(month)) && (sellerFilter === "all" || item.seller === sellerFilter));
  const previousSales = contracts.filter((item) => item.year === targetYear - 1 && (month === "all" || item.month === Number(month)) && (sellerFilter === "all" || item.seller === sellerFilter));
  const totals = { appointments: apps.length, presented: apps.filter((item) => item.status === "presented").length, noShows: apps.filter((item) => item.status === "no-show").length, contracts: sales.length };
  const resolved = totals.presented + totals.noShows;
  const leadCohorts = (payload.channelAnalysis?.leadCohorts ?? []).filter((item) => item.year === targetYear && (month === "all" || item.month === Number(month)));
  const leadCohortSellers = summarizeChannelSellers(leadCohorts, []);
  const rows = sellerNames.filter((name) => sellerFilter === "all" || name === sellerFilter).map((name) => {
    const sellerApps = apps.filter((item) => item.seller === name);
    const presented = sellerApps.filter((item) => item.status === "presented").length;
    const noShows = sellerApps.filter((item) => item.status === "no-show").length;
    const cohort = leadCohortSellers.find((item) => item.name === name);
    const leadQuotes = cohort?.leadQuotes ?? quotes.filter((item) => item.seller === name && isLeadQuote(item)).length;
    const leadContracts = cohort?.leadContracts ?? sales.filter((item) => item.seller === name && isLeadContract(item)).length;
    return { name, appointments: sellerApps.length, presented, noShows, pending: sellerApps.length - presented - noShows, leadQuotes, leadContracts, quotes: quotes.filter((item) => item.seller === name).length, contracts: sales.filter((item) => item.seller === name).length };
  }).sort((a, b) => (b.leadContracts / Math.max(1, b.leadQuotes)) - (a.leadContracts / Math.max(1, a.leadQuotes)) || b.leadContracts - a.leadContracts);
  const top = rows[0];
  const totalLeadQuotes = rows.reduce((sum, row) => sum + row.leadQuotes, 0);
  const totalLeadContracts = rows.reduce((sum, row) => sum + row.leadContracts, 0);
  return <>
    <header className="page-head"><div><p className="eyebrow">Performance commerciale</p><h1>Conversione venditori</h1><span>Appuntamenti social + contratti confermati dal file Venduto</span></div></header>
    <section className="filter-bar"><label><span>Anno</span><select value={year} onChange={(event) => setYear(event.target.value)}>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label><span>Mese</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">Tutti</option>{MONTHS.map((item, index) => <option value={index + 1} key={item}>{item}</option>)}</select></label><label><span>Venditore</span><select value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)}><option value="all">Tutti</option>{sellerNames.map((item) => <option value={item} key={item}>{item}</option>)}</select></label></section>
    <div className="metrics-grid seller-metrics">
      <Metric label="Preventivi totali" value={quotes.length} primary={`${sales.length} contratti`} secondary="tutti i canali" />
      <Metric label="Conversione totale" value={percentage(sales.length, quotes.length)} primary={`${sales.length} contratti / ${quotes.length} preventivi`} secondary="sempre preventivi → contratti" />
      <Metric label="Appuntamenti social" value={totals.appointments} primary={`${apps.filter((item) => item.status === "pending").length} da aggiornare`} secondary="indicatore BDC separato" />
      <Metric label="Presentati" value={totals.presented} primary={`${percentage(totals.presented, resolved)} show rate`} secondary={`${totals.noShows} no-show`} />
      <Metric label="Top conversione lead" value={top?.name ?? "—"} primary={top ? `${percentage(top.leadContracts, top.leadQuotes)} · ${top.leadContracts}/${top.leadQuotes}` : "Nessun dato"} secondary="preventivi lead → contratti" />
    </div>
    <YoYComparison rows={[
      { label: "Appuntamenti social", current: apps.length, previous: previousApps.length },
      { label: "Show", current: totals.presented, previous: previousApps.filter((item) => item.status === "presented").length },
      { label: "Preventivi", current: quotes.length, previous: previousQuotes.length },
      { label: "Contratti lead", current: sales.filter(isLeadContract).length, previous: previousSales.filter(isLeadContract).length },
      { label: "Conversione totale", current: quotes.length ? sales.length / quotes.length * 100 : 0, previous: previousQuotes.length ? previousSales.length / previousQuotes.length * 100 : 0, format: "percentage" },
    ]} />
    <section className="panel table-panel">
      <header><div><h3>Efficienza lead per venditore</h3><p>La conversione è sul preventivo; appuntamenti e show misurano il lavoro BDC</p></div><BarChart3 size={19} /></header>
      <div className="data-table seller-lead-efficiency"><div className="data-row data-head"><span>Venditore</span><span>App. social</span><span>Show</span><span>Show rate</span><span>Prev. lead</span><span>Contr. lead</span><span>Prev. → Contr.</span><span>App. → Contr.</span></div>{rows.map((seller) => <div className="data-row" key={seller.name}><b>{seller.name}</b><strong>{seller.appointments}</strong><strong>{seller.presented}</strong><strong className={seller.presented + seller.noShows && seller.presented / (seller.presented + seller.noShows) >= .7 ? "good" : ""}>{percentage(seller.presented, seller.presented + seller.noShows)}</strong><strong>{seller.leadQuotes}</strong><strong>{seller.leadContracts}</strong><strong className="conversion-primary">{percentage(seller.leadContracts, seller.leadQuotes)}</strong><span>{percentage(seller.leadContracts, seller.appointments)}</span></div>)}<div className="data-row data-total"><b>TOTALE</b><strong>{totals.appointments}</strong><strong>{totals.presented}</strong><strong>{percentage(totals.presented, resolved)}</strong><strong>{totalLeadQuotes}</strong><strong>{totalLeadContracts}</strong><strong className="conversion-primary">{percentage(totalLeadContracts, totalLeadQuotes)}</strong><span>{percentage(totalLeadContracts, totals.appointments)}</span></div></div>
    </section>
  </>;
}

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function aggregate(items: ContractHistoryItem[], key: (item: ContractHistoryItem) => string) {
  const result = new Map<string, number>();
  items.forEach((item) => result.set(key(item), (result.get(key(item)) ?? 0) + 1));
  return [...result.entries()].sort((a, b) => b[1] - a[1]);
}

function BarList({ rows, maxRows = 12 }: { rows: Array<[string, number]>; maxRows?: number }) {
  const visible = rows.slice(0, maxRows);
  const max = Math.max(1, ...visible.map((row) => row[1]));
  return <div className="history-bars">{visible.map(([label, value]) => <div className="history-bar" key={label}><span>{label}</span><div className="track"><i style={{ width: `${value / max * 100}%` }} /></div><strong>{value}</strong></div>)}</div>;
}

function CurrencyBarList({ rows, maxRows = 12 }: { rows: Array<[string, number]>; maxRows?: number }) {
  const visible = rows.slice(0, maxRows);
  const max = Math.max(1, ...visible.map((row) => row[1]));
  return <div className="history-bars currency-bars">{visible.map(([label, value]) => <div className="history-bar" key={label}><span>{label}</span><div className="track"><i style={{ width: `${value / max * 100}%` }} /></div><strong>{formatCurrency(value)}</strong></div>)}</div>;
}

function ContractsView({ payload }: { payload: DashboardPayload }) {
  const history = payload.contractHistory ?? [];
  const years = [...new Set(history.map((item) => item.year))].sort((a, b) => b - a);
  const sellers = [...new Set(history.map((item) => item.seller))].filter(Boolean).sort();
  const currentDate = new Date();
  const defaultYear = years.includes(currentDate.getFullYear()) ? String(currentDate.getFullYear()) : "all";
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState("all");
  const [seller, setSeller] = useState("all");
  const filtered = history.filter((item) => (year === "all" || item.year === Number(year)) && (month === "all" || item.month === Number(month)) && (seller === "all" || item.seller === seller));
  const annualBase = history.filter((item) => (month === "all" || item.month === Number(month)) && (seller === "all" || item.seller === seller));
  const byYear = aggregate(annualBase, (item) => String(item.year)).sort((a, b) => Number(a[0]) - Number(b[0]));
  const byMonth = MONTHS.map((label, index) => [label, filtered.filter((item) => item.month === index + 1).length] as [string, number]);
  const bySeller = aggregate(filtered, (item) => item.seller);
  const byOrigin = aggregate(filtered, (item) => item.origin);
  const revenue = filtered.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const revenueByMonth = MONTHS.map((label, index) => [label, filtered.filter((item) => item.month === index + 1).reduce((sum, item) => sum + (item.revenue || 0), 0)] as [string, number]);
  const topSeller = bySeller[0];
  const topOrigin = byOrigin.find(([name]) => name !== "Non disponibile" && name !== "Non indicata") ?? byOrigin[0];
  const activeMonths = new Set(filtered.map((item) => `${item.year}-${item.month}`)).size;
  const effectiveYear = year === "all" ? (years[0] ?? currentDate.getFullYear()) : Number(year);
  const sellerBase = history.filter((item) => seller === "all" || item.seller === seller);
  const yearCutoffMonth = effectiveYear === currentDate.getFullYear() ? currentDate.getMonth() + 1 : 12;
  const yearCutoffDay = effectiveYear === currentDate.getFullYear() ? currentDate.getDate() : 31;
  const currentYearCount = sellerBase.filter((item) => item.year === effectiveYear && (item.month < yearCutoffMonth || (item.month === yearCutoffMonth && Number(item.date.slice(8, 10)) <= yearCutoffDay))).length;
  const previousYearCount = sellerBase.filter((item) => item.year === effectiveYear - 1 && (item.month < yearCutoffMonth || (item.month === yearCutoffMonth && Number(item.date.slice(8, 10)) <= yearCutoffDay))).length;
  const effectiveMonth = month === "all" ? (effectiveYear === currentDate.getFullYear() ? currentDate.getMonth() + 1 : 12) : Number(month);
  const currentMonthCount = sellerBase.filter((item) => item.year === effectiveYear && item.month === effectiveMonth).length;
  const lastYearMonthRows = sellerBase.filter((item) => item.year === effectiveYear - 1 && item.month === effectiveMonth);
  const sameMonthRows = sellerBase.filter((item) => item.year === effectiveYear && item.month === effectiveMonth);
  const sameMonthRevenue = sameMonthRows.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const lastYearMonthRevenue = lastYearMonthRows.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const delta = (value: number, comparison: number) => comparison ? `${value >= comparison ? "+" : ""}${formatNumber((value / comparison - 1) * 100)}%` : "—";

  return <>
    <header className="page-head"><div><p className="eyebrow">Analisi vendite</p><h1>Storico contratti</h1><span>Car One + AD Motor · dal 2024 a oggi</span></div></header>
    <section className="filter-bar">
      <label><span>Anno</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Tutti</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>Mese</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">Tutti</option>{MONTHS.map((item, index) => <option value={index + 1} key={item}>{item}</option>)}</select></label>
      <label><span>Venditore</span><select value={seller} onChange={(event) => setSeller(event.target.value)}><option value="all">Tutti</option>{sellers.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <button onClick={() => { setYear("all"); setMonth("all"); setSeller("all"); }}>Azzera filtri</button>
    </section>
    {history.length ? <>
      <div className="metrics-grid contract-metrics">
        <Metric label="Contratti" value={filtered.length} primary={`${filtered.filter((item) => item.company === "Car One").length} Car One`} secondary={`${filtered.filter((item) => item.company === "AD Motor").length} AD Motor`} />
        <Metric label="Fatturato" value={formatCurrency(revenue)} primary={filtered.length ? `${formatCurrency(revenue / filtered.length)} ticket medio` : "—"} secondary="valore vendita / importo fatturato" />
        <Metric label="Top venditore" value={topSeller?.[0] ?? "—"} primary={topSeller ? `${topSeller[1]} contratti` : "Nessun dato"} secondary="nel periodo filtrato" />
        <Metric label="Prima origine" value={topOrigin?.[0] ?? "—"} primary={topOrigin ? `${topOrigin[1]} contratti` : "Nessun dato"} secondary="origine normalizzata" />
      </div>
      <YoYComparison rows={[
        { label: "Contratti", current: sameMonthRows.length, previous: lastYearMonthRows.length },
        { label: "Fatturato", current: sameMonthRevenue, previous: lastYearMonthRevenue, format: "currency" },
        { label: "Ticket medio", current: sameMonthRows.length ? sameMonthRevenue / sameMonthRows.length : 0, previous: lastYearMonthRows.length ? lastYearMonthRevenue / lastYearMonthRows.length : 0, format: "currency" },
      ]} />
      <div className="comparison-strip">
        <div><span>{effectiveYear} vs {effectiveYear - 1}{effectiveYear === currentDate.getFullYear() ? " · stesso periodo" : ""}</span><strong className={currentYearCount >= previousYearCount ? "positive" : "negative"}>{delta(currentYearCount, previousYearCount)}</strong><small>{currentYearCount} vs {previousYearCount} contratti</small></div>
        <div><span>{MONTHS[effectiveMonth - 1]} {effectiveYear} vs {effectiveYear - 1}</span><strong className={currentMonthCount >= lastYearMonthRows.length ? "positive" : "negative"}>{delta(currentMonthCount, lastYearMonthRows.length)}</strong><small>{currentMonthCount} vs {lastYearMonthRows.length} contratti</small></div>
      </div>
      <div className="history-grid">
        <section className="panel"><header><div><h3>Contratti per anno</h3><p>Andamento storico Car One + AD Motor</p></div><TrendingUp size={19} /></header><BarList rows={byYear} /></section>
        <section className="panel"><header><div><h3>Andamento mensile</h3><p>Stagionalità nel periodo selezionato</p></div><BarChart3 size={19} /></header><BarList rows={byMonth} /></section>
        <section className="panel"><header><div><h3>Fatturato mensile</h3><p>Valore di vendita letto dai fogli Google</p></div><Euro size={19} /></header><CurrencyBarList rows={revenueByMonth} /></section>
        <section className="panel"><header><div><h3>Performance venditori</h3><p>Volumi contratti filtrabili</p></div><FileCheck2 size={19} /></header><BarList rows={bySeller} /></section>
        <section className="panel"><header><div><h3>Provenienza contratti</h3><p>Valore letto dalla colonna ORIGINE</p></div><Gauge size={19} /></header><BarList rows={byOrigin} /></section>
      </div>
      <div className="notice"><CircleAlert size={17} /><span>Il mese e la settimana correnti arrivano da PROIEZ. REDDITIVITA&apos; per includere subito i nuovi contratti. Lo storico chiuso arriva dai tab annuali Car One e AD Motor.</span></div>
    </> : <section className="placeholder compact"><CircleAlert size={30} /><h2>Storico in attesa</h2><p>Aggiorna Apps Script alla versione storico per caricare i contratti dal 2024.</p></section>}
  </>;
}

function Placeholder({ section }: { section: string }) {
  const copy: Record<string, [string, string]> = {
    agenda: ["Agenda commerciale", "Vista giorno e settimana con presentati, no-show e appuntamenti da aggiornare."],
  };
  const [title, text] = copy[section];
  return <section className="placeholder"><CircleAlert size={30} /><h2>{title}</h2><p>{text}</p><span>Modulo previsto nella fase successiva dell’MVP.</span></section>;
}

export default function Home() {
  const [section, setSection] = useState("dashboard");
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [payload, setPayload] = useState<DashboardPayload>(snapshot);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Aggiornamento non disponibile");
      setPayload(await response.json() as DashboardPayload);
    } catch {
      // Mantiene l'ultimo dato valido se Google o la rete non rispondono.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const updated = useMemo(() => payload ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.lastUpdated)) : "", [payload]);

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><i /><div><strong>Car One CRM</strong><span>Usato · Perugia</span></div></div><nav>{menu.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}><Icon size={18} /><span>{label}</span></button>)}</nav><footer><CheckCircle2 size={15} /><div><strong>{payload.source === "google-live" ? "Google live · 5 min" : "Snapshot verificato"}</strong><span>{updated || "Caricamento…"}</span></div><button aria-label="Aggiorna dati" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /></button></footer></aside>
    <section className="content">{section === "dashboard" ? <Dashboard payload={payload} period={period} setPeriod={setPeriod} /> : section === "channels" ? <ChannelsView payload={payload} /> : section === "sources" ? <SourcesView payload={payload} /> : section === "agenda" ? <SocialAppointmentsView payload={payload} /> : section === "quotes" ? <QuotesView payload={payload} /> : section === "contracts" ? <ContractsView payload={payload} /> : section === "sellers" ? <SellersView payload={payload} /> : <Placeholder section={section} />}</section>
  </main>;
}
