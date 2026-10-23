"use client";
import { useEffect, useRef, useState } from "react";
import type { AssistantResult, QueryKind } from "@/lib/assistant/schema";

type Answer = AssistantResult & {resultId:string;definition:string;summary:string;filters:string;engine?:"local"|"gemini"};
const quick = [
  "Quanti contratti abbiamo nel 2025 divisi tra Car One e AD Motor?",
  "Quanti contratti abbiamo nel 2024 divisi tra Car One e AD Motor?",
  "Quanti contratti abbiamo dal 2026-01-01 al "+new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date())+"?",
  "Quanti contratti da lead abbiamo nel 2025?",
  "Mostrami gli appuntamenti e i preventivi da richiamare il "+new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date()),
  "Qual è la percentuale di lead gestiti il primo giorno dal 2026-10-01 al 2026-10-20?",
];
export function CarOneAssistant() {
  const [gemini,setGemini]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/assistant",{cache:"no-store",signal:controller.signal}).then(r=>r.ok?r.json():null).then(data=>setGemini(data?.gemini===true)).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  const [question,setQuestion]=useState("");
  const [kind,setKind]=useState<QueryKind>("contracts");
  const [from,setFrom]=useState("2025-01-01"),[to,setTo]=useState("2025-12-31");
  const [answer,setAnswer]=useState<Answer|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const [asked,setAsked]=useState("");const abort=useRef<AbortController|null>(null);
  const [page,setPage]=useState(0);
  async function send(body:object,label:string){
    if(loading)return;
    abort.current=new AbortController();setLoading(true);setError("");setAnswer(null);setAsked(label);setPage(0);
    try{
      const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:abort.current.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Risposta non disponibile");setAnswer(data);
    }catch(e){setError(e instanceof Error&&e.name==="AbortError"?"Richiesta interrotta.":e instanceof Error?e.message:"Risposta non disponibile");}
    finally{setLoading(false);}
  }
  return <main className="assistant-page">
    <header><span className="section-kicker">Prototipo in sola lettura</span><h1>Assistente Car One</h1><p>Interroga tutta l’azienda con funzioni controllate. {gemini?"Gemini è configurato per interpretare le domande: numeri e tabelle vengono dal backend.":"Gemini non attivo: usa le domande rapide o i controlli indicatore e periodo."}</p></header>
    <div className="assistant-quick">{quick.map(q=><button key={q} disabled={loading} onClick={()=>{setQuestion(q);void send({question:q},q);}}>{q}</button>)}</div>
    <form className="assistant-form" onSubmit={e=>{e.preventDefault();void send({question},question);}}>
      <label htmlFor="assistant-question">La tua domanda</label><textarea id="assistant-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={600} placeholder="Quanti contratti abbiamo nel 2025?" rows={3}/>
      <p className="assistant-hint">{gemini?"Le domande non riconosciute localmente vengono inviate a Google Gemini. Usa domande aggregate senza nomi clienti, recapiti, targhe o altri dati personali. Le query disponibili restano limitate agli indicatori qui sotto; nessuna memoria delle domande precedenti.":"Il prototipo riconosce le domande rapide e formulazioni simili con date esplicite. Per cambiare periodo usa i controlli qui sotto."}</p>
      <button disabled={loading||!question.trim()} type="submit">Invia domanda</button>
    </form>
    <details className="assistant-controls"><summary>Seleziona indicatore e periodo</summary><form onSubmit={e=>{e.preventDefault();void send({kind,from,to:kind==="agenda-quotes"?from:to},"Interrogazione da controlli");}}>
      <label>Indicatore<select value={kind} onChange={e=>setKind(e.target.value as QueryKind)}><option value="contracts">Contratti registrati</option><option value="lead-contracts">Contratti da lead (campo Origine)</option><option value="agenda-quotes">Appuntamenti e richiami</option><option value="lead-quality">Feedback al controllo serale</option></select></label>
      <label>Dal<input type="date" required value={from} onChange={e=>setFrom(e.target.value)}/></label>
      {kind!=="agenda-quotes"&&<label>Al<input type="date" required value={to} onChange={e=>setTo(e.target.value)}/></label>}
      <button disabled={loading}>Interroga dati</button>
    </form></details>
    <section aria-live="polite" aria-busy={loading} className="assistant-answer">
      {asked&&<p><strong>Domanda:</strong> {asked}</p>}
      {loading&&<p role="status">Lettura delle fonti in corso… <button onClick={()=>abort.current?.abort()}>Interrompi attesa</button></p>}
      {error&&<p role="alert">{error}</p>}
      {answer&&<>
        <h2>{answer.summary}</h2>
        <p>{answer.engine==="gemini"?"Domanda interpretata da Gemini. Controlla periodo e filtri applicati qui sotto.":"Interrogazione locale, senza chiamate AI."} Riepilogo e numeri calcolati dal backend.</p>
        <dl><dt>Periodo</dt><dd>{answer.query.from} — {answer.query.to}, estremi inclusi</dd><dt>Filtri</dt><dd>{answer.filters}</dd><dt>Definizione</dt><dd>{answer.definition}</dd><dt>Lettura delle fonti</dt><dd>{new Date(answer.generatedAt).toLocaleString("it-IT",{timeZone:"Europe/Rome"})} · cache fino a 120 secondi. Non indica quando l’operatore ha aggiornato il foglio.</dd></dl>
        <div className="assistant-sources">{answer.sources.map((s,i)=><article key={i}><strong>{s.name}</strong><p>{s.status==="available"?"Fonte letta":s.status==="partial"?"Dati parziali":"Fonte non disponibile"} · {s.coverage}</p><small>Lettura: {new Date(s.readAt).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}</small>{s.issues.length>0&&<ul>{s.issues.map((v,j)=><li key={j}>{v}</li>)}</ul>}</article>)}</div>
        {answer.rows.length>0&&<><p>{answer.rows.length} record validi restituiti. I riferimenti indicano la riga alla lettura: ordinamenti successivi del foglio possono spostarla.</p><div className="assistant-table"><table><thead><tr><th>Data</th><th>Categoria</th><th>Venditore</th><th>Valore</th>{["contracts","lead-contracts"].includes(answer.query.kind)&&<th>Origine registrata</th>}{answer.query.kind==="lead-quality"&&<><th>In scadenza</th><th>Feedback</th></>}<th>Fonte</th></tr></thead><tbody>{answer.rows.slice(page*50,(page+1)*50).map((r,i)=><tr key={r.evidence.locatorId+":"+i}><td>{r.date}</td><td>{r.category}</td><td>{r.seller}</td><td>{r.value}</td>{["contracts","lead-contracts"].includes(answer.query.kind)&&<td>{r.origin||"Non indicata"}</td>}{answer.query.kind==="lead-quality"&&<><td>{r.due}</td><td>{r.managed}</td></>}<td><a href={r.evidence.url} target="_blank" rel="noreferrer">Apri record</a></td></tr>)}</tbody></table></div><div className="assistant-pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Precedenti</button><span>Pagina {page+1} di {Math.ceil(answer.rows.length/50)}</span><button disabled={(page+1)*50>=answer.rows.length} onClick={()=>setPage(p=>p+1)}>Successivi</button></div></>}
        <small>Risultato {answer.resultId}. I link richiedono anche l’accesso alle fonti Google.</small>
      </>}
    </section>
  </main>;
}
