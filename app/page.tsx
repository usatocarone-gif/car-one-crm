"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, CircleAlert, FileCheck2, Gauge, LayoutDashboard, RefreshCw, Target, Users } from "lucide-react";
import type { DashboardPayload, DashboardPeriod, PeriodKey } from "@/lib/types";

const menu = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "lead", label: "Lead", icon: Users },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "contracts", label: "Contratti", icon: FileCheck2 },
  { id: "sellers", label: "Venditori", icon: BarChart3 },
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
    ["Contratti", data.contracts, data.leads ? data.contracts / data.leads * 100 : 0],
  ] as const;
  return <section className="panel pipeline"><header><div><h3>Pipeline commerciale</h3><p>Volumi e conversioni del periodo</p></div><Gauge size={19} /></header>
    <div className="pipeline-list">{rows.map(([label, value, width]) => <div className="pipeline-row" key={label}><div><span>{label}</span><strong>{value}</strong></div><div className="track"><i style={{ width: `${Math.max(value ? 3 : 0, Math.min(100, width))}%` }} /></div><small>{label === "Lead" ? "Ingresso" : `${percentage(value, data.leads)} dei lead`}</small></div>)}</div>
  </section>;
}

function Dashboard({ payload, period, setPeriod }: { payload: DashboardPayload; period: PeriodKey; setPeriod: (period: PeriodKey) => void }) {
  const data = payload.periods[period];
  const resolved = data.presented + data.noShows;
  return <>
    <header className="page-head"><div><p className="eyebrow">Controllo commerciale</p><h1>Buongiorno, David</h1><span>{data.subtitle}</span></div><div className="period-tabs">{(["today", "week", "month"] as PeriodKey[]).map((key) => <button key={key} className={period === key ? "active" : ""} onClick={() => setPeriod(key)}>{payload.periods[key].label}</button>)}</div></header>
    <div className="metrics-grid">
      <Metric label="Lead" value={data.leads} primary={period === "today" ? "Nuovi oggi" : `${percentage(data.appointments, data.leads)} con appuntamento`} secondary="dal Foglio Google" />
      <Metric label="Appuntamenti" value={data.appointments} primary={`${data.pendingAppointments} senza esito`} secondary="Google Calendar" />
      <Metric label="Presentati" value={data.presented} primary={`${percentage(data.presented, resolved)} show rate`} secondary={`${data.noShows} no-show`} />
      <Metric label="Contratti" value={data.contracts} primary={`${data.carOneContracts} Car One`} secondary={`${data.adMotorContracts} AD Motor`} />
    </div>
    <div className="two-columns"><GoalPanel data={data} /><Pipeline data={data} /></div>
    <div className="two-columns lower">
      <section className="panel"><header><div><h3>Agenda di oggi</h3><p>Eventi APP dal calendario usato</p></div><CalendarDays size={19} /></header><div className="agenda-list">{payload.todayAgenda.length ? payload.todayAgenda.map((item) => <div className="agenda-item" key={item.id}><strong>{item.time}</strong><div><b>{item.seller}</b><span>Appuntamento showroom</span></div><em className={item.status}>{statusLabel(item.status)}</em></div>) : <div className="empty-compact">Nessun appuntamento in agenda.</div>}</div></section>
      <section className="panel"><header><div><h3>Performance venditori</h3><p>Contratti Car One + AD Motor</p></div><BarChart3 size={19} /></header><div className="seller-list">{data.sellers.length ? data.sellers.map((seller) => <div className="seller-row" key={seller.name}><div><b>{seller.name}</b><span>{seller.carOne} Car One · {seller.adMotor} AD</span></div><strong>{seller.contracts}</strong><div className="track"><i style={{ width: `${Math.max(8, seller.contracts / Math.max(...data.sellers.map((s) => s.contracts)) * 100)}%` }} /></div></div>) : <div className="empty-compact">I risultati venditore sono disponibili nelle viste settimanale e mensile.</div>}</div></section>
    </div>
  </>;
}

function Placeholder({ section }: { section: string }) {
  const copy: Record<string, [string, string]> = {
    lead: ["Lead Inbox", "Ricerca, assegnazione, stato, ultimo contatto e prossima attività."],
    agenda: ["Agenda commerciale", "Vista giorno e settimana con presentati, no-show e appuntamenti da aggiornare."],
    contracts: ["Archivio contratti", "Vendite Car One e AD Motor filtrabili per venditore, origine, auto e periodo."],
    sellers: ["Coaching venditori", "Obiettivi, conversioni, attività e opportunità aperte per ogni venditore."],
  };
  const [title, text] = copy[section];
  return <section className="placeholder"><CircleAlert size={30} /><h2>{title}</h2><p>{text}</p><span>Modulo previsto nella fase successiva dell’MVP.</span></section>;
}

export default function Home() {
  const [section, setSection] = useState("dashboard");
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    setPayload(await response.json());
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);
  const updated = useMemo(() => payload ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.lastUpdated)) : "", [payload]);

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><i /><div><strong>Car One CRM</strong><span>Usato · Perugia</span></div></div><nav>{menu.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}><Icon size={18} /><span>{label}</span></button>)}</nav><footer><CheckCircle2 size={15} /><div><strong>{payload?.source === "google-live" ? "Google live" : "Snapshot verificato"}</strong><span>{updated || "Caricamento…"}</span></div><button aria-label="Aggiorna dati" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /></button></footer></aside>
    <section className="content">{loading && !payload ? <div className="loading"><RefreshCw className="spin" /> Caricamento dashboard…</div> : payload && section === "dashboard" ? <Dashboard payload={payload} period={period} setPeriod={setPeriod} /> : <Placeholder section={section} />}</section>
  </main>;
}
