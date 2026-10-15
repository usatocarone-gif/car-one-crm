"use client";
import { useState } from "react";
import type { DashboardPayload } from "@/lib/types";
import { QUOTE_PRIORITY_LABEL, quotePriority, romeDate, type QuotePriority } from "@/lib/operational-quotes";

const order: QuotePriority[] = ["overdue", "today", "recent", "verify", "waiting", "scheduled", "closed"];
const dateLabel = (date: string | null) => date ? date.split("-").reverse().join("/") : "Non indicato";
export function OperationalQuotes({ payload }: { payload: DashboardPayload }) {
  const [seller, setSeller] = useState("all"), [query, setQuery] = useState(""), [filter, setFilter] = useState("action"), [page, setPage] = useState(1);
  const today = romeDate();
  const rows = (payload.operationalQuotes ?? []).map(item => ({ ...item, priority: quotePriority(item, today, payload.quoteCalendar) }));
  const scoped = rows.filter(item => (seller === "all" || item.seller === seller) && `${item.client} ${item.vehicle} ${item.note}`.toLocaleLowerCase("it").includes(query.toLocaleLowerCase("it")));
  const filtered = scoped.filter(item => filter === "all" || (filter === "action" ? ["overdue", "today", "recent", "verify"].includes(item.priority) : item.priority === filter)).sort((a,b) => order.indexOf(a.priority)-order.indexOf(b.priority) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, pages);
  const ready = payload.operationalQuotes !== undefined;
  return <section className="quote-operations">
    <header className="page-head"><div><p className="eyebrow">Controllo trattative</p><h1>Preventivi da seguire</h1><span>Stato, richiami e note dalle schede operative dei venditori.</span></div></header>
    {payload.operationalQuotesError && <p role="alert" className="quote-warning">{payload.operationalQuotesError}</p>}
    {!ready ? <div className="panel quote-empty">Collegamento alle schede operative non disponibile. Nessun conteggio viene stimato dallo storico.</div> : <>
      <div className="quote-summary" aria-label="Filtra per situazione">{(["overdue", "today", "verify", "scheduled"] as QuotePriority[]).map(key => <button key={key} className={`quote-counter ${key} ${filter === key ? "selected" : ""}`} aria-pressed={filter === key} onClick={() => { setFilter(key); setPage(1); }}><span>{QUOTE_PRIORITY_LABEL[key]}</span><strong>{scoped.filter(item => item.priority === key).length}</strong></button>)}</div>
      <div className="quote-toolbar"><label>Venditore<select value={seller} onChange={e => {setSeller(e.target.value);setPage(1);}}><option value="all">Tutti i venditori</option>{[...new Set(rows.map(item => item.seller))].sort().map(name => <option key={name}>{name}</option>)}</select></label><label>Cerca cliente o nota<input type="search" placeholder="Nome cliente, veicolo…" value={query} onChange={e => {setQuery(e.target.value);setPage(1);}} /></label><label>Situazione<select value={filter} onChange={e => {setFilter(e.target.value);setPage(1);}}><option value="action">Da seguire e verificare</option><option value="all">Tutti, compresi i chiusi</option>{order.map(key => <option key={key} value={key}>{QUOTE_PRIORITY_LABEL[key]}</option>)}</select></label></div>
      <p className="quote-caption">{filtered.length} preventivi · {payload.operationalQuotesUpdatedAt ? `Letti il ${new Date(payload.operationalQuotesUpdatedAt).toLocaleString("it-IT", {timeZone:"Europe/Rome"})}` : "Aggiornamento non disponibile"}</p>
      <div className="quote-table-wrap"><table className="quote-table"><thead><tr><th>Cliente / preventivo</th><th>Venditore</th><th>Situazione</th><th>Richiami</th><th>Nota del venditore</th><th><span className="sr-only">Apri scheda</span></th></tr></thead><tbody>{filtered.slice((currentPage-1)*20,currentPage*20).map(item => <tr key={item.id}><td><strong>{item.client || "Cliente non indicato"}</strong><small>{dateLabel(item.date)}{item.vehicle ? ` · ${item.vehicle}` : ""}</small></td><td>{item.seller}</td><td><span className={`quote-badge ${item.priority}`}>{QUOTE_PRIORITY_LABEL[item.priority]}</span><small>{item.status || "Stato non indicato"}</small></td><td><small>Ultimo: {dateLabel(item.lastFollowup)}</small><small>Prossimo: {dateLabel(item.nextFollowup)}</small></td><td className="quote-note">{item.note || "Nessuna nota"}</td><td><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Apri il preventivo di ${item.client}`}>Apri scheda ↗</a></td></tr>)}</tbody></table>{!filtered.length && <p className="quote-empty">Nessun preventivo corrisponde ai filtri selezionati.</p>}</div>
      <div className="quote-pagination"><button disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>Precedenti</button><span>Pagina {currentPage} di {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage+1)}>Successivi</button></div>
      <p className="quote-caption">Senza una data di richiamo non viene dedotta una telefonata. Soglia: 3 giorni lavorativi dal preventivo o dall’ultimo richiamo; un richiamo futuro rispetta la data programmata.</p>
    </>}
  </section>;
}
