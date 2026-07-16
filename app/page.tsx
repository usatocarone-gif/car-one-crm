"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, CircleAlert, FileCheck2, Gauge, LayoutDashboard, RefreshCw, Target, TrendingUp, Users } from "lucide-react";
import type { ContractHistoryItem, DashboardPayload, DashboardPeriod, PeriodKey } from "@/lib/types";
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
  const ranked = [...payload.leadSources].sort((a, b) => b.leads - a.leads);
  const sourceMetric = (index: number) => ranked[index] ? <Metric label={index ? ranked[index].name : "Canale principale"} value={index ? ranked[index].leads : ranked[index].name} primary={percentage(ranked[index].leads, total)} secondary="del volume totale" /> : <Metric label="Canale" value="—" primary="Nessun dato" secondary="nel periodo" />;
  return <>
    <header className="page-head"><div><p className="eyebrow">Acquisizione</p><h1>Provenienza lead</h1><span>Mese corrente · Origine dal foglio Make Leads</span></div><div className="period-tabs"><button className="active">Mese</button></div></header>
    <div className="metrics-grid source-metrics">
      <Metric label="Lead analizzati" value={total} primary={`${payload.leadSources.length} canali`} secondary="mese corrente" />
      {sourceMetric(0)}{sourceMetric(1)}{sourceMetric(2)}
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
    <section className="content">{section === "dashboard" ? <Dashboard payload={payload} period={period} setPeriod={setPeriod} /> : section === "sources" ? <SourcesView payload={payload} /> : section === "contracts" ? <ContractsView payload={payload} /> : section === "sellers" ? <SellersView payload={payload} /> : <Placeholder section={section} />}</section>
  </main>;
}
