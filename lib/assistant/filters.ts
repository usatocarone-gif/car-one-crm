import { ASSISTANT_SELLERS, normalizedWords, validateQuery, type AssistantQuery, type AssistantResult } from "./schema";
import { vehicleBrand } from "./vehicles";

export function sourceQuery(input:AssistantQuery):AssistantQuery {
  const q=validateQuery(input);
  return {kind:q.kind==="leads"&&q.seller?"lead-management":q.kind,from:q.from,to:q.to};
}
export function filterResult(result:AssistantResult,input:AssistantQuery):AssistantResult {
  const query=validateQuery(input),assigned=query.kind==="leads"&&!!query.seller;
  const sellerName=(value:string)=>normalizedWords(value).split(" ").filter(x=>x);
  let sources=result.sources;
  // Seller sheets are separate sources. Failure of another seller does not hide this seller's coverage.
  if(query.seller&&(assigned||query.kind==="lead-management")) {
    sources=sources.filter(s=>normalizedWords(s.name)===`GESTIONE ${query.seller}`);
    if(!sources.length)throw new Error("Fonte venditore non disponibile");
    sources=sources.map(s=>({...s,status:s.status==="unavailable"?"unavailable" as const:"partial" as const,
      coverage:s.coverage+"; registrazioni attualmente conservate, completezza storica non certificata",
      issues:[...s.issues,"La data è quella registrata nel foglio venditore; non certifica l’istante di assegnazione. Spostamenti o righe rimosse non sono ricostruibili."]}));
  }
  const unknown=result.rows.filter(r=>
    (query.seller&&!ASSISTANT_SELLERS.some(s=>sellerName(r.seller).includes(s)))||
    ((!query.seller||sellerName(r.seller).includes(query.seller))&&((query.brand&&vehicleBrand(r.vehicle||"")==="Non classificata")||(query.model&&!r.vehicle)))
  ).length;
  if(unknown)sources=[...sources,{name:"Copertura filtri",status:"partial",readAt:result.generatedAt,coverage:"Record non attribuibili ai filtri richiesti",issues:[`${unknown} registrazioni hanno venditore o descrizione non classificabile: escluse dal sottoinsieme; il risultato non certifica la loro attribuzione.`]}];
  const rows=result.rows.filter(r=>
    (!query.seller||sellerName(r.seller).includes(query.seller))&&
    (!query.brand||normalizedWords(vehicleBrand(r.vehicle||""))===normalizedWords(query.brand))&&
    (!query.model||(` ${normalizedWords(r.vehicle||"")} `).includes(` ${query.model} `))
  );
  return {...result,query,sources,rows};
}
export function describeFilters(q:AssistantQuery){
  return [q.seller?`Venditore: ${q.seller}`:"Tutti i venditori",q.brand?`Marca: ${q.brand}`:"",q.model?`Modello: ${q.model} (parole esatte nella descrizione registrata)`:"","Car One e AD Motor; Europe/Rome; date incluse.",q.kind==="lead-contracts"?"Solo origini lead/digitali riconosciute.":""].filter(Boolean).join(" · ");
}
