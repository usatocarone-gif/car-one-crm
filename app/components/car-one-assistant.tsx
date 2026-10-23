"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Plus, SlidersHorizontal, Sparkles, Square, Mic, Volume2 } from "lucide-react";
import type { AssistantQuery, AssistantResult, QueryKind } from "@/lib/assistant/schema";
import { useAssistantVoice } from "./use-assistant-voice";
import type { AssistantPresentation } from "@/lib/assistant/summary";

type Answer=AssistantResult&{recordCount?:number;resultId:string;definition:string;summary:string;filters:string;engine?:"local"|"gemini";presentation?:AssistantPresentation};
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
    {answer.rows.length>0&&<details><summary>Apri i record ({answer.rows.length}{answer.recordCount&&answer.recordCount>answer.rows.length?` su ${answer.recordCount}`:""})</summary>
      <p className="chat-fineprint">{answer.recordCount&&answer.recordCount>answer.rows.length?`Mostro i primi ${answer.rows.length} record su ${answer.recordCount}. I totali sono calcolati dal backend su tutte le righe lette; restringi il periodo per trovare gli altri record. `:""}I link richiedono l’accesso alle fonti Google. I riferimenti di riga valgono al momento della lettura: ordinamenti successivi possono spostarli.</p>
      <div className="chat-table"><table><thead><tr><th>Data</th><th>Categoria</th><th>Arrivo / esito</th><th>Venditore</th><th>Valore</th>{answer.query.kind==="vehicle-sales"&&<><th>Veicolo</th><th>IMP. FATT.</th></>}{["contracts","lead-contracts"].includes(answer.query.kind)&&<th>Origine</th>}{answer.query.kind==="lead-quality"&&<><th>In scadenza</th><th>Feedback</th></>}<th>Record</th></tr></thead><tbody>{answer.rows.slice(page*25,(page+1)*25).map((r,i)=><tr key={r.evidence.locatorId+":"+i}><td>{r.date}</td><td>{r.category}</td><td>{r.arrivedAt?new Date(r.arrivedAt).toLocaleString("it-IT",{timeZone:"Europe/Rome"}):r.status==="presented"?"SI":r.status==="no-show"?"NO":r.status==="pending"?"Da aggiornare":r.metric==="management"?(r.feedback?"Con feedback":"Senza feedback"):"—"}{r.channel&&<small>{r.channel}</small>}</td><td>{r.seller}</td><td>{r.value}</td>{answer.query.kind==="vehicle-sales"&&<><td>{r.vehicle||"Non indicato"}</td><td>{r.invoiceAmount===undefined?"Non disponibile":r.invoiceAmount.toLocaleString("it-IT",{style:"currency",currency:"EUR"})}</td></>}{["contracts","lead-contracts"].includes(answer.query.kind)&&<td>{r.origin||"Non indicata"}</td>}{answer.query.kind==="lead-quality"&&<><td>{r.due}</td><td>{r.managed}</td></>}<td><a href={r.evidence.url} target="_blank" rel="noreferrer">Apri ↗</a></td></tr>)}</tbody></table></div>
      <div className="chat-pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Precedenti</button><span>{page+1} / {Math.ceil(answer.rows.length/25)}</span><button disabled={(page+1)*25>=answer.rows.length} onClick={()=>setPage(p=>p+1)}>Successivi</button></div>
    </details>}
  </div>;
}

export function CarOneAssistant(){
  const [gemini,setGemini]=useState(false),[question,setQuestion]=useState("");
  const [voiceHelp,setVoiceHelp]=useState(false);
  const voice=useAssistantVoice(setQuestion);
  const [turns,setTurns]=useState<Turn[]>([]),[loading,setLoading]=useState(false),[controls,setControls]=useState(false);
  const [kind,setKind]=useState<QueryKind>("contracts"),[from,setFrom]=useState("2025-01-01"),[to,setTo]=useState("2025-12-31");
  const abort=useRef<AbortController|null>(null),context=useRef<AssistantQuery|undefined>(undefined),busy=useRef(false),serial=useRef(0);
  const thread=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null),lastTurn=useRef<HTMLElement|null>(null);
  useEffect(()=>{const c=new AbortController();void fetch("/api/assistant",{cache:"no-store",signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>setGemini(d?.gemini===true)).catch(()=>{});return()=>{c.abort();abort.current?.abort();};},[]);
  useEffect(()=>{
    const shell=thread.current?.closest<HTMLElement>(".app-shell"),viewport=window.visualViewport;
    if(!shell||!viewport)return;
    const resize=()=>{if(viewport.scale===1)shell.style.setProperty("--assistant-viewport-height",`${Math.round(viewport.height)}px`);};
    resize();viewport.addEventListener("resize",resize);
    return()=>{viewport.removeEventListener("resize",resize);shell.style.removeProperty("--assistant-viewport-height");};
  },[]);
  useLayoutEffect(()=>{
    const scroller=thread.current,last=lastTurn.current;if(!scroller||!last)return;
    // Scroll only the transcript. scrollIntoView also moves page ancestors and the composer.
    scroller.scrollTop+=last.getBoundingClientRect().top-scroller.getBoundingClientRect().top-16;
  },[turns.length]);
  useLayoutEffect(()=>{if(input.current){input.current.style.height="auto";input.current.style.height=Math.min(input.current.scrollHeight,140)+"px";}},[question]);
  const pending=useRef<string|undefined>(undefined);
  async function send(body:object,label:string){
    if(busy.current||voice.listening)return;voice.stopReading();setVoiceHelp(false);busy.current=true;setLoading(true);setQuestion("");setControls(false);
    const id=++serial.current;setTurns(old=>[...old,{id,question:label}]);
    abort.current=new AbortController();
    try{
      const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:abort.current.signal});
      const data=await response.json();if(!response.ok){const sent=body as {question?:string};if(data.status==="needs-clarification"&&/Per quale periodo|Di quale anno/i.test(data.error||""))pending.current=sent.question;throw new Error(data.error||"Non riesco a leggere i dati in questo momento.");}
      context.current=data.query;setTurns(old=>old.map(t=>t.id===id?{...t,answer:data}:t));
    }catch(e){setTurns(old=>old.map(t=>t.id===id?{...t,error:e instanceof Error&&e.name==="AbortError"?"Richiesta interrotta. Puoi fare un’altra domanda.":e instanceof Error?e.message:"Risposta non disponibile."}:t));}
    finally{busy.current=false;setLoading(false);if(window.matchMedia("(pointer: fine)").matches)input.current?.focus({preventScroll:true});}
  }
  function ask(text:string){
    if(!text.trim())return;
    const answer=text.trim().replace(/[?!.]+$/,"");let question=text;
    if(pending.current&&/^(?:(?:nel|del|anno) )?20\d{2}$/i.test(answer)){
      const year=answer.match(/20\d{2}/)![0];
      question=pending.current.replace(/[?!.]+$/,"")+(/\b(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/i.test(pending.current)?" ":" nel ")+year;
    }
    if(pending.current&&/^(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre) 20\d{2}$/i.test(answer))question=pending.current.replace(/[?!.]+$/,"")+" a "+answer;
    pending.current=undefined;void send({question,...(context.current?{context:context.current}:{})},text.trim());
  }
  const starters=[{label:"Lead di questo mese",text:"Quanti lead abbiamo ricevuto questo mese?"},{label:"Funnel e rapporti",text:"Mostrami il funnel questo mese"},{label:"Agenda e richiami di oggi",text:`Mostrami gli appuntamenti e i preventivi da richiamare il ${today()}`}];
  return <section className="assistant-chat" aria-label="Chat Assistente Car One">
    <header className="chat-header"><div className="chat-identity"><span className="chat-mark"><Sparkles size={18}/></span><div><h1>Assistente Car One</h1><span><i/>Dati aziendali · sola lettura</span></div></div><button className="chat-reset" title="Inizia una nuova conversazione" aria-label="Nuova conversazione" disabled={loading||voice.listening||!turns.length} onClick={()=>{voice.cancelListening();voice.stopReading();setVoiceHelp(false);setTurns([]);context.current=undefined;pending.current=undefined;setQuestion("");input.current?.focus({preventScroll:true});}}><Plus size={18}/><span>Nuova chat</span></button></header>
    <div className="chat-thread" ref={thread} role="log" aria-label="Conversazione" aria-live="polite" aria-relevant="additions text">
      {!turns.length&&<div className="chat-welcome"><span className="chat-welcome-mark"><Sparkles size={27}/></span><p className="chat-eyebrow">I NUMERI DI CAR ONE, IN UNA CONVERSAZIONE</p><h2>Da dove iniziamo?</h2><p>Chiedimi di lead, appuntamenti, preventivi e contratti.<br/>Ti aiuto a leggere i dati, una domanda alla volta.</p><div className="chat-starters">{starters.map(s=><button key={s.label} disabled={voice.listening} onClick={()=>ask(s.text)}>{s.label}<span>↗</span></button>)}</div><small>Dati e copertura delle fonti indicati in ogni risposta</small></div>}
      {turns.map((turn,index)=><article className="chat-turn" key={turn.id} ref={index===turns.length-1?lastTurn:undefined}>
        <div className="chat-user"><span className="chat-sr-only">Tu: </span>{turn.question}</div>
        <div className="chat-response"><span className="chat-response-mark" aria-hidden="true"><Sparkles size={17}/></span><div className="chat-response-body">
          {!turn.answer&&!turn.error&&<p className="chat-thinking" role="status"><span/>Sto leggendo i dati…</p>}
          {turn.error&&<p className="chat-error">{turn.error}</p>}
          {turn.answer&&<><span className="chat-period">{period(turn.answer.query)}</span>{(turn.answer.query.seller||turn.answer.query.brand||turn.answer.query.model)&&<p className="chat-fineprint">Filtri: {[turn.answer.query.seller,turn.answer.query.brand,turn.answer.query.model].filter(Boolean).join(" · ")}</p>}<h2>{turn.answer.presentation?.title||turn.answer.summary}</h2>{turn.answer.presentation&&<><p>{turn.answer.presentation.message}</p>{turn.answer.presentation.metrics.length>0&&<div className="chat-metrics">{turn.answer.presentation.metrics.map((m,i)=><div key={i}><strong>{m.value}</strong><span>{m.label}</span></div>)}</div>}{turn.answer.presentation.partial&&<p className="chat-partial">Dati parziali: questi valori riguardano solo i record validi letti. Controlla le esclusioni in “Fonti e criteri”.</p>}</>}{turn.answer.presentation?.tables?.map(table=><details className="chat-breakdown" key={table.title}><summary>{table.title}</summary><div className="chat-table"><table><thead><tr>{table.columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{table.rows.map((row,i)=><tr key={i}>{row.map((value,j)=><td key={j}>{value}</td>)}</tr>)}</tbody></table></div></details>)}<p className="chat-meta">{turn.answer.query.seller||"Tutti i venditori"} · {turn.answer.sources.length} fonti · lettura {new Date(turn.answer.generatedAt).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Rome"})}</p>{voice.readAvailable&&<button type="button" className="chat-read" aria-pressed={voice.speaking===turn.id} onClick={()=>voice.read(turn.id,`${period(turn.answer!.query)}. ${turn.answer!.filters}. ${turn.answer!.presentation?`${turn.answer!.presentation.title}. ${turn.answer!.presentation.message}. ${turn.answer!.presentation.metrics.map(m=>`${m.label}: ${m.value}`).join(". ")}`:turn.answer!.summary}${turn.answer!.presentation?.partial?". Attenzione: dati parziali, solo record validi letti. Controlla le esclusioni in Fonti e criteri.":""}`)}>{voice.speaking===turn.id?<Square size={14}/>:<Volume2 size={15}/>} {voice.speaking===turn.id?"Ferma audio":"Leggi risposta"}</button>}<ResultDetails answer={turn.answer}/></>}
        </div></div>
      </article>)}
      {turns.length>0&&!loading&&context.current&&<div className="chat-followups"><button disabled={voice.listening} onClick={()=>ask("E nel 2024?")}>E nel 2024?</button><button disabled={voice.listening} onClick={()=>ask("E nel 2026?")}>E nel 2026?</button>{context.current.kind==="contracts"?<button disabled={voice.listening} onClick={()=>ask("E quelli da lead?")}>E quelli da lead?</button>:<button disabled={voice.listening} onClick={()=>ask(context.current?.kind==="leads"?"E le conversioni?":"E i lead?")}>{context.current.kind==="leads"?"E le conversioni?":"E i lead?"}</button>}</div>}
    </div>
    <div className="chat-bottom">
      {controls&&<div className="chat-options"><div><strong>Opzioni avanzate</strong><button aria-label="Chiudi opzioni avanzate" onClick={()=>setControls(false)}>×</button></div><form onSubmit={e=>{e.preventDefault();void send({kind,from,to:kind==="agenda-quotes"?from:to},`${kind==="lead-contracts"?"Contratti da lead":kind==="contracts"?"Contratti":kind==="agenda-quotes"?"Agenda e richiami":kind==="vehicle-sales"?"Veicoli venduti e importi fattura":kind==="leads"?"Lead ricevuti":kind==="quotes"?"Preventivi":kind==="appointments"?"Appuntamenti":kind==="funnel"?"Funnel":kind==="lead-management"?"Feedback attuale":"Feedback al controllo serale"} · ${from}${kind!=="agenda-quotes"?" — "+to:""}`);}}><label>Indicatore<select value={kind} onChange={e=>setKind(e.target.value as QueryKind)}><option value="vehicle-sales">Veicoli venduti e importi fattura</option><option value="leads">Lead ricevuti</option><option value="funnel">Funnel e rapporti di periodo</option><option value="quotes">Preventivi registrati</option><option value="appointments">Appuntamenti ed esiti</option><option value="lead-management">Feedback attuale sui lead</option><option value="contracts">Contratti</option><option value="lead-contracts">Contratti da lead</option><option value="agenda-quotes">Agenda e richiami</option><option value="lead-quality">Feedback al controllo serale</option></select></label><label>Dal<input type="date" value={from} onChange={e=>setFrom(e.target.value)} required/></label>{kind!=="agenda-quotes"&&<label>Al<input type="date" value={to} onChange={e=>setTo(e.target.value)} required/></label>}<button type="submit" disabled={loading||voice.listening}>Mostra dati</button></form><p>Numeri e tabelle vengono dalle funzioni del CRM. {gemini?"Le domande non riconosciute localmente possono essere inviate a Google Gemini, insieme all’ultimo indicatore, periodo e filtri. Nessun elenco clienti viene inviato.":"Gemini non attivo: puoi usare le domande suggerite e questi controlli."}</p></div>}
      {voiceHelp&&<div className="chat-voice-help"><strong>Detta la tua domanda</strong><p>Il browser può inviare l’audio al proprio servizio vocale. Non dettare nomi clienti o dati personali. Il CRM non salva registrazioni. Per leggere le risposte verrà usata la voce disponibile sul dispositivo, che può dipendere da un servizio online.</p><p>Il testo apparirà qui sotto: controllalo e premi Invia. L’ascolto termina dopo la domanda o quando premi Stop.</p><button type="button" onClick={()=>{setVoiceHelp(false);voice.startListening(question);}}>Attiva microfono</button><button type="button" onClick={()=>setVoiceHelp(false)}>Annulla</button></div>}
      {(voice.listening||voice.notice)&&<p className="chat-voice-status" role="status">{voice.listening?"Ti ascolto… Premi Stop quando hai finito, poi controlla il testo e invialo.":voice.notice}</p>}
      <form className="chat-composer" onSubmit={e=>{e.preventDefault();ask(question);}}><label className="chat-sr-only" htmlFor="car-one-chat-input">Scrivi una domanda</label><textarea id="car-one-chat-input" ref={input} value={question} maxLength={600} rows={1} readOnly={voice.listening} placeholder={turns.length?"Fai un’altra domanda…":"Chiedi qualcosa sui dati di Car One…"} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!loading&&!voice.listening)ask(question);}}}/><div className="chat-composer-actions"><button type="button" className={controls?"chat-options-toggle active":"chat-options-toggle"} aria-expanded={controls} onClick={()=>{setVoiceHelp(false);setControls(v=>!v);}}><SlidersHorizontal size={16}/><span>Opzioni avanzate</span></button><div className="chat-voice-actions"><button type="button" className={voice.listening?"chat-mic active":"chat-mic"} disabled={loading} aria-label={voice.listening?"Termina dettatura":"Detta una domanda"} aria-pressed={voice.listening} onClick={()=>{if(voice.listening)voice.stopListening();else if(!voice.available)voice.startListening(question);else {setControls(false);setVoiceHelp(v=>!v);}}}>{voice.listening?<Square size={16}/>:<Mic size={18}/>}</button>{loading?<button type="button" className="chat-send" aria-label="Interrompi risposta" onClick={()=>abort.current?.abort()}><Square size={15} fill="currentColor"/></button>:<button className="chat-send" type="submit" aria-label="Invia domanda" disabled={!question.trim()||voice.listening}><ArrowUp size={20}/></button>}</div></div></form>
      <p className="chat-disclaimer">Voce del browser: audio e testo da leggere possono essere elaborati da servizi online. <span>Controlla sempre periodo e fonti. Non inserire nomi clienti o dati personali.</span><span>La chat resta in memoria finché questa sezione è aperta.</span></p>
    </div>
  </section>;
}
