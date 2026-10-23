import { ASSISTANT_SELLERS, canonicalBrand, normalizedWords, validateQuery, type AssistantQuery } from "./schema";

const months=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
// A small, anchored grammar covers common questions without an AI call. Anything left over goes to the validated planner.
export function localConversation(question:string,context?:AssistantQuery,now=new Date()):AssistantQuery|undefined {
  const previous=context?validateQuery(context):undefined;
  let text=question.toLowerCase().trim().replace(/[?!\.]+$/g,"").replace(/\s+/g," ");
  // Normalize only explicit time phrases; never remove unknown filters or predicates.
  text=text.replace(/\b(?:nel|durante il|per il) mese di /g,"a ")
    .replace(new RegExp(`\\b(${months.join("|")}) (?:del|dell[’']) ?(20\\d{2})\\b`,"g"),"$1 $2");
  const namedMonths=text.match(new RegExp(`\\b(?:${months.join("|")})\\b`,"g"))||[];
  const namedYears=text.match(/\b20\d{2}\b/g)||[];
  if(!/\bdal \d{4}-\d{2}-\d{2} al \d{4}-\d{2}-\d{2}\b/.test(text)&&(namedMonths.length>1||namedYears.length>1))
    throw new Error("Indica un solo periodo per questa domanda. Per un confronto specifica due intervalli precedenti, distinti e della stessa durata.");
  const follow=!!previous&&/^(?:e\b|invece\b|a che prezzo|chi le ha vendute)/.test(text);
  const base:Partial<AssistantQuery>=follow?{...previous}:{};
  text=text.replace(/^(?:e |invece )/,"");
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(now);
  const matchedSellers=ASSISTANT_SELLERS.filter(s=>new RegExp(`\\b${s.toLowerCase()}\\b`).test(text));
  if(matchedSellers.length>1)throw new Error("Indica un venditore alla volta; il confronto fra venditori non è ancora disponibile.");
  if(matchedSellers.length){base.seller=matchedSellers[0];text=text.replace(new RegExp(`(?:\\b(?:di|da|a|per) )?\\b${matchedSellers[0].toLowerCase()}\\b`),"").trim();}
  if(/\b(?:tutti i venditori|tutta l[’']azienda|senza filtro venditore)\b/.test(text)){delete base.seller;text=text.replace(/\b(?:tutti i venditori|tutta l[’']azienda|senza filtro venditore)\b/,"").trim();}
  if(/^(?:come sta andando|come stiamo andando|andamento di) questa settimana (?:a confronto con|confronto a|rispetto a|rispetto alla|contro) (?:quella scorsa|la settimana scorsa|settimana scorsa)$/.test(text)){
    const date=new Date(today+"T12:00:00Z"),offset=(date.getUTCDay()+6)%7;
    const shift=(n:number)=>new Date(date.getTime()+n*86400000).toISOString().slice(0,10);
    return validateQuery({kind:"funnel",from:shift(-offset),to:today,analysis:"period-comparison",compareFrom:shift(-offset-7),compareTo:shift(-7)});
  }
  const range=text.match(/\bdal (\d{4}-\d{2}-\d{2}) al (\d{4}-\d{2}-\d{2})\b/);
  const month=text.match(new RegExp(`\\b(?:a |ad |nel |di |per )?(${months.join("|")})(?: (20\\d{2}))?\\b`));
  const year=text.match(/\b(?:nel|il|per il) (20\d{2})\b/);
  if(range){base.from=range[1];base.to=range[2];text=text.replace(range[0],"");}
  else if(month){
    const y=month[2]||(follow?previous!.from.slice(0,4):undefined);if(!y)throw new Error("Di quale anno? Specifica il mese e l’anno.");
    const m=months.indexOf(month[1])+1;base.from=`${y}-${String(m).padStart(2,"0")}-01`;
    base.to=`${y}-${String(m).padStart(2,"0")}-${new Date(Date.UTC(Number(y),m,0)).getUTCDate()}`;text=text.replace(month[0],"");
  }else if(year){
    if(follow){base.from=year[1]+previous!.from.slice(4);base.to=year[1]+previous!.to.slice(4);}
    else{base.from=year[1]+"-01-01";base.to=year[1]+"-12-31";}text=text.replace(year[0],"");
  }else if(/\bquesto mese\b/.test(text)){base.from=today.slice(0,7)+"-01";base.to=today;text=text.replace(/\bquesto mese\b/,"");}
  else if(/\bquest[’']anno\b/.test(text)){base.from=today.slice(0,4)+"-01-01";base.to=today;text=text.replace(/\bquest[’']anno\b/,"");}
  else if(/\boggi\b/.test(text)){base.from=today;base.to=today;text=text.replace(/\boggi\b/,"");}
  else if(follow&&/^(?:l[’']anno (?:prima|precedente)|nell[’']anno precedente)$/.test(text)){
    base.from=String(Number(previous!.from.slice(0,4))-1)+previous!.from.slice(4);base.to=String(Number(previous!.to.slice(0,4))-1)+previous!.to.slice(4);text="";
  }
  text=text.replace(/\s+/g," ").trim();
  const analytical=normalizedWords(text).toLowerCase();
  if(/^chi ha venduto piu auto(?: da lead)?$/.test(analytical)){base.kind=/da lead$/.test(analytical)?"lead-contracts":"contracts";base.analysis="seller-ranking";}
  else if(/^chi (?:prende|ha preso|ha fissato) piu appuntamenti$/.test(analytical)){base.kind="appointments";base.analysis="seller-ranking";}
  else if(/^(?:qual e|qual è|quale e) il (?:miglior mese|mese migliore)(?: per (?:nr|numero|numero di) vendite)?$/.test(analytical)){base.kind="contracts";base.analysis="best-month";}
  else if(/^chi ha (?:il )?miglior tasso di conversione lead (?:contratto|contratti) lead$/.test(analytical)){base.kind="funnel";base.analysis="lead-conversion";}
  else if(/^chi ha (?:il )?miglior tasso di conversione (?:sui walkin quindi )?preventivi walkin (?:contratti|contratto)$/.test(analytical)){base.kind="funnel";base.analysis="walkin-conversion";}
  else if(/^(?:quanti |mostrami (?:i )?)lead(?: (?:ha|abbiamo))?(?: ricevuto| ricevuti| assegnati| sono arrivati| arrivati)?$/.test(text))base.kind="leads";
  else if(/^(?:quanti |mostrami (?:i )?)contratti(?: da lead)?(?: (?:ha|abbiamo))?(?: fatto| concluso| firmato| registrato| registrati)?(?: da lead)?$/.test(text)){base.kind=/\bda lead\b/.test(text)?"lead-contracts":"contracts";delete base.analysis;delete base.compareFrom;delete base.compareTo;}
  else if(/^(?:quanti |mostrami (?:i )?)preventivi(?: (?:ha|abbiamo))?(?: fatto| preparato| registrato| registrati)?$/.test(text)){base.kind="quotes";delete base.analysis;delete base.compareFrom;delete base.compareTo;}
  else if(/^(?:quanti |mostrami (?:gli )?)appuntamenti(?: (?:ha|abbiamo))?(?: preso| fissato| registrato)?(?: e (?:gli )?esiti)?$/.test(text)){base.kind="appointments";delete base.analysis;delete base.compareFrom;delete base.compareTo;}
  else if(/^(?:quali auto abbiamo venduto|quante auto (?:abbiamo|ha) venduto|auto vendute)$/.test(text))base.kind="vehicle-sales";
  else if(follow&&/^(?:a che prezzo medio|a che prezzo mediano|il prezzo medio|il prezzo mediano|chi le ha vendute|per venditore|per marca|per modello|fasce di prezzo)$/.test(text)){
    if(!["vehicle-sales","contracts","lead-contracts"].includes(previous!.kind))throw new Error("Il prezzo è disponibile per le auto vendute. Quali veicoli e quale periodo vuoi analizzare?");
    if(previous!.kind==="lead-contracts")throw new Error("Per analizzare gli importi dei soli contratti da lead serve un filtro Origine aggiuntivo, non ancora disponibile.");
    base.kind="vehicle-sales";delete base.analysis;delete base.compareFrom;delete base.compareTo;
    if(text==="chi le ha vendute"||text==="per venditore")base.analysis="seller-ranking";
  }else if(follow&&!text){/* Only an explicit period/seller changed. */}
  else {
    const sale=text.match(/^(?:quante|quanti|quali) (.+?) (?:(?:abbiamo|ha) )?vendut[eoia]$/);
    const vehicle=sale?.[1]||(follow?text.replace(/^(?:le |i |la |gli )/,""):"");
    const words=vehicle.split(" ");let brand:string|undefined,model="";
    for(let n=Math.min(3,words.length);n>0;n--){brand=canonicalBrand(words.slice(0,n).join(" "));if(brand){model=words.slice(n).join(" ");break;}}
    if(!brand||(!sale&&!follow))return undefined;
    base.kind="vehicle-sales";base.brand=brand;delete base.model;if(model)base.model=normalizedWords(model);
  }
  if(base.kind&&(!base.from||!base.to))throw new Error("Per quale periodo? Specifica mese e anno, oppure un anno completo.");
  if(!base.kind||!base.from||!base.to)return undefined;
  return validateQuery(base);
}
