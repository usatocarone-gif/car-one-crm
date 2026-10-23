import type { AssistantResult } from "./schema";

export type AssistantPresentation = {title:string;message:string;metrics:{label:string;value:string}[];partial:boolean};
export function presentResult(result:AssistantResult):AssistantPresentation {
  const partial=!result.sources.length||result.sources.some(s=>s.status!=="available");
  if(result.truncated)return {title:"Il periodo è troppo ampio",message:"Scegli un intervallo più breve per ottenere un totale verificabile.",metrics:[],partial:true};
  if(!result.rows.length)return {title:partial?"Non ho dati sufficienti":"Nessun risultato",message:partial?"Una parte delle fonti manca o non è completa. Non posso considerare il risultato pari a zero.":"Non risultano record nel periodo e nei filtri selezionati.",metrics:[],partial};
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
  return {title,message:provisional?"Lo storico e le registrazioni provvisorie del mese corrente sono mostrati separatamente.":result.query.kind==="lead-contracts"?"Classificati dal campo Origine, con la stessa regola del CRM.":"Registrazioni nel venduto ufficiale, divise tra Car One e AD Motor.",metrics,partial};
}

export const DEFINITIONS = {
  contracts: "Mesi chiusi: registrazioni nel venduto ufficiale, alla data della riga. Mese corrente: registrazioni provvisorie in PROIEZ. REDDITIVITA', con data valida non futura. Le due categorie restano separate. Non sono consegne o fatturato fiscale. Duplicati sospetti esclusi e segnalati.",
  "lead-contracts": "Contratti da lead secondo il campo Origine, come nella vista Contratti del CRM: contiene lead, social, facebook, instagram, tiktok, sito, autoscout, a24 o bdc, senza distinzione maiuscole/minuscole. Nessun abbinamento per cliente. Mesi chiusi: venduto ufficiale; mese corrente: registrazioni provvisorie non future, separate. Origine mancante esclusa e segnalata. Non è il tasso di conversione di una coorte di lead.",
  "agenda-quotes": "Appuntamenti: eventi APP della giornata nei due calendari, deduplicati per ID evento e inizio. Richiami: situazione attuale dei preventivi aperti scaduti o dovuti alla data selezionata, secondo calendario operativo e regola dei tre giorni lavorativi. Non ricostruisce lo stato storico dei preventivi.",
  "lead-quality": "Somma feedback registrati al controllo serale / somma lead in scadenza, solo osservazioni effettive. Le ricostruzioni sono separate ed escluse dal tasso. Assenza di feedback non dimostra assenza di attività; il controllo non prova l'ora del primo contatto.",
};
export function summarize(result: AssistantResult) {
  if (result.truncated) return "Risultato troppo ampio: restringi il periodo. Nessun totale certificabile.";
  const byCategory = new Map<string, number>();
  for (const row of result.rows) byCategory.set(row.category, (byCategory.get(row.category) || 0) + 1);
  const complete = result.sources.length > 0 && result.sources.every(s => s.status === "available");
  const prefix = complete ? "" : "Dati parziali o non disponibili: i valori riguardano soltanto i record validi letti. ";
  if (result.query.kind === "lead-quality") {
    const observed = result.rows.filter(r => r.measurement === "evening-observation");
    const due = observed.reduce((n, r) => n + (r.due || 0), 0);
    const managed = observed.reduce((n, r) => n + (r.managed || 0), 0);
    return prefix + (due ? `${managed} feedback registrati su ${due} lead in scadenza: ${(managed / due * 100).toLocaleString("it-IT", {maximumFractionDigits: 1})}%.` : "Percentuale non disponibile: nessun denominatore osservato valido.");
  }
  if (!result.rows.length) return prefix + (complete ? "Nessun record nel periodo e nei filtri indicati." : "Non è possibile concludere che il risultato sia zero.");
  return prefix + Array.from(byCategory, ([label, count]) => `${label}: ${count}`).join("; ") + ".";
}
