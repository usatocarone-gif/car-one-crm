"use client";

import { useState } from "react";
import type { LeadDailyQualityItem } from "@/lib/types";

export function LeadDailyQualityPanel({ items, error, year, month }: { items?: LeadDailyQualityItem[]; error?: string; year: string; month: string }) {
  const [day, setDay] = useState("latest");
  const observed = (items ?? []).filter(r => r.measurement === "evening-observation");
  const period = observed.filter(r => (year === "all" || r.date.startsWith(year + "-")) && (month === "all" || Number(r.date.slice(5, 7)) === Number(month)));
  const dates = [...new Set(period.map(r => r.date))].sort().reverse();
  const selected = day === "latest" ? dates[0] : day;
  const rows = day === "period" ? period : period.filter(r => r.date === selected);
  const totals = rows.reduce((s, r) => ({ due: s.due + r.due, managed: s.managed + r.managedWithinDay, missing: s.missing + r.missingAtDeadline }), { due: 0, managed: 0, missing: 0 });
  const rate = (managed: number, due: number) => due ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(managed / due * 100) + "%" : "n.d.";
  const sellerNames: Record<string, string> = { CAIRONI: "Francesco Caironi", MONACELLI: "Marcello Monacelli", LIGUORI: "Giuseppe Liguori", BORDINI: "Cristiano Bordini", GRANDOLINI: "Paolo Grandolini", PAGLIARA: "Giuseppe Pagliara" };
  const names = Object.keys(sellerNames);
  const sellers = names.map(seller => {
    const data = rows.filter(r => r.seller === seller);
    return { seller, name: sellerNames[seller], days: data.length, due: data.reduce((s,r) => s+r.due,0), managed: data.reduce((s,r) => s+r.managedWithinDay,0), missing: data.reduce((s,r) => s+r.missingAtDeadline,0) };
  }).sort((a,b) => (a.due ? a.managed/a.due : Infinity) - (b.due ? b.managed/b.due : Infinity));
  return <section className="panel lead-management-panel">
    <header><div><h3>Gestiti nel 1° giorno</h3><p>Feedback presente al controllo serale della prima scadenza utile</p></div></header>
    <div className="filter-bar"><label><span>Consuntivo</span><select value={day} onChange={e => setDay(e.target.value)}><option value="latest">Ultimo giorno disponibile{dates[0] ? ` · ${dates[0]}` : ""}</option><option value="period">Periodo selezionato</option>{dates.map(date => <option key={date} value={date}>{date}</option>)}</select></label></div>
    {error || items === undefined ? <div className="empty-compact">{error || "Storico della gestione nel primo giorno non ancora collegato."}</div> : !rows.length ? <div className="empty-compact">Consuntivo non disponibile per il giorno o periodo selezionato.</div> : <>
      {sellers.some(r => r.days < new Set(rows.map(x => x.date)).size) && <div className="notice"><span>Copertura parziale: il totale comprende soltanto i consuntivi disponibili. Le giornate mancanti non valgono zero.</span></div>}
      <div className="lead-management-summary">
        <article><span>Lead in scadenza</span><strong>{totals.due}</strong><small>{new Set(rows.map(r => r.date)).size} giorni osservati</small></article>
        <article><span>Gestiti nel 1° giorno</span><strong>{totals.managed}</strong><small>feedback al controllo serale</small></article>
        <article className="attention"><span>Senza feedback alla scadenza</span><strong>{totals.missing}</strong><small>i recuperi successivi non cambiano questo dato</small></article>
        <article><span>Gestione nel 1° giorno</span><strong>{rate(totals.managed, totals.due)}</strong><small>gestiti / totale in scadenza</small></article>
      </div>
      <div className="data-table lead-management-table"><div className="data-row data-head"><span>Venditore</span><span>In scadenza</span><span>Gestiti nel 1° giorno</span><span>Senza feedback</span><span>% nel 1° giorno</span><span>Giorni osservati</span><span>Copertura</span></div>
        {sellers.map(r => <div className="data-row" key={r.seller}><b>{r.name}</b><span>{r.days ? r.due : "n.d."}</span><span>{r.days ? r.managed : "n.d."}</span><span>{r.days ? r.missing : "n.d."}</span><strong>{rate(r.managed,r.due)}</strong><span>{r.days}</span><span>{r.days}/{new Set(rows.map(x=>x.date)).size} giorni disponibili</span></div>)}
      </div>
    </>}
    <div className="notice"><span>Controllo alle 19:05, con scadenza alle 19:00: misura il feedback documentato, non l’orario della telefonata. Dopo le 19:00 e nel weekend vale il prossimo giorno lavorativo. Filtri anno/mese sulla scadenza; canale e regione non si applicano. Storico osservato dal 13 ottobre 2026; nessuna ricostruzione inclusa.</span></div>
  </section>;
}
