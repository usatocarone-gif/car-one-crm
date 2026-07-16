"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, CircleAlert, FileCheck2, Gauge, LayoutDashboard, RefreshCw, Target, TrendingUp, Users } from "lucide-react";
import type { DashboardPayload, DashboardPeriod, PeriodKey } from "@/lib/types";
import { snapshot } from "@/lib/snapshot";

const menu = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "sources", label: "Provenienza lead", icon: TrendingUp },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
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

function SourcesView({ payload }: { payload: DashboardPayload }) {
  const total = payload.leadSources.reduce((sum, source) => sum + source.leads, 0);
  const leader = Math.max(...payload.leadSources.map((source) => source.leads));
  return <>
    <header className="page-head"><div><p className="eyebrow">Acquisizione</p><h1>Provenienza lead</h1><span>Luglio 2026 · Origine dal foglio Make Leads</span></div><div className="period-tabs"><button className="active">Mese</button></div></header>
    <div className="metrics-grid source-metrics">
      <Metric label="Lead analizzati" value={total} primary="3 canali" secondary="dati aggiornati al 15 luglio" />
      <Metric label="Canale principale" value="Facebook" primary={percentage(551, total)} secondary="del volume totale" />
      <Metric label="Instagram" value={199} primary={percentage(199, total)} secondary="lead del mese" />
      <Metric label="TikTok" value={50} primary={percentage(50, total)} secondary="lead del mese" />
    </div>
    <section className="panel table-panel">
      <header><div><h3>Performance per canale</h3><p>Volumi, peso e conversioni disponibili</p></div><TrendingUp size={19} /></header>
      <div className="data-table source-table">
        <div className="data-row data-head"><span>Canale</span><span>Lead</span><span>Peso</span><span>Lead → App.</span><span>Lead → Contratto</span></div>
        {payload.leadSources.map((source) => <div className="data-row" key={source.name}>
          <div className="source-name"><b>{source.name}</b><div className="track"><i style={{ width: `${source.leads / leader * 100}%` }} /></div></div>
          <strong>{source.leads}</strong><span>{percentage(source.leads, total)}</span>
          <span className="waiting">Da collegare</span><span className="waiting">Da collegare</span>
        </div>)}
      </div>
      <div className="notice"><CircleAlert size={17} /><span>Le colonne Show, Prev e Contratto del foglio lead sono ancora vuote. Le conversioni compariranno automaticamente quando il funnel sarà collegato.</span></div>
    </section>
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

function Placeholder({ section }: { section: string }) {
  const copy: Record<string, [string, string]> = {
    agenda: ["Agenda commerciale", "Vista giorno e settimana con presentati, no-show e appuntamenti da aggiornare."],
    contracts: ["Archivio contratti", "Vendite Car One e AD Motor filtrabili per venditore, origine, auto e periodo."],
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
    <section className="content">{section === "dashboard" ? <Dashboard payload={payload} period={period} setPeriod={setPeriod} /> : section === "sources" ? <SourcesView payload={payload} /> : section === "sellers" ? <SellersView payload={payload} /> : <Placeholder section={section} />}</section>
  </main>;
}
