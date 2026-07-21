"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, CircleAlert, FileCheck2, FileText, Gauge, GitBranch, LayoutDashboard, RefreshCw, Target, TrendingUp, Users } from "lucide-react";
import type { AppointmentItem, ChannelCohortItem, ContractHistoryItem, DashboardPayload, DashboardPeriod, LeadHistoryItem, PeriodKey, QuoteHistoryItem, ShowRateHistoryItem } from "@/lib/types";
import { snapshot } from "@/lib/snapshot";

const menu = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "channels", label: "Canali", icon: GitBranch },
  { id: "sources", label: "Provenienza lead", icon: TrendingUp },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "quotes", label: "Preventivi", icon: FileText },
  { id: "contracts", label: "Contratti", icon: FileCheck2 },
  { id: "sellers", label: "Conversione venditori", icon: BarChart3 },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(value);
}

function percentage(value: number, total: number) {
  return total ? `${formatNumber((value / total) * 100)}%` : "—";
}

function statusLabel(status: "presented" | "no-show" | "pending") {
  if (status === "presented") return "Presentato";
  if (status === "no-show") return "No-show";
  return "Da aggiornare";
}

function Metric({ label, value, primary, secondary }: { label: string; value: string | number; primary: string; secondary: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><footer><b>{primary}</b><small>{secondary}</small></footer></article>;
}

function GoalPanel({ data }: { data: DashboardPeriod }) {
  const attainment = data.target ? Math.min(100, (data.contracts / data.target) * 100) : 0;
  const pace = data.expectedToDate ? (data.contracts / data.expectedToDate) * 100 : null;
  return <section className="panel goal-panel">
    <header><div><h3>Obiettivo e ritmo</h3><p>{data.target ? `Target ${data.target} contratti` : "Nessun target giornaliero"}</p></div><Target size={19} /></header>
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
  </section>;
}

function Pipeline({ data }: { data: DashboardPeriod }) {
  const rows = [
    ["Lead", data.leads, 100],
    ["Appuntamenti", data.appointments, data.leads ? data.appointments / data.leads * 100 : 0],
    ["Presentati", data.presented, data.leads ? data.presented / data.leads * 100 : 0],
    ["Preventivi", data.quotes ?? 0, data.leads ? (data.quotes ?? 0) / data.leads * 100 : 0],
    ["Contratti", data.contracts, data.leads ? data.contracts / data.leads * 100 : 0],
  ] as const;
  return <section className="panel pipeline"><header><div><h3>Pipeline commerciale</h3><p>Volumi e conversioni del periodo</p></div><Gauge size={19} /></header>
    <div className="pipeline-list">{rows.map(([label, value, width]) => <div className="pipeline-row" key={label}><div><span>{label}</span><strong>{value}</strong></div><div className="track"><i style={{ width: `${Math.max(value ? 3 : 0, Math.min(100, width))}%` }} /></div><small>{label === "Lead" ? "Ingresso" : `${percentage(value, data.leads)} dei lead`}</small></div>)}</div>
  </section>;
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

function buildCommercialTrend(payload: DashboardPayload, selectedPeriod: PeriodKey) {
  const period: "week" | "month" = selectedPeriod === "week" ? "week" : "month";
  const now = new Date();
  const currentStart = period === "week" ? mondayOf(now) : new Date(now.getFullYear(), now.getMonth(), 1);
  const currentEnd = period === "week" ? addDays(currentStart, 7) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousStart = period === "week" ? addDays(currentStart, -7) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousEnd = currentStart;
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
  const currentIndex = Math.max(0, Math.min(dates.length - 1, dates.findIndex((date) => sameCalendarDay(date, now))));
  const periodData = payload.periods[period];
  const target = periodData.target;
  const forecastEnd = periodData.forecast ?? currentCumulative[currentIndex] ?? 0;
  const totalSellingDays = sellingDaysThrough(currentStart, addDays(currentEnd, -1));
  const elapsedSellingDays = sellingDaysThrough(currentStart, dates[currentIndex]);
  const remainingSellingDays = Math.max(1, totalSellingDays - elapsedSellingDays);
  const actualAtCutoff = currentCumulative[currentIndex] ?? 0;
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

function CommercialTrend({ payload, period }: { payload: DashboardPayload; period: PeriodKey }) {
  const trend = useMemo(() => buildCommercialTrend(payload, period), [payload, period]);
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

  return <section className="panel commercial-trend">
    <header><div><h3>Andamento commerciale e forecast</h3><p>{trend.period === "week" ? "Settimana corrente vs precedente" : "Mese corrente vs precedente"}</p></div><div className="trend-summary"><span><b>{trend.actualAtCutoff}</b> contratti</span><span><b>{trend.quotesAtCutoff}</b> preventivi</span><span><b>{percentage(trend.actualAtCutoff, trend.quotesAtCutoff)}</b> conversione</span><span className={delta !== null && delta >= 0 ? "good" : "trend-negative"}>{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${formatNumber(delta)}%`} contratti vs precedente</span><span><b>{trend.forecastEnd}</b> forecast</span></div></header>
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
      {activePoint ? <div className="trend-tooltip" style={{ left: `${Math.min(92, Math.max(8, (x(active ?? 0) / width) * 100))}%` }}><b>{activePoint.label}</b><span>Contratti {activePoint.actualContracts ?? "—"}</span><span>Preventivi {activePoint.actualQuotes ?? "—"}</span><span>Conversione {activePoint.conversion === null ? "—" : `${formatNumber(activePoint.conversion)}%`}</span><span>Contratti precedenti {formatNumber(activePoint.previousContracts)}</span><span>Preventivi precedenti {formatNumber(activePoint.previousQuotes)}</span><span>Obiettivo {activePoint.target === null ? "—" : formatNumber(activePoint.target)}</span><span>Forecast {activePoint.forecast === null ? "—" : formatNumber(activePoint.forecast)}</span></div> : null}
    </div> : <div className="empty-compact">Il grafico sarà disponibile quando lo storico contratti live è caricato.</div>}
    <div className="trend-legend"><span><i className="actual" />Contratti</span><span><i className="quotes" />Preventivi</span><span><i className="forecast" />Forecast contratti</span><span><i className="target" />Ritmo obiettivo</span><span><i className="previous" />Periodo precedente</span></div>
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

function Dashboard({ payload, period, setPeriod }: { payload: DashboardPayload; period: PeriodKey; setPeriod: (period: PeriodKey) => void }) {
  const data = payload.periods[period];
  const resolved = data.presented + data.noShows;
  const upcomingAppointments = data.upcomingAppointments ?? 0;
  const overdueAppointments = data.overdueAppointments ?? Math.max(0, data.pendingAppointments - upcomingAppointments);
  return <>
    <header className="page-head"><div><p className="eyebrow">Controllo commerciale</p><h1>Buongiorno, David</h1><span>{data.subtitle}</span></div><div className="period-tabs">{(["today", "week", "month"] as PeriodKey[]).map((key) => <button key={key} className={period === key ? "active" : ""} onClick={() => setPeriod(key)}>{payload.periods[key].label}</button>)}</div></header>
    <div className="metrics-grid dashboard-metrics">
      <Metric label="Lead" value={data.leads} primary={period === "today" ? "Nuovi oggi" : `${percentage(data.appointments, data.leads)} con appuntamento`} secondary="dal Foglio Google" />
      <Metric label="Appuntamenti" value={data.appointments} primary={`${upcomingAppointments} opportunità future`} secondary={`${overdueAppointments} passati da aggiornare`} />
      <Metric label="Presentati" value={data.presented} primary={`${percentage(data.presented, resolved)} show rate`} secondary={`${data.noShows} no-show`} />
      <Metric label="Preventivi" value={data.quotes ?? 0} primary={percentage(data.contracts, data.quotes ?? 0)} secondary="preventivi → contratti" />
      <Metric label="Contratti" value={data.contracts} primary={`${data.carOneContracts} Car One`} secondary={`${data.adMotorContracts} AD Motor`} />
    </div>
    <div className="two-columns"><GoalPanel data={data} /><Pipeline data={data} /></div>
    <CommercialTrend payload={payload} period={period} />
    <WeeklyFlowChart payload={payload} />
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

function SourcesView({ payload }: { payload: DashboardPayload }) {
  const history = payload.leadHistory ?? [];
  const years = [...new Set(history.map((item) => item.year))].sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(years.includes(currentYear) ? String(currentYear) : "all");
  const [month, setMonth] = useState("all");
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

  return <>
    <header className="page-head"><div><p className="eyebrow">Acquisizione</p><h1>Provenienza lead</h1><span>Storico Make Leads · canale, regione e zona</span></div></header>
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

type ChannelSummary = { channel: string; entries: number; appointments: number; quotes: number; contracts: number };

function summarizeChannels(items: ChannelCohortItem[]) {
  const grouped = new Map<string, ChannelSummary>();
  items.forEach((item) => {
    const current = grouped.get(item.channel) ?? { channel: item.channel, entries: 0, appointments: 0, quotes: 0, contracts: 0 };
    current.entries += item.entries; current.appointments += item.appointments; current.quotes += item.quotes; current.contracts += item.contracts;
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

type ChannelSellerSummary = { name: string; leadAppointments: number; leadQuotes: number; leadContracts: number; directAppointments: number; directQuotes: number; directContracts: number };

function summarizeChannelSellers(leadItems: ChannelCohortItem[], directItems: ChannelCohortItem[]) {
  const grouped = new Map<string, ChannelSellerSummary>();
  const add = (items: ChannelCohortItem[], kind: "lead" | "direct") => items.forEach((item) => (item.sellers ?? []).forEach((seller) => {
    const current = grouped.get(seller.name) ?? { name: seller.name, leadAppointments: 0, leadQuotes: 0, leadContracts: 0, directAppointments: 0, directQuotes: 0, directContracts: 0 };
    if (kind === "lead") { current.leadAppointments += seller.appointments; current.leadQuotes += seller.quotes; current.leadContracts += seller.contracts; }
    else { current.directAppointments += seller.appointments; current.directQuotes += seller.quotes; current.directContracts += seller.contracts; }
    grouped.set(seller.name, current);
  }));
  add(leadItems, "lead"); add(directItems, "direct");
  return [...grouped.values()].sort((a, b) => (b.leadContracts + b.directContracts) - (a.leadContracts + a.directContracts) || (b.leadQuotes + b.directQuotes) - (a.leadQuotes + a.directQuotes) || (b.leadAppointments + b.directAppointments) - (a.leadAppointments + a.directAppointments));
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
  const leadRows = summarizeChannels(filteredLeads); const directRows = summarizeChannels(filteredDirect);
  const total = (rows: ChannelSummary[]) => rows.reduce((sum, item) => ({ entries: sum.entries + item.entries, appointments: sum.appointments + item.appointments, quotes: sum.quotes + item.quotes, contracts: sum.contracts + item.contracts }), { entries: 0, appointments: 0, quotes: 0, contracts: 0 });
  const leadTotals = total(leadRows); const directTotals = total(directRows);
  const quotes = leadTotals.quotes + directTotals.quotes; const contracts = leadTotals.contracts + directTotals.contracts;
  const sellerRows = summarizeChannelSellers(filteredLeads, filteredDirect).filter((item) => seller === "all" || item.name === seller);
  const filteredShowRate = (analysis?.showRateHistory ?? []).filter((item) => (year === "all" || item.year === Number(year)) && (month === "all" || item.month === Number(month)) && (view === "monthly" || week === "all" || item.week === Number(week)));
  const show = filteredShowRate.reduce((sum, item) => ({ presented: sum.presented + item.presented, noShows: sum.noShows + item.noShows, pending: sum.pending + item.pending }), { presented: 0, noShows: 0, pending: 0 });
  const showSellerRows = summarizeShowRateSellers(filteredShowRate).filter((item) => seller === "all" || item.name === seller);
  const showSellerTotals = showSellerRows.reduce((sum, item) => ({ leadAppointments: sum.leadAppointments + item.leadAppointments, leadPresented: sum.leadPresented + item.leadPresented, leadNoShows: sum.leadNoShows + item.leadNoShows, leadPending: sum.leadPending + item.leadPending }), { leadAppointments: 0, leadPresented: 0, leadNoShows: 0, leadPending: 0 });
  const leadContractsTotal = sellerRows.reduce((sum, item) => sum + item.leadContracts, 0);
  const chartFilter = (item: ChannelCohortItem) => (year === "all" || item.year === Number(year)) && (channel === "all" || item.channel === channel) && (view === "monthly" || month === "all" || item.month === Number(month));
  const chartLeads = leadHistory.filter(chartFilter); const chartDirect = directHistory.filter(chartFilter);
  return <><header className="page-head"><div><p className="eyebrow">Acquisizione e conversione</p><h1>Canali</h1><span>Totali, dettaglio venditori e coorti mensili o settimanali</span></div><div className="period-tabs"><button className={view === "monthly" ? "active" : ""} onClick={() => setView("monthly")}>Mensile</button><button className={view === "weekly" ? "active" : ""} onClick={() => setView("weekly")}>Settimanale</button></div></header>
    <section className="filter-bar"><label><span>Anno di ingresso</span><select value={year} onChange={(e) => setYear(e.target.value)}><option value="all">Tutti</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label><span>Mese di ingresso</span><select value={month} onChange={(e) => setMonth(e.target.value)}><option value="all">Tutti</option>{MONTHS.map((item, index) => <option value={index + 1} key={item}>{item}</option>)}</select></label>{view === "weekly" ? <label><span>Settimana del mese</span><select value={week} onChange={(e) => setWeek(e.target.value)}><option value="all">Tutte</option>{[1, 2, 3, 4, 5].map((item) => <option value={item} key={item}>S{item}</option>)}</select></label> : null}<label><span>Canale / fonte</span><select value={channel} onChange={(e) => setChannel(e.target.value)}><option value="all">Tutti</option>{channels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label><span>Venditore (dettaglio)</span><select value={seller} onChange={(e) => setSeller(e.target.value)}><option value="all">Tutti</option>{sellers.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><button onClick={() => { setYear(String(currentDate.getFullYear())); setMonth(String(currentDate.getMonth() + 1)); setWeek(String(currentWeekOfMonth(currentDate))); setChannel("all"); setSeller("all"); }}>Azzera filtri</button></section>
    {analysis ? <><div className="metrics-grid channel-metrics"><Metric label="Lead in ingresso" value={leadTotals.entries} primary={percentage(leadTotals.appointments, leadTotals.entries)} secondary="lead → appuntamento" /><Metric label="Preventivi fisici" value={directTotals.quotes} primary={`${directRows.length} fonti`} secondary="walk-in e fonti dirette" /><Metric label="Preventivi totali" value={quotes} primary={percentage(contracts, quotes)} secondary="preventivi → contratti" /><Metric label="Contratti totali" value={contracts} primary={`${leadTotals.contracts} lead · ${directTotals.contracts} fisici`} secondary="dal file Venduto" /><Metric label="Show rate generale" value={percentage(show.presented, show.presented + show.noShows)} primary={`${show.presented} SI · ${show.noShows} NO`} secondary={`${show.pending} da aggiornare`} /></div>
      <div className="two-columns channel-funnels"><ChannelFunnel title="Funnel generato dai lead" subtitle={view === "weekly" ? `Settimana ${week === "all" ? "S1–S5" : `S${week}`}` : "Totale mensile della coorte"} rows={[["Lead", leadTotals.entries], ["Appuntamenti", leadTotals.appointments], ["Preventivi", leadTotals.quotes], ["Contratti", leadTotals.contracts]]} /><ChannelFunnel title="Ingressi fisici" subtitle="Walk-in, loyalty, conoscenza e fonti dirette" rows={[["Appuntamenti", directTotals.appointments], ["Preventivi", directTotals.quotes], ["Contratti", directTotals.contracts]]} /></div>
      <ChannelPeriodChart leadItems={chartLeads} directItems={chartDirect} view={view} />
      <section className="panel table-panel channel-table"><header><div><h3>Conversione dei lead per canale</h3><p>Totale completo del periodo selezionato</p></div><BarChart3 size={19} /></header><div className="data-table"><div className="data-row data-head"><span>Canale</span><span>Lead</span><span>App.</span><span>Lead → App.</span><span>Preventivi</span><span>Lead → Prev.</span><span>Contratti</span><span>Prev. → Contr.</span><span>Lead → Contr.</span></div>{leadRows.map((item) => <div className="data-row" key={item.channel}><b>{item.channel}</b><strong>{item.entries}</strong><span>{item.appointments}</span><span>{percentage(item.appointments, item.entries)}</span><span>{item.quotes}</span><span>{percentage(item.quotes, item.entries)}</span><strong>{item.contracts}</strong><span>{percentage(item.contracts, item.quotes)}</span><span>{percentage(item.contracts, item.entries)}</span></div>)}<div className="data-row data-total"><b>TOTALE LEAD</b><strong>{leadTotals.entries}</strong><strong>{leadTotals.appointments}</strong><strong>{percentage(leadTotals.appointments, leadTotals.entries)}</strong><strong>{leadTotals.quotes}</strong><strong>{percentage(leadTotals.quotes, leadTotals.entries)}</strong><strong>{leadTotals.contracts}</strong><strong>{percentage(leadTotals.contracts, leadTotals.quotes)}</strong><strong>{percentage(leadTotals.contracts, leadTotals.entries)}</strong></div></div></section>
      <section className="panel table-panel direct-channel-table"><header><div><h3>Conversione degli ingressi fisici</h3><p>Totale completo del periodo selezionato</p></div><FileText size={19} /></header><div className="data-table"><div className="data-row data-head"><span>Fonte</span><span>App.</span><span>Preventivi</span><span>App. → Prev.</span><span>Contratti</span><span>Prev. → Contr.</span></div>{directRows.map((item) => <div className="data-row" key={item.channel}><b>{item.channel}</b><strong>{item.appointments}</strong><strong>{item.quotes}</strong><span>{percentage(item.quotes, item.appointments)}</span><strong>{item.contracts}</strong><span>{percentage(item.contracts, item.quotes)}</span></div>)}<div className="data-row data-total"><b>TOTALE FISICI</b><strong>{directTotals.appointments}</strong><strong>{directTotals.quotes}</strong><strong>{percentage(directTotals.quotes, directTotals.appointments)}</strong><strong>{directTotals.contracts}</strong><strong>{percentage(directTotals.contracts, directTotals.quotes)}</strong></div></div></section>
      <section className="panel table-panel channel-seller-table"><header><div><h3>Divisione per venditore</h3><p>Appuntamenti, preventivi e contratti distinti tra Lead e Fisici</p></div><Users size={19} /></header><div className="data-table"><div className="data-row data-head"><span>Venditore</span><span>App. lead</span><span>Prev. lead</span><span>Contr. lead</span><span>App. fisici</span><span>Prev. fisici</span><span>Contr. fisici</span><span>App. totali</span><span>Prev. totali</span><span>Contr. totali</span><span>CR totale</span></div>{sellerRows.map((item) => <div className="data-row" key={item.name}><b>{item.name}</b><span>{item.leadAppointments}</span><span>{item.leadQuotes}</span><strong>{item.leadContracts}</strong><span>{item.directAppointments}</span><span>{item.directQuotes}</span><strong>{item.directContracts}</strong><strong>{item.leadAppointments + item.directAppointments}</strong><strong>{item.leadQuotes + item.directQuotes}</strong><strong>{item.leadContracts + item.directContracts}</strong><span>{percentage(item.leadContracts + item.directContracts, item.leadQuotes + item.directQuotes)}</span></div>)}</div></section>
      <section className="panel table-panel show-rate-seller-table"><header><div><h3>Efficienza appuntamenti lead per venditore</h3><p>Dal primo appuntamento lead fino al contratto confermato nel file Venduto</p></div><Gauge size={19} /></header><div className="data-table"><div className="data-row data-head"><span>Venditore</span><span>App. lead</span><span>Show (SI)</span><span>No show (NO)</span><span>Da aggiornare</span><span>Show rate</span><span>Contratti lead</span><span>App. → Contr.</span></div>{showSellerRows.map((item) => { const leadContracts = sellerRows.find((row) => row.name === item.name)?.leadContracts ?? 0; return <div className="data-row" key={item.name}><b>{item.name}</b><strong>{item.leadAppointments}</strong><strong>{item.leadPresented}</strong><span>{item.leadNoShows}</span><span>{item.leadPending}</span><strong>{percentage(item.leadPresented, item.leadPresented + item.leadNoShows)}</strong><strong>{leadContracts}</strong><strong>{percentage(leadContracts, item.leadAppointments)}</strong></div>; })}<div className="data-row data-total"><b>TOTALE LEAD</b><strong>{showSellerTotals.leadAppointments}</strong><strong>{showSellerTotals.leadPresented}</strong><strong>{showSellerTotals.leadNoShows}</strong><strong>{showSellerTotals.leadPending}</strong><strong>{percentage(showSellerTotals.leadPresented, showSellerTotals.leadPresented + showSellerTotals.leadNoShows)}</strong><strong>{leadContractsTotal}</strong><strong>{percentage(leadContractsTotal, showSellerTotals.leadAppointments)}</strong></div></div></section>
      <div className="notice"><CircleAlert size={17} /><span><b>Venditori:</b> gli appuntamenti arrivano dagli eventi APP di Google Calendar; titolo e descrizione permettono di leggere venditore, cliente, telefono e fonte. I preventivi usano il Funzionario e i contratti il Venditore del file Venduto. I canali digitali restano sempre nel funnel Lead.</span></div></> : <section className="placeholder compact"><CircleAlert size={30} /><h2>Analisi canali in attesa</h2><p>Aggiorna Apps Script con la versione Canali.</p></section>}
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

function QuotesView({ payload }: { payload: DashboardPayload }) {
  const history = payload.quoteHistory ?? [];
  const soldContracts = payload.contractHistory ?? [];
  const now = new Date();
  const years = [...new Set(history.map((item) => item.year))].sort((a, b) => b - a);
  const sellers = [...new Set(history.map((item) => item.seller))].filter(Boolean).sort();
  const [year, setYear] = useState(years.includes(now.getFullYear()) ? String(now.getFullYear()) : "all");
  const [month, setMonth] = useState(history.some((item) => item.year === now.getFullYear() && item.month === now.getMonth() + 1) ? String(now.getMonth() + 1) : "all");
  const [seller, setSeller] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const filtered = history.filter((item) =>
    (year === "all" || item.year === Number(year)) &&
    (month === "all" || item.month === Number(month)) &&
    (seller === "all" || item.seller === seller) &&
    (outcome === "all" || quoteDisplayStatus(item, soldContracts) === outcome)
  );
  const converted = soldContracts.filter((contract) => filtered.some((item) => quoteMatchesContract(item, contract))).length;
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

  return <>
    <header className="page-head"><div><p className="eyebrow">Trattative</p><h1>Preventivi</h1><span>Make Leads · volumi, follow-up, richieste e motivi di perdita</span></div></header>
    <section className="filter-bar">
      <label><span>Anno</span><select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">Tutti</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>Mese</span><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">Tutti</option>{MONTHS.map((item, index) => <option value={index + 1} key={item}>{item}</option>)}</select></label>
      <label><span>Venditore</span><select value={seller} onChange={(event) => setSeller(event.target.value)}><option value="all">Tutti</option>{sellers.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <label><span>Esito</span><select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="all">Tutti</option>{["Venduto", "Contratto da verificare", "Da risentire", "In contatto", "Perso / rimandato", "Esito libero", "Senza esito"].map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <button onClick={() => { setYear("all"); setMonth("all"); setSeller("all"); setOutcome("all"); }}>Azzera filtri</button>
    </section>
    {history.length ? <>
      <div className="metrics-grid">
        <Metric label="Preventivi" value={filtered.length} primary={`${bySeller.length} venditori`} secondary="nel periodo filtrato" />
        <Metric label="Da lavorare" value={followUps} primary={percentage(followUps, filtered.length)} secondary="da risentire o in contatto" />
        <Metric label="Contratti verificati" value={converted} primary={percentage(converted, filtered.length)} secondary="dal file Venduto" />
        <Metric label="Richiesta descritta" value={percentage(withVehicle, filtered.length)} primary={`${withVehicle} preventivi`} secondary="utilizzabili per i cluster" />
      </div>
      <div className="history-grid">
        <section className="panel"><header><div><h3>Andamento mensile</h3><p>Numero di preventivi nel tempo</p></div><TrendingUp size={19} /></header><BarList rows={byMonth} maxRows={18} /></section>
        <section className="panel"><header><div><h3>Preventivi per venditore</h3><p>Carico commerciale nel periodo</p></div><Users size={19} /></header><BarList rows={bySeller} /></section>
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
  const totals = payload.sellerConversions.reduce((acc, seller) => ({ appointments: acc.appointments + seller.appointments, presented: acc.presented + seller.presented, noShows: acc.noShows + seller.noShows, contracts: acc.contracts + seller.contracts }), { appointments: 0, presented: 0, noShows: 0, contracts: 0 });
  const resolved = totals.presented + totals.noShows;
  return <>
    <header className="page-head"><div><p className="eyebrow">Performance commerciale</p><h1>Conversione venditori</h1><span>Luglio 2026 · Calendar + Car One + AD Motor</span></div><div className="period-tabs"><button className="active">Mese</button></div></header>
    <div className="metrics-grid">
      <Metric label="Appuntamenti" value={totals.appointments} primary={`${payload.sellerConversions.reduce((sum, item) => sum + item.pending, 0)} da aggiornare`} secondary="con venditore riconosciuto" />
      <Metric label="Presentati" value={totals.presented} primary={`${percentage(totals.presented, resolved)} show rate`} secondary={`${totals.noShows} no-show`} />
      <Metric label="Contratti" value={totals.contracts} primary={percentage(totals.contracts, totals.appointments)} secondary="appuntamento → contratto" />
      <Metric label="Top contratti" value="Grandolini" primary="7 contratti" secondary="Car One + AD Motor" />
    </div>
    <section className="panel table-panel">
      <header><div><h3>Funnel per venditore</h3><p>La conversione lead sarà disponibile con le nuove assegnazioni nel foglio</p></div><BarChart3 size={19} /></header>
      <div className="data-table seller-table">
        <div className="data-row data-head"><span>Venditore</span><span>App.</span><span>Presentati</span><span>Show rate</span><span>Contratti</span><span>App. → Contr.</span></div>
        {[...payload.sellerConversions].sort((a, b) => b.contracts - a.contracts).map((seller) => {
          const sellerResolved = seller.presented + seller.noShows;
          return <div className="data-row" key={seller.name}><b>{seller.name}</b><strong>{seller.appointments}</strong><span>{seller.presented}</span><span className={sellerResolved && seller.presented / sellerResolved >= .7 ? "good" : ""}>{percentage(seller.presented, sellerResolved)}</span><strong>{seller.contracts}</strong><span>{percentage(seller.contracts, seller.appointments)}</span></div>;
        })}
      </div>
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
  const previousMonth = effectiveMonth === 1 ? 12 : effectiveMonth - 1;
  const previousMonthYear = effectiveMonth === 1 ? effectiveYear - 1 : effectiveYear;
  const currentMonthCount = sellerBase.filter((item) => item.year === effectiveYear && item.month === effectiveMonth).length;
  const previousMonthCount = sellerBase.filter((item) => item.year === previousMonthYear && item.month === previousMonth).length;
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
      <div className="metrics-grid">
        <Metric label="Contratti" value={filtered.length} primary={`${filtered.filter((item) => item.company === "Car One").length} Car One`} secondary={`${filtered.filter((item) => item.company === "AD Motor").length} AD Motor`} />
        <Metric label="Media mensile" value={activeMonths ? formatNumber(filtered.length / activeMonths) : "—"} primary={`${activeMonths} mesi attivi`} secondary="nel periodo filtrato" />
        <Metric label="Top venditore" value={topSeller?.[0] ?? "—"} primary={topSeller ? `${topSeller[1]} contratti` : "Nessun dato"} secondary="nel periodo filtrato" />
        <Metric label="Prima origine" value={topOrigin?.[0] ?? "—"} primary={topOrigin ? `${topOrigin[1]} contratti` : "Nessun dato"} secondary="origine normalizzata" />
      </div>
      <div className="comparison-strip">
        <div><span>{effectiveYear} vs {effectiveYear - 1}{effectiveYear === currentDate.getFullYear() ? " · stesso periodo" : ""}</span><strong className={currentYearCount >= previousYearCount ? "positive" : "negative"}>{delta(currentYearCount, previousYearCount)}</strong><small>{currentYearCount} vs {previousYearCount} contratti</small></div>
        <div><span>{MONTHS[effectiveMonth - 1]} vs {MONTHS[previousMonth - 1]}</span><strong className={currentMonthCount >= previousMonthCount ? "positive" : "negative"}>{delta(currentMonthCount, previousMonthCount)}</strong><small>{currentMonthCount} vs {previousMonthCount} contratti</small></div>
      </div>
      <div className="history-grid">
        <section className="panel"><header><div><h3>Contratti per anno</h3><p>Andamento storico Car One + AD Motor</p></div><TrendingUp size={19} /></header><BarList rows={byYear} /></section>
        <section className="panel"><header><div><h3>Andamento mensile</h3><p>Stagionalità nel periodo selezionato</p></div><BarChart3 size={19} /></header><BarList rows={byMonth} /></section>
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
    <section className="content">{section === "dashboard" ? <Dashboard payload={payload} period={period} setPeriod={setPeriod} /> : section === "channels" ? <ChannelsView payload={payload} /> : section === "sources" ? <SourcesView payload={payload} /> : section === "quotes" ? <QuotesView payload={payload} /> : section === "contracts" ? <ContractsView payload={payload} /> : section === "sellers" ? <SellersView payload={payload} /> : <Placeholder section={section} />}</section>
  </main>;
}
