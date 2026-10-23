"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Plus, SlidersHorizontal, Sparkles, Square } from "lucide-react";
import type { AssistantQuery, AssistantResult, QueryKind } from "@/lib/assistant/schema";
import type { AssistantPresentation } from "@/lib/assistant/summary";

type Answer=AssistantResult&{resultId:string;definition:string;summary:string;filters:string;engine?:"local"|"gemini";presentation?:AssistantPresentation};
type Turn={id:number;question:string;answer?:Answer;error?:string};
const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date());
const period=(q:AssistantQuery)=>{const format=(s:string)=>new Intl.DateTimeFormat("it-IT",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z"));return q.from===q.to?format(q.from):`${format(q.from)} – ${format(q.to)}`;};

function ResultDetails({answer}:{answer:Answer}){
  const [page,setPage]=useState(0);
  return <div className="chat-evidence">
    <details><summary>Fonti e criteri</summary>
      <dl><dt>Periodo</dt><dd>{period(answer.query)}, estremi inclusi · Europe/Rome</dd><dt>Filtri</dt><dd>{answer.filters}</dd><dt>Cosa stiamo contando</dt><dd>{answer.definition}</dd><dt>Aggiornamento</dt><dd>Fonti lette il {new Date(answer.generatedAt).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}. Cache fino a 120 secondi; non è l’ultima modifica dell’operatore.</dd></dl>
      {answer.sources.map((s,i)=><article className="chat-source" key={i}><strong>{s.name}</strong><span>{s.status==="available"?"Disponibile":s.status==="partial"?"Parziale":"Non disponibile"} · {s.coverage}</span><small>Lettura: {new Date(s.readAt).toLocaleString("it-IT",{timeZone:"Europe/Rome"})}</small>{s.issues.length>0&&<ul>{s.issues.map((v,j)=><li key={j}>{v}</li>)}</ul>}</article>)}
      <small>{answer.engine==="gemini"?"Domanda interpretata da Gemini":"Interrogazione locale, senza chiamate AI"}. Risultato {answer.resultId}.</small>
    </details>
    {answer.rows.length>0&&<details><summary>Apri i record ({answer.rows.length})</summary>
      <p className="chat-fineprint">I link richiedono l’accesso alle fonti Google. I riferimenti di riga valgono al momento della lettura: ordinamenti successivi possono spostarli.</p>
      <div className="chat-table"><table><thead><tr><th>Data</th><th>Categoria</th><th>Venditore</th><th>Valore</th>{["contracts","lead-contracts"].includes(answer.query.kind)&&<th>Origine</th>}{answer.query.kind==="lead-quality"&&<><th>In scadenza</th><th>Feedback</th></>}<th>Record</th></tr></thead><tbody>{answer.rows.slice(page*25,(page+1)*25).map((r,i)=><tr key={r.evidence.locatorId+":"+i}><td>{r.date}</td><td>{r.category}</td><td>{r.seller}</td><td>{r.value}</td>{["contracts","lead-contracts"].includes(answer.query.kind)&&<td>{r.origin||"Non indicata"}</td>}{answer.query.kind==="lead-quality"&&<><td>{r.due}</td><td>{r.managed}</td></>}<td><a href={r.evidence.url} target="_blank" rel="noreferrer">Apri ↗</a></td></tr>)}</tbody></table></div>
      <div className="chat-pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Precedenti</button><span>{page+1} / {Math.ceil(answer.rows.length/25)}</span><button disabled={(page+1)*25>=answer.rows.length} onClick={()=>setPage(p=>p+1)}>Successivi</button></div>
    </details>}
  </div>;
}

export function CarOneAssistant(){
  const [gemini,setGemini]=useState(false),[question,setQuestion]=useState("");
  const [turns,setTurns]=useState<Turn[]>([]),[loading,setLoading]=useState(false),[controls,setControls]=useState(false);
  const [kind,setKind]=useState<QueryKind>("contracts"),[from,setFrom]=useState("2025-01-01"),[to,setTo]=useState("2025-12-31");
  const abort=useRef<AbortController|null>(null),context=useRef<AssistantQuery|undefined>(undefined),busy=useRef(false),serial=useRef(0);
  const thread=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),lastTurn=useRef<HTMLElement|null>(null);
  useEffect(()=>{const c=new AbortController();void fetch("/api/assistant",{cache:"no-store",signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>setGemini(d?.gemini===true)).catch(()=>{});return()=>{c.abort();abort.current?.abort();};},[]);
  useEffect(()=>{lastTurn.current?.scrollIntoView({block:"start",behavior:"auto"});},[turns.length]);
  useEffect(()=>{if(input.current){input.current.style.height="auto";input.current.style.height=Math.min(input.current.scrollHeight,140)+"px";}},[question]);
  async function send(body:object,label:string){
    if(busy.current)return;busy.current=true;setLoading(true);setQuestion("");setControls(false);
    const id=++serial.current;setTurns(old=>[...old,{id,question:label}]);
    abort.current=new AbortController();
    try{
      const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:abort.current.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Non riesco a leggere i dati in questo momento.");
      context.current=data.query;setTurns(old=>old.map(t=>t.id===id?{...t,answer:data}:t));
    }catch(e){setTurns(old=>old.map(t=>t.id===id?{...t,error:e instanceof Error&&e.name==="AbortError"?"Richiesta interrotta. Puoi fare un’altra domanda.":e instanceof Error?e.message:"Risposta non disponibile."}:t));}
    finally{busy.current=false;setLoading(false);input.current?.focus();}
  }
  function ask(text:string){if(text.trim())void send({question:text,...(context.current?{context:context.current}:{})},text.trim());}
  const starters=[{label:"Contratti del 2025",text:"Quanti contratti abbiamo nel 2025?"},{label:"Contratti da lead",text:"Quanti contratti da lead abbiamo nel 2025?"},{label:"Agenda e richiami di oggi",text:`Mostrami gli appuntamenti e i preventivi da richiamare il ${today()}`}];
  return <section className="assistant-chat" aria-label="Chat Assistente Car One">
    <header className="chat-header"><div className="chat-identity"><span className="chat-mark"><Sparkles size={18}/></span><div><h1>Assistente Car One</h1><span><i/>Dati aziendali · sola lettura</span></div></div><button className="chat-reset" title="Inizia una nuova conversazione" aria-label="Nuova conversazione" disabled={loading||!turns.length} onClick={()=>{setTurns([]);context.current=undefined;setQuestion("");input.current?.focus();}}><Plus size={18}/><span>Nuova chat</span></button></header>
    <div className="chat-thread" ref={thread} role="log" aria-label="Conversazione" aria-live="polite" aria-relevant="additions text">
      {!turns.length&&<div className="chat-welcome"><span className="chat-welcome-mark"><Sparkles size={27}/></span><p className="chat-eyebrow">I NUMERI DI CAR ONE, IN UNA CONVERSAZIONE</p><h2>Da dove iniziamo?</h2><p>Chiedimi di contratti, appuntamenti e richiami.<br/>Ti aiuto a leggere i dati, una domanda alla volta.</p><div className="chat-starters">{starters.map(s=><button key={s.label} onClick={()=>ask(s.text)}>{s.label}<span>↗</span></button>)}</div><small>Storico contratti 2024–2026 · disponibilità indicata in ogni risposta</small></div>}
      {turns.map((turn,index)=><article className="chat-turn" key={turn.id} ref={index===turns.length-1?lastTurn:undefined}>
        <div className="chat-user"><span className="chat-sr-only">Tu: </span>{turn.question}</div>
        <div className="chat-response"><span className="chat-response-mark" aria-hidden="true"><Sparkles size={17}/></span><div className="chat-response-body">
          {!turn.answer&&!turn.error&&<p className="chat-thinking" role="status"><span/>Sto leggendo i dati…</p>}
          {turn.error&&<p className="chat-error">{turn.error}</p>}
          {turn.answer&&<><span className="chat-period">{period(turn.answer.query)}</span><h2>{turn.answer.presentation?.title||turn.answer.summary}</h2>{turn.answer.presentation&&<><p>{turn.answer.presentation.message}</p>{turn.answer.presentation.metrics.length>0&&<div className="chat-metrics">{turn.answer.presentation.metrics.map((m,i)=><div key={i}><strong>{m.value}</strong><span>{m.label}</span></div>)}</div>}{turn.answer.presentation.partial&&<p className="chat-partial">Dati parziali: questi valori riguardano solo i record validi letti. Controlla le esclusioni in “Fonti e criteri”.</p>}</>}<p className="chat-meta">Tutta l’azienda · {turn.answer.sources.length} fonti · lettura {new Date(turn.answer.generatedAt).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Rome"})}</p><ResultDetails answer={turn.answer}/></>}
        </div></div>
      </article>)}
      {turns.length>0&&!loading&&context.current&&["contracts","lead-contracts"].includes(context.current.kind)&&<div className="chat-followups"><button onClick={()=>ask("E nel 2024?")}>E nel 2024?</button><button onClick={()=>ask("E nel 2026?")}>E nel 2026?</button>{context.current.kind==="contracts"&&<button onClick={()=>ask("E quelli da lead?")}>E quelli da lead?</button>}</div>}
    </div>
    <div className="chat-bottom">
      {controls&&<div className="chat-options"><div><strong>Scegli i dati da interrogare</strong><button aria-label="Chiudi selezione periodo" onClick={()=>setControls(false)}>×</button></div><form onSubmit={e=>{e.preventDefault();void send({kind,from,to:kind==="agenda-quotes"?from:to},`${kind==="lead-contracts"?"Contratti da lead":kind==="contracts"?"Contratti":kind==="agenda-quotes"?"Agenda e richiami":"Feedback al controllo serale"} · ${from}${kind!=="agenda-quotes"?" — "+to:""}`);}}><label>Indicatore<select value={kind} onChange={e=>setKind(e.target.value as QueryKind)}><option value="contracts">Contratti</option><option value="lead-contracts">Contratti da lead</option><option value="agenda-quotes">Agenda e richiami</option><option value="lead-quality">Feedback al controllo serale</option></select></label><label>Dal<input type="date" value={from} onChange={e=>setFrom(e.target.value)} required/></label>{kind!=="agenda-quotes"&&<label>Al<input type="date" value={to} onChange={e=>setTo(e.target.value)} required/></label>}<button type="submit" disabled={loading}>Mostra dati</button></form><p>Numeri e tabelle vengono dalle funzioni del CRM. {gemini?"Le domande non riconosciute localmente possono essere inviate a Google Gemini, insieme all’ultimo indicatore e periodo. Nessun elenco clienti viene inviato.":"Gemini non attivo: puoi usare le domande suggerite e questi controlli."}</p></div>}
      <form className="chat-composer" onSubmit={e=>{e.preventDefault();ask(question);}}><label className="chat-sr-only" htmlFor="car-one-chat-input">Scrivi una domanda</label><textarea id="car-one-chat-input" ref={input} value={question} maxLength={600} rows={1} placeholder={turns.length?"Fai un’altra domanda…":"Chiedi qualcosa sui dati di Car One…"} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!loading)ask(question);}}}/><div className="chat-composer-actions"><button type="button" className={controls?"chat-options-toggle active":"chat-options-toggle"} aria-expanded={controls} onClick={()=>setControls(v=>!v)}><SlidersHorizontal size={16}/><span>Periodo e indicatori</span></button>{loading?<button type="button" className="chat-send" aria-label="Interrompi risposta" onClick={()=>abort.current?.abort()}><Square size={15} fill="currentColor"/></button>:<button className="chat-send" type="submit" aria-label="Invia domanda" disabled={!question.trim()}><ArrowUp size={20}/></button>}</div></form>
      <p className="chat-disclaimer">Controlla sempre periodo e fonti. Non inserire nomi clienti o dati personali. <span>La chat resta in memoria finché questa sezione è aperta.</span></p>
    </div>
  </section>;
}
