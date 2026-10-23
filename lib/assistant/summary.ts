import { reasoningInsights, type ReasoningInsight } from "./insights";
import { presentAnalysis } from "./analytics";
import { presentVehicles } from "./vehicles";
import { isLeadContractOrigin } from "../contract-origin";
import type { AssistantResult } from "./schema";

export type AssistantBreakdown = {title:string;columns:string[];rows:string[][]};
export type AssistantPresentation = {insights?:ReasoningInsight[];tables?:AssistantBreakdown[];title:string;message:string;metrics:{label:string;value:string}[];partial:boolean};
export function presentResult(result:AssistantResult):AssistantPresentation {
  const view=presentBaseResult(result);
  return {...view,insights:reasoningInsights(result,view)};
}
function presentBaseResult(result:AssistantResult):AssistantPresentation {
  const partial=!result.sources.length||result.sources.some(s=>s.status!=="available");
  if(result.truncated)return {title:"Il periodo è troppo ampio",message:"Scegli un intervallo più breve per ottenere un totale verificabile.",metrics:[],partial:true};
  const analysis=presentAnalysis(result);if(analysis)return analysis;
  if(!result.rows.length)return {title:partial?"Non ho dati sufficienti":"Nessun risultato",message:partial?"Una parte delle fonti manca o non è completa. Non posso considerare il risultato pari a zero.":"Non risultano record nel periodo e nei filtri selezionati.",metrics:[],partial};
  if(result.query.kind==="vehicle-sales")return presentVehicles(result,partial);
  if(["leads","quotes","appointments","funnel","lead-management"].includes(result.query.kind))return presentCommercial(result,partial);
  if(result.query.kind==="lead-quality"){
    const observed=result.rows.filter(r=>r.measurement==="evening-observation");
    const due=observed.reduce((n,r)=>n+(r.due||0),0),managed=observed.reduce((n,r)=>n+(r.managed||0),0);
    return {title:due?`${(managed/due*100).toLocaleString("it-IT",{maximumFractionDigits:1})}% con feedback registrato`:"Percentuale non disponibile",message:"È il feedback presente al controllo serale. Non dimostra l’ora della prima chiamata né l’assenza di lavoro quando non è registrato.",metrics:[{label:"Feedback osservati",value:String(managed)},{label:"Lead in scadenza osservati",value:String(due)}],partial};
  }
  const counts=new Map<string,number>();for(const row of result.rows)counts.set(row.category,(counts.get(row.category)||0)+1);
  const metrics=Array.from(counts,([label,value])=>({label:label.replace("Contratti registrati · ","").replace("Registrazioni provvisorie · ","Provvisori · "),value:String(value)}));
  if(result.query.kind==="agenda-quotes")return {title:"Ecco la tua agenda",message:"Appuntamenti e richiami da verificare nelle schede qui sotto.",metrics,partial};
  const provisional=result.rows.some(r=>r.category.startsWith("Registrazioni provvisorie"));
  const title=partial?`${result.rows.length} registrazioni valide lette`:provisional?"Contratti e registrazioni provvisorie":`${result.rows.length} ${result.rows.length===1?"contratto":"contratti"}${result.query.kind==="lead-contracts"?" da lead":result.rows.length===1?" registrato":" registrati"}`;
  const months=[...new Set(result.rows.map(r=>r.date.slice(0,7)))].sort();
  const categories=[...counts.keys()];
  const tables=[{title:"Contratti per mese",columns:["Mese",...categories],rows:months.map(month=>[month,...categories.map(category=>String(result.rows.filter(r=>r.date.startsWith(month)&&r.category===category).length))])}];
  return {title,tables,message:provisional?"Lo storico e le registrazioni provvisorie del mese corrente sono mostrati separatamente.":result.query.kind==="lead-contracts"?"Classificati dal campo Origine, con la stessa regola del CRM.":"Registrazioni nel venduto ufficiale, divise tra Car One e AD Motor.",metrics,partial};
}

export const ANALYSIS_DEFINITIONS={
  "seller-ranking":"Classifica dei conteggi nel periodo per venditore associato al record. Parità conservate; record con venditore non riconosciuto dichiarati. Con fonti parziali riguarda solo le registrazioni lette. Per gli appuntamenti si usa la data evento e il venditore nel titolo, non chi ha effettuato la prenotazione.",
  "best-month":"Mese chiuso interamente incluso nel periodo con più registrazioni ufficiali lette. Parità mantenute; mese corrente, mesi tagliati e provvisori non partecipano al primo posto.",
  "period-comparison":"Conteggi di due intervalli distinti di uguale durata. Questa settimana: da lunedì a oggi contro lunedì allo stesso giorno della settimana precedente, Europe/Rome; oggi incompleto. Variazioni percentuali n.d. per base zero o fonti mancanti.",
  "lead-conversion":"Rapporto osservato di periodo: contratti con Origine lead riconosciuta / assegnazioni attualmente conservate nel foglio venditore per Data registrata. Non è conversione individuale o di coorte; lo storico delle assegnazioni non è certificato completo. Nessun miglior tasso certificato. Fonte, origine o venditore mancanti: tassi n.d.; denominatore zero: n.d.",
  "walkin-conversion":"Rapporto osservato di periodo: contratti con Origine esplicita walk-in / preventivi con Fonte esplicita walk-in. Non-lead non equivale a walk-in. Completezza storica dei preventivi non certificata, nessun vincitore. Non è conversione di coorte o individuale; il rapporto può superare il 100%. Attribuzioni mancanti o denominatore zero: n.d."
};

export const DEFINITIONS = {
  "vehicle-sales": "Stesse registrazioni valide dei contratti, con descrizione marca-modello del venduto. Marche classificate solo da prefissi espliciti (alias VW, Mercedes, Citroën), senza inferire segmenti, alimentazione, anno o chilometraggio. Prezzo di riferimento concordato per fasce, media e mediana: importi positivi validi del campo IMP. FATT. individuato dall’intestazione. Non è il fatturato totale o un dato di incasso. Importi mancanti e record provvisori con VAL. VENDITA / PROVVIGIONE esclusi dalle analisi degli importi, ma restano nel conteggio dei veicoli. Nessun dato della permuta attribuito al venduto. Valori letti, non obiettivi di prezzo.",
  leads: "Eventi lead ricevuti per data di arrivo Europe/Rome, da Foglio1, giuseppe lead e archivi mensili configurati. Timestamp ISO rigorosi; copie dello stesso evento escluse e dichiarate, nuove richieste distinte conservate. Mesi senza copertura e date invalide non diventano zero. Non sono persone uniche. L’ID può essere assente: il link riga non è un ID permanente.",
  quotes: "Righe valide datate del tab Preventivi, tutti i canali. Duplicati esatti esclusi. La presenza del foglio non certifica che contenga tutti i preventivi storici. Nessuna ricostruzione da un contratto o abbinamento nominativo. Non è lo stato dei richiami.",
  appointments: "Eventi APP dei due calendari nella data dell’appuntamento, deduplicati per ID e inizio. SI = presentato, NO = no-show; altri esiti restano da aggiornare. Show rate = SI / (SI + NO), senza i pendenti. I futuri sono programmati, non presenze effettive.",
  funnel: "Rapporti di periodo tra registrazioni lette: contratti con Origine lead riconosciuta / lead ricevuti; contratti / preventivi. Non sono conversioni di coorte né attribuzioni individuali. Origine applica la regola CRM, senza matching cliente. Le date misurano eventi diversi: arrivo lead, emissione preventivo, inizio appuntamento, registrazione contratto. Rapporti su dati parziali sono osservati e non certificano il totale; fonti mancanti o denominatore zero danno n.d. Mese corrente provvisorio separato nei record.",
  "lead-management": "Assegnazioni nei sei fogli venditori per data di ingresso, con feedback presente alla lettura. Non sono persone uniche né una ricostruzione dello stato passato: gli esiti possono essere stati aggiornati in seguito. Senza feedback non dimostra assenza di lavoro. Duplicati della stessa assegnazione esclusi. Non certifica il primo contatto o lo SLA del primo giorno.",
  contracts: "Mesi chiusi: registrazioni nel venduto ufficiale, alla data della riga. Mese corrente: registrazioni provvisorie in PROIEZ. REDDITIVITA', con data valida non futura. Le due categorie restano separate. Non sono consegne o fatturato fiscale. Duplicati sospetti esclusi e segnalati.",
  "lead-contracts": "Contratti da lead secondo il campo Origine, come nella vista Contratti del CRM: contiene lead, social, facebook, instagram, tiktok, sito, autoscout, a24 o bdc, senza distinzione maiuscole/minuscole. Nessun abbinamento per cliente. Mesi chiusi: venduto ufficiale; mese corrente: registrazioni provvisorie non future, separate. Origine mancante esclusa e segnalata. Non è il tasso di conversione di una coorte di lead.",
  "agenda-quotes": "Appuntamenti: eventi APP della giornata nei due calendari, deduplicati per ID evento e inizio. Richiami: situazione attuale dei preventivi aperti scaduti o dovuti alla data selezionata, secondo calendario operativo e regola dei tre giorni lavorativi. Non ricostruisce lo stato storico dei preventivi.",
  "lead-quality": "Somma feedback registrati al controllo serale / somma lead in scadenza, solo osservazioni effettive. Le ricostruzioni sono separate ed escluse dal tasso. Assenza di feedback non dimostra assenza di attività; il controllo non prova l'ora del primo contatto.",
};
export function summarize(result: AssistantResult) {
  if (result.truncated) return "Risultato troppo ampio: restringi il periodo. Nessun totale certificabile.";
  const analysis=presentAnalysis(result);if(analysis)return analysis.title+". "+analysis.message;
  const byCategory = new Map<string, number>();
  for (const row of result.rows) byCategory.set(row.category, (byCategory.get(row.category) || 0) + 1);
  const complete = result.sources.length > 0 && result.sources.every(s => s.status === "available");
  const prefix = complete ? "" : "Dati parziali o non disponibili: i valori riguardano soltanto i record validi letti. ";
  if(result.query.kind==="vehicle-sales"){const view=presentVehicles(result,!complete);return prefix+view.title+". "+view.message;}
  if (["leads","quotes","appointments","funnel","lead-management"].includes(result.query.kind)) {
    const view=presentCommercial(result,!complete);return prefix+view.title+". "+view.message+" "+view.metrics.map(m=>m.label+": "+m.value).join("; ");
  }
  if (result.query.kind === "lead-quality") {
    const observed = result.rows.filter(r => r.measurement === "evening-observation");
    const due = observed.reduce((n, r) => n + (r.due || 0), 0);
    const managed = observed.reduce((n, r) => n + (r.managed || 0), 0);
    return prefix + (due ? `${managed} feedback registrati su ${due} lead in scadenza: ${(managed / due * 100).toLocaleString("it-IT", {maximumFractionDigits: 1})}%.` : "Percentuale non disponibile: nessun denominatore osservato valido.");
  }
  if (!result.rows.length) return prefix + (complete ? "Nessun record nel periodo e nei filtri indicati." : "Non è possibile concludere che il risultato sia zero.");
  return prefix + Array.from(byCategory, ([label, count]) => `${label}: ${count}`).join("; ") + ".";
}

function presentCommercial(result:AssistantResult,partial:boolean):AssistantPresentation {
  const rows=result.rows,kind=result.query.kind;
  const group=(title:string,column:string,key:(r:typeof rows[number])=>string):AssistantBreakdown=>{
    const counts=new Map<string,number>();for(const row of rows){const name=key(row);counts.set(name,(counts.get(name)||0)+1);}
    return {title,columns:[column,"Registrazioni"],rows:[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([name,count])=>[name,String(count)])};
  };
  const rate=(n:number,d:number)=>d?`${(n/d*100).toLocaleString("it-IT",{maximumFractionDigits:1})}% (${n}/${d})`:"n.d. (denominatore zero)";
  const missing=result.sources.some(s=>s.status==="unavailable");
  const provisional=rows.some(r=>r.category.startsWith("Registrazioni provvisorie"));
  if(kind==="leads"&&result.query.seller)return {title:`${rows.length.toLocaleString("it-IT")} assegnazioni lead lette · ${result.query.seller}`,message:"Registrazioni attualmente conservate nel foglio del venditore, filtrate per la data registrata nel periodo. La completezza storica e l’istante effettivo di assegnazione non sono certificati. Non equivale a lead gestiti o persone uniche.",metrics:[{label:"Assegnazioni valide lette",value:String(rows.length)}],partial,tables:[group("Assegnazioni per mese","Mese",r=>r.date.slice(0,7)),group("Assegnazioni per giorno","Giorno",r=>r.date)]};
  if(kind==="leads")return {title:`${rows.length.toLocaleString("it-IT")} ${partial?"lead validi letti":"lead ricevuti"}`,message:"Contati per data di arrivo, non per data di gestione. Ogni riga conserva il collegamento alla fonte.",metrics:[{label:"Primo arrivo nel periodo",value:[...rows].map(r=>r.date).sort()[0]||"n.d."},{label:"Ultimo arrivo nel periodo",value:[...rows].map(r=>r.date).sort().at(-1)||"n.d."}],partial,tables:[group("Lead per mese","Mese",r=>r.date.slice(0,7)),group("Lead per canale","Canale",r=>r.channel||"Non indicata"),group("Lead per giorno","Giorno",r=>r.date)]};
  if(kind==="quotes")return {title:`${rows.length} preventivi validi letti`,message:"Sono le registrazioni presenti nel tab Preventivi. La completezza dello storico non è certificata.",metrics:[],partial,tables:[group("Preventivi per mese","Mese",r=>r.date.slice(0,7))]};
  if(kind==="lead-management"){
    const feedback=rows.filter(r=>r.feedback).length;
    return {title:`${feedback} assegnazioni con feedback`,message:"Situazione attuale delle assegnazioni arrivate nel periodo. Un feedback può essere stato inserito successivamente; senza feedback non significa senza lavoro svolto.",metrics:[{label:"Assegnazioni lette",value:String(rows.length)},{label:"Senza feedback registrato",value:String(rows.length-feedback)},{label:"Feedback presente",value:missing?"n.d. (fonti mancanti)":rate(feedback,rows.length)}],partial};
  }
  if(kind==="appointments"){
    const shown=rows.filter(r=>r.status==="presented").length,no=rows.filter(r=>r.status==="no-show").length;
    return {title:`${rows.length} appuntamenti${partial?" validi letti":" in calendario"}`,message:"Conteggio alla data dell’appuntamento. Gli eventi futuri sono programmati; l’esito senza SI o NO rimane da aggiornare.",metrics:[{label:"Presentati (SI)",value:String(shown)},{label:"No-show (NO)",value:String(no)},{label:"Da aggiornare",value:String(rows.length-shown-no)},{label:"Show rate su esiti registrati",value:missing?"n.d. (fonti mancanti)":rate(shown,shown+no)}],partial,tables:[group("Appuntamenti per mese","Mese",r=>r.date.slice(0,7))]};
  }
  const leads=rows.filter(r=>r.metric==="lead"),quotes=rows.filter(r=>r.metric==="quote"),apps=rows.filter(r=>r.metric==="appointment"),contracts=rows.filter(r=>r.metric==="contract");
  const leadContracts=contracts.filter(r=>isLeadContractOrigin(r.origin||"")),unknownOrigins=contracts.filter(r=>!r.origin).length;
  const shown=apps.filter(r=>r.status==="presented").length,no=apps.filter(r=>r.status==="no-show").length;
  const unavailable="n.d. (fonti mancanti)",observed=partial?" osservato":"";
  const missingDataset=(dataset:string)=>{const sources=result.sources.filter(s=>s.dataset===dataset);return sources.length?sources.some(s=>s.status==="unavailable"):missing;};
  const missingLeads=missingDataset("leads"),missingQuotes=missingDataset("quotes"),missingApps=missingDataset("appointments"),missingContracts=missingDataset("contracts");
  const count=(n:number,absent:boolean)=>absent?(n?`${n} (subtotale)`:unavailable):String(n);
  return {title:"Ecco i numeri del periodo",message:"I rapporti confrontano gli eventi registrati nello stesso periodo: non attribuiscono contratti ai singoli lead né misurano una coorte."+(provisional?" I contratti includono registrazioni provvisorie del mese corrente, distinte nei record.":"")+(unknownOrigins?` ${unknownOrigins} contratti hanno Origine mancante: il rapporto da lead non è determinabile.`:""),metrics:[
    {label:"Lead ricevuti letti",value:count(leads.length,missingLeads)},{label:"Appuntamenti letti",value:count(apps.length,missingApps)},{label:"Preventivi letti",value:count(quotes.length,missingQuotes)},{label:"Contratti: ufficiali + eventuali provvisori",value:count(contracts.length,missingContracts)},{label:"Contratti con Origine lead riconosciuta",value:count(leadContracts.length,missingContracts)},
    {label:"Rapporto contratti da lead / lead ricevuti"+observed,value:missingContracts||missingLeads?unavailable:unknownOrigins?"n.d. (Origine mancante)":rate(leadContracts.length,leads.length)},
    {label:"Quota contratti con Origine lead",value:missingContracts?unavailable:unknownOrigins?"n.d. (Origine mancante)":rate(leadContracts.length,contracts.length)},
    {label:"Rapporto contratti / preventivi"+observed,value:missingContracts||missingQuotes?unavailable:rate(contracts.length,quotes.length)},
    {label:"Show rate su esiti registrati",value:missingApps?unavailable:rate(shown,shown+no)}
  ],partial};
}
