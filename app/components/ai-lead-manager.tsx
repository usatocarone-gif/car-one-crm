"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, CheckCircle2, CircleAlert, Users } from "lucide-react";
import type { DashboardPayload, LeadItem } from "@/lib/types";
import { LEAD_MANAGER_SELLERS } from "@/lib/lead-manager/config";
import { calculateLeadScore, getLeadOperationalStatus, getNextLeadAction, type LeadTemperature } from "@/lib/lead-manager/scoring";

type FilterKey = "all" | "hot" | "warm" | "cold" | "unmanaged" | "managed";

type ScoredLead = LeadItem & ReturnType<typeof calculateLeadScore> & {
  operationalStatus: ReturnType<typeof getLeadOperationalStatus>;
  nextAction: ReturnType<typeof getNextLeadAction>;
};

const PAGE_SIZE = 50;
const FILTER_OPTIONS: Array<[FilterKey, string]> = [
  ["all", "Tutti"],
  ["hot", "Caldi"],
  ["warm", "Tiepidi"],
  ["cold", "Freddi"],
  ["unmanaged", "Da lavorare"],
  ["managed", "Lavorati"],
];

function sameDay(date: Date, comparison: Date) {
  return date.getFullYear() === comparison.getFullYear()
    && date.getMonth() === comparison.getMonth()
    && date.getDate() === comparison.getDate();
}

function formatPercentage(value: number, total: number) {
  return total ? `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(value / total * 100)}%` : "—";
}

function temperatureClass(temperature: LeadTemperature) {
  if (temperature === "CALDO") return "hot";
  if (temperature === "TIEPIDO") return "warm";
  return "cold";
}

function displayZone(lead: LeadItem) {
  const area = [lead.city, lead.province].filter((value) => value && value !== "Da classificare" && value !== "Non indicata");
  return area.length ? area.join(" · ") : "Non disponibile";
}

function AiMetric({ label, value, detail, tone }: { label: string; value: number | string; detail: string; tone?: string }) {
  return <article className={`metric-card ai-metric ${tone ?? ""}`}><span>{label}</span><strong>{value}</strong><footer><small>{detail}</small></footer></article>;
}

export function AILeadManagerView({ payload }: { payload: DashboardPayload }) {
  const leadItems = payload.leadItems;
  const anchorDate = useMemo(() => {
    const parsed = new Date(payload.lastUpdated);
    return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
  }, [payload.lastUpdated]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [seller, setSeller] = useState("all");
  const [page, setPage] = useState(1);

  const scoredLeads = useMemo<ScoredLead[]>(() => (leadItems ?? [])
    .filter((lead) => lead.year === anchorDate.getFullYear() && lead.month === anchorDate.getMonth() + 1)
    .map((lead) => {
      const result = calculateLeadScore(lead);
      return { ...lead, ...result, operationalStatus: getLeadOperationalStatus(lead), nextAction: getNextLeadAction(lead) };
    })
    .sort((a, b) => b.score - a.score || new Date(b.date).valueOf() - new Date(a.date).valueOf()), [leadItems, anchorDate]);

  const filteredLeads = scoredLeads.filter((lead) => {
    if (seller !== "all" && lead.seller !== seller) return false;
    if (filter === "hot" && lead.temperature !== "CALDO") return false;
    if (filter === "warm" && lead.temperature !== "TIEPIDO") return false;
    if (filter === "cold" && lead.temperature !== "FREDDO") return false;
    if (filter === "unmanaged" && lead.managed) return false;
    if (filter === "managed" && !lead.managed) return false;
    return true;
  });

  const pageCount = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleLeads = filteredLeads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const todayLeads = scoredLeads.filter((lead) => sameDay(new Date(lead.date), anchorDate)).length;
  const worked = scoredLeads.filter((lead) => lead.managed).length;
  const unmanaged = scoredLeads.length - worked;
  const hot = scoredLeads.filter((lead) => lead.temperature === "CALDO").length;
  const warm = scoredLeads.filter((lead) => lead.temperature === "TIEPIDO").length;
  const cold = scoredLeads.filter((lead) => lead.temperature === "FREDDO").length;
  const appointments = scoredLeads.reduce((total, lead) => total + (lead.appointmentCount ?? (lead.appointment ? 1 : 0)), 0);
  const resetPage = () => setPage(1);

  return <>
    <header className="page-head"><div><p className="eyebrow">Controllo operativo</p><h1>AI Lead Manager</h1><span>Scoring deterministico, prossima azione ed esecuzione venditori · appuntamenti solo da Google Calendar</span></div></header>
    {leadItems === undefined ? <section className="placeholder compact"><BrainCircuit size={32} /><h2>Dati operativi dettagliati non disponibili</h2><p>La pagina è pronta, ma l&apos;API attuale espone soltanto aggregati. Pubblica la nuova versione dell&apos;Apps Script per caricare le righe lead reali.</p></section> : <>
      <div className="metrics-grid ai-lead-kpis">
        <AiMetric label="Lead oggi" value={todayLeads} detail="entrati oggi" />
        <AiMetric label="Da lavorare" value={unmanaged} detail="feedback vuoto" tone="attention" />
        <AiMetric label="Lavorati" value={worked} detail={formatPercentage(worked, scoredLeads.length)} tone="managed" />
        <AiMetric label="Caldi" value={hot} detail="score 70–100" tone="hot" />
        <AiMetric label="Tiepidi" value={warm} detail="score 40–69" tone="warm" />
        <AiMetric label="Freddi" value={cold} detail="score 0–39" tone="cold" />
        <AiMetric label="Appuntamenti" value={appointments} detail="solo Google Calendar" />
      </div>

      <section className="filter-bar ai-lead-filters">
        <div className="ai-filter-buttons" aria-label="Filtra lead">
          {FILTER_OPTIONS.map(([key, label]) => <button key={key} className={filter === key ? "active" : ""} onClick={() => { setFilter(key); resetPage(); }}>{label}</button>)}
        </div>
        <label><span>Venditore</span><select value={seller} onChange={(event) => { setSeller(event.target.value); resetPage(); }}><option value="all">Tutti</option>{LEAD_MANAGER_SELLERS.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
      </section>

      <section className="panel table-panel ai-lead-table-panel">
        <header><div><h3>Lista operativa lead</h3><p>{filteredLeads.length} lead · ordinati per score e data più recente</p></div><BrainCircuit size={19} /></header>
        {visibleLeads.length ? <div className="data-table ai-lead-table">
          <div className="data-row data-head"><span>Cliente</span><span>Auto / interesse</span><span>Zona</span><span>Canale</span><span>Venditore</span><span>Score</span><span>Temperatura</span><span>Stato</span><span>Prossima azione</span></div>
          {visibleLeads.map((lead) => <div className="data-row" key={lead.id}>
            <div className="lead-client"><b>{lead.client || "Non disponibile"}</b><small>{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(lead.date))}</small></div>
            <span>{lead.interest || "Non disponibile"}</span>
            <span>{displayZone(lead)}</span>
            <span>{lead.channel || "Non indicata"}</span>
            <b>{lead.seller}</b>
            <div className="lead-score"><strong>{lead.score}</strong><small>{lead.reasons.length ? lead.reasons.join(" · ") : "nessun segnale valorizzato"}</small></div>
            <span><i className={`lead-badge temperature ${temperatureClass(lead.temperature)}`}>{lead.temperature}</i></span>
            <span><i className={`lead-badge status ${lead.managed ? "managed" : "unmanaged"}`}>{lead.operationalStatus}</i></span>
            <strong className="next-action">{lead.nextAction}</strong>
          </div>)}
        </div> : <div className="empty-compact"><CircleAlert size={20} />Nessun lead corrisponde ai filtri selezionati.</div>}
        {filteredLeads.length > PAGE_SIZE ? <footer className="table-pagination"><span>Pagina {safePage} di {pageCount}</span><div><button disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Precedente</button><button disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Successiva</button></div></footer> : null}
      </section>

      <section className="panel table-panel ai-seller-execution">
        <header><div><h3>Esecuzione Lead per Venditore</h3><p>Qualità del lead e qualità dell&apos;esecuzione restano indicatori distinti</p></div><Users size={19} /></header>
        <div className="data-table"><div className="data-row data-head"><span>Venditore</span><span>Lead assegnati</span><span>Lavorati</span><span>Non lavorati</span><span>% lavorazione</span><span>Appuntamenti</span></div>
          {LEAD_MANAGER_SELLERS.map((name) => {
            const assigned = scoredLeads.filter((lead) => lead.seller === name);
            const sellerWorked = assigned.filter((lead) => lead.managed).length;
            const sellerAppointments = assigned.reduce((total, lead) => total + (lead.appointmentCount ?? (lead.appointment ? 1 : 0)), 0);
            return <div className="data-row" key={name}><b>{name}</b><strong>{assigned.length}</strong><span>{sellerWorked}</span><strong className={assigned.length - sellerWorked ? "management-alert" : "good"}>{assigned.length - sellerWorked}</strong><strong>{formatPercentage(sellerWorked, assigned.length)}</strong><span>{sellerAppointments}</span></div>;
          })}
          <div className="data-row data-total"><b>TOTALE</b><strong>{scoredLeads.length}</strong><strong>{worked}</strong><strong>{unmanaged}</strong><strong>{formatPercentage(worked, scoredLeads.length)}</strong><strong>{appointments}</strong></div>
        </div>
        <div className="notice"><CheckCircle2 size={17} /><span>Appuntamenti e show provengono esclusivamente da Google Calendar. La percentuale di lavorazione misura invece se il venditore ha compilato il feedback.</span></div>
      </section>
    </>}
  </>;
}
