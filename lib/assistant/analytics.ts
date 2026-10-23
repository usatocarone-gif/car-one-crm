import { ASSISTANT_SELLERS, normalizedWords, type AssistantResult, type AssistantRow } from "./schema";
import { isLeadContractOrigin } from "../contract-origin";
import type { AssistantPresentation } from "./summary";

const sellerOf=(row:AssistantRow)=>ASSISTANT_SELLERS.find(s=>normalizedWords(row.seller).split(" ").includes(s));
const provisional=(r:AssistantRow)=>r.category.startsWith("Registrazioni provvisorie");
const walkin=(v:string)=>/^WALK[ -]?IN$/i.test(v.trim());
export function presentAnalysis(result:AssistantResult):AssistantPresentation|undefined {
  const {analysis}=result.query;if(!analysis)return undefined;
  const partial=result.sources.some(s=>s.status!=="available")||!result.sources.length;
  if(analysis==="seller-ranking"){
    const unknown=result.rows.filter(r=>!sellerOf(r)).length;
    const entries=ASSISTANT_SELLERS.map(s=>({seller:s,rows:result.rows.filter(r=>sellerOf(r)===s)})).filter(e=>e.rows.length).sort((a,b)=>b.rows.length-a.rows.length||a.seller.localeCompare(b.seller));
    const max=entries[0]?.rows.length||0,winners=entries.filter(e=>e.rows.length===max).map(e=>e.seller);
    const incomplete=partial||unknown>0;
    const label=result.query.kind==="appointments"?"appuntamenti":result.query.kind==="quotes"?"preventivi":result.query.kind==="lead-contracts"?"contratti da lead":"vendite";
    return {title:max?`${incomplete?"Più registrazioni lette":"Primo posto"}: ${winners.join(" e ")} · ${max} ${label}`:"Classifica non determinabile",message:(incomplete?"Classifica dei soli record attribuibili letti; fonti incomplete o venditore non riconosciuto non consentono di certificare il migliore. ":"Parità conservate. ")+(result.query.kind==="appointments"?"Sono appuntamenti alla data dell’evento e associati al venditore nel titolo; non identificano chi ha effettuato la prenotazione. ":"")+"Vendite ufficiali e provvisorie sono indicate separatamente."+(unknown?` ${unknown} record senza venditore riconosciuto sono esclusi dalla classifica.`:""),metrics:[],partial:incomplete,tables:[{title:`${label} per venditore`,columns:["Venditore","Totale letto","Ufficiali / altre registrazioni","Provvisori"],rows:entries.map(e=>[e.seller,String(e.rows.length),String(e.rows.filter(r=>!provisional(r)).length),String(e.rows.filter(provisional).length)])}]};
  }
  if(analysis==="best-month"){
    const monthNow=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date(result.generatedAt)).slice(0,7);
    const months=[...new Set(result.rows.map(r=>r.date.slice(0,7)))].sort();
    const entries=months.map(month=>{const rows=result.rows.filter(r=>r.date.startsWith(month));const last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);return {month,official:rows.filter(r=>!provisional(r)).length,prov:rows.filter(provisional).length,eligible:month<monthNow&&result.query.from<=month+"-01"&&result.query.to>=last};});
    const ranked=entries.filter(e=>e.eligible).sort((a,b)=>b.official-a.official),max=ranked[0]?.official||0;
    const winners=ranked.filter(e=>e.official===max).map(e=>e.month);
    return {title:max?`${partial?"Mese con più vendite ufficiali lette":"Mese migliore per vendite ufficiali"}: ${winners.join(" e ")} · ${max}`:"Mese migliore non determinabile",message:"Confronto fra mesi chiusi interamente inclusi nel periodo. Mese corrente e mesi tagliati non partecipano al primo posto; i provvisori restano separati. Parità conservate."+(partial?" Copertura parziale: il risultato riguarda solo i record letti.":""),metrics:[],partial,tables:[{title:"Vendite per mese",columns:["Mese","Ufficiali","Provvisori","Mese confrontabile"],rows:entries.map(e=>[e.month,String(e.official),String(e.prov),e.eligible?"Sì":"No"]) }]};
  }
  if(analysis==="period-comparison"){
    const current=result.rows.filter(r=>!r.comparisonPeriod),previous=result.rows.filter(r=>r.comparisonPeriod);
    const counts=(rows:AssistantRow[])=>result.query.kind==="funnel"?[
      ["Lead ricevuti",rows.filter(r=>r.metric==="lead").length],
      ["Preventivi",rows.filter(r=>r.metric==="quote").length],
      ["Appuntamenti",rows.filter(r=>r.metric==="appointment").length],
      ["Contratti ufficiali",rows.filter(r=>r.metric==="contract"&&!provisional(r)).length],
      ["Contratti provvisori",rows.filter(r=>r.metric==="contract"&&provisional(r)).length]
    ] as [string,number][]:[[({leads:result.query.seller?"Assegnazioni lead lette":"Lead ricevuti",contracts:"Contratti", "lead-contracts":"Contratti da lead", "vehicle-sales":"Veicoli",quotes:"Preventivi",appointments:"Appuntamenti"} as Record<string,string>)[result.query.kind]||result.query.kind,rows.length]] as [string,number][];
    const a=counts(current),b=counts(previous),percent=(n:number,d:number)=>!d?"n.d. (base zero)":`${((n-d)/d*100).toLocaleString("it-IT",{maximumFractionDigits:1})}%`;
    return {title:partial?"Confronto dei dati disponibili":"Confronto tra periodi",message:`${result.query.from} – ${result.query.to} rispetto a ${result.query.compareFrom} – ${result.query.compareTo}. Stesso numero di giorni di calendario; per questa settimana il confronto arriva allo stesso giorno della settimana scorsa. Il giorno corrente è ancora incompleto. I conteggi riguardano eventi con date diverse; non sono conversioni individuali.`+(partial?" Le variazioni sono osservate su fonti parziali e non certificano l’andamento complessivo.":""),metrics:[],partial,tables:[{title:"Periodo attuale e precedente",columns:["Indicatore","Attuale letto","Precedente letto","Differenza","Variazione osservata"],rows:a.map(([label,n],i)=>{
      const dataset=["leads","quotes","appointments","contracts","contracts"][i];
      const absent=(prefix:string)=>{const sources=result.sources.filter(s=>s.name.startsWith(prefix)&&(result.query.kind!=="funnel"||s.dataset===dataset));return !sources.length||sources.some(s=>s.status==="unavailable");};
      const missingCurrent=absent("Periodo attuale"),missingPrevious=absent("Periodo precedente");
      return [label,missingCurrent?(n?`${n} (subtotale)`:"n.d."):String(n),missingPrevious?(b[i][1]?`${b[i][1]} (subtotale)`:"n.d."):String(b[i][1]),missingCurrent||missingPrevious?"n.d.":String(n-b[i][1]),missingCurrent||missingPrevious?"n.d. (fonti mancanti)":percent(n,b[i][1])];
    })}]};
  }
  const lead=analysis==="lead-conversion";
  const contracts=result.rows.filter(r=>r.metric==="contract"),denominator=result.rows.filter(r=>r.metric===(lead?"management":"quote"));
  const unknownOrigins=contracts.filter(r=>!r.origin).length;
  const unknownChannels=lead?0:denominator.filter(r=>!r.channel||normalizedWords(r.channel)==="NON INDICATA").length;
  const numerator=contracts.filter(r=>lead?isLeadContractOrigin(r.origin||""):walkin(r.origin||""));
  const den=denominator.filter(r=>lead||walkin(r.channel||""));
  const unknownSeller=result.rows.some(r=>!sellerOf(r));
  const missing=result.sources.some(s=>s.status==="unavailable")||!result.sources.length;
  // Assignment history is not certified; quote history is explicitly partial in v53. Do not crown a winner.
  const rows=ASSISTANT_SELLERS.map(s=>{const n=numerator.filter(r=>sellerOf(r)===s).length,d=den.filter(r=>sellerOf(r)===s).length;return [s,String(n),String(d),d?`${(n/d*100).toLocaleString("it-IT",{maximumFractionDigits:1})}%`:"n.d. (denominatore zero)"];});
  return {title:"Miglior tasso non certificabile con queste fonti",message:(lead?"Rapporto osservato di periodo: contratti con Origine lead / assegnazioni conservate nel foglio del venditore, secondo le date registrate. Le assegnazioni storiche non sono certificate complete. ":"Rapporto osservato di periodo: contratti con Origine esplicita walk-in / preventivi con Fonte esplicita walk-in. Origine non lead non equivale a walk-in; lo storico preventivi non è certificato completo. ")+"Non è la conversione di una coorte o il collegamento dei singoli clienti; il rapporto può superare il 100%. Nessun vincitore viene attribuito."+((unknownOrigins||unknownChannels||unknownSeller||missing)?" Esistono origini, fonti o venditori mancanti: le percentuali sono n.d. perché l’attribuzione non è determinabile.":""),metrics:[],partial:true,tables:[{title:lead?"Contratti da lead / assegnazioni lette":"Contratti walk-in / preventivi walk-in letti",columns:["Venditore","Contratti classificati letti","Denominatore letto","Rapporto osservato"],rows:rows.map(row=>(unknownOrigins||unknownChannels||unknownSeller||missing)?[...row.slice(0,3),"n.d. (attribuzioni mancanti)"]:row)}]};
}
