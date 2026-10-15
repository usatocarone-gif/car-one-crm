"use client";

import type { DashboardPayload } from "@/lib/types";

export function DashboardLeadManagement({ payload, month, onOpen }: { payload: DashboardPayload; month: string; onOpen: () => void }) {
  const [year, monthNumber] = month.split("-").map(Number);
  const current = (payload.leadManagement ?? []).filter(r => r.year === year && r.month === monthNumber);
  const observed = (payload.leadDailyQuality ?? []).filter(r => r.measurement === "evening-observation" && r.date.startsWith(month));
  const names = ["Caironi", "Grandolini", "Liguori", "Monacelli", "Bordini", "Pagliara"];
  const rate = (managed: number, total: number) => total ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(managed / total * 100) + "%" : "n.d.";
  const total = current.reduce((s,r) => s+r.total,0), managed = current.reduce((s,r) => s+r.managed,0);
  const due = observed.reduce((s,r) => s+r.due,0), inTime = observed.reduce((s,r) => s+r.managedWithinDay,0);
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(year, monthNumber-1, 1));
  return <section className="panel dashboard-lead-management">
    <header><div><h3>Gestione lead</h3><p>{label} · situazione attuale e rispetto della prima scadenza</p></div><button className="lead-open-button" onClick={onOpen}>Apri gestione lead</button></header>
    <div className="lead-management-summary">
      <article><span>Lead con feedback</span><strong>{current.length ? managed : "n.d."}</strong><small>{current.length ? `su ${total} lead nei fogli venditori` : "Dati non disponibili"}</small></article>
      <article><span>Gestione attuale</span><strong>{rate(managed,total)}</strong><small>include i recuperi successivi</small></article>
      <article className="attention"><span>Ancora senza feedback</span><strong>{current.length ? current.reduce((s,r)=>s+r.unmanaged,0) : "n.d."}</strong><small>lead del mese selezionato</small></article>
      <article><span>Gestiti nel primo giorno</span><strong>{rate(inTime,due)}</strong><small>{observed.length ? `${inTime}/${due} nei giorni osservati` : "Consuntivo non disponibile"}</small></article>
    </div>
    <div className="dashboard-lead-table" role="table" aria-label="Gestione lead per venditore">
      <div className="dashboard-lead-row" role="row"><span role="columnheader">Venditore</span><span role="columnheader">Gestione attuale</span><span role="columnheader">Nel primo giorno</span></div>
      {names.map(name => { const a=current.filter(r=>r.seller.toLowerCase()===name.toLowerCase()), b=observed.filter(r=>r.seller.toLowerCase()===name.toLowerCase());return <div className="dashboard-lead-row" role="row" key={name}><b role="cell">{name}</b><span role="cell">{rate(a.reduce((s,r)=>s+r.managed,0),a.reduce((s,r)=>s+r.total,0))}</span><strong role="cell">{rate(b.reduce((s,r)=>s+r.managedWithinDay,0),b.reduce((s,r)=>s+r.due,0))}</strong></div>; })}
    </div>
    <p className="filter-scope-note">Attuale: feedback presente sui lead del mese. Primo giorno: feedback al controllo serale sui lead in scadenza; i recuperi tardivi non modificano questa percentuale.</p>
    {payload.leadDailyQualityError && <p className="filter-scope-note">{payload.leadDailyQualityError}</p>}
  </section>;
}
