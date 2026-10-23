import { ASSISTANT_SELLERS, canonicalBrand, normalizedWords, validateQuery, type AssistantQuery } from "./schema";

const months=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
// A small, anchored grammar covers common questions without an AI call. Anything left over goes to the validated planner.
export function localConversation(question:string,context?:AssistantQuery,now=new Date()):AssistantQuery|undefined {
  const previous=context?validateQuery(context):undefined;
  let text=question.toLowerCase().trim().replace(/[?!\.]+$/g,"").replace(/\s+/g," ");
  const follow=!!previous&&/^(?:e\b|invece\b|a che prezzo|chi le ha vendute)/.test(text);
  const base:Partial<AssistantQuery>=follow?{...previous}:{};
  text=text.replace(/^(?:e |invece )/,"");
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(now);
  const matchedSellers=ASSISTANT_SELLERS.filter(s=>new RegExp(`\\b${s.toLowerCase()}\\b`).test(text));
  if(matchedSellers.length>1)throw new Error("Indica un venditore alla volta; il confronto fra venditori non è ancora disponibile.");
  if(matchedSellers.length){base.seller=matchedSellers[0];text=text.replace(new RegExp(`(?:\\b(?:di|da|a|per) )?\\b${matchedSellers[0].toLowerCase()}\\b`),"").trim();}
  if(/\b(?:tutti i venditori|tutta l[’']azienda|senza filtro venditore)\b/.test(text)){delete base.seller;text=text.replace(/\b(?:tutti i venditori|tutta l[’']azienda|senza filtro venditore)\b/,"").trim();}
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
  if(/^(?:quanti |mostrami (?:i )?)lead(?: (?:ha|abbiamo))?(?: ricevuto| ricevuti| assegnati| sono arrivati| arrivati)?$/.test(text))base.kind="leads";
  else if(/^(?:quanti |mostrami (?:i )?)contratti(?: (?:ha|abbiamo))?(?: fatto| registrati)?(?: da lead)?$/.test(text))base.kind=/da lead$/.test(text)?"lead-contracts":"contracts";
  else if(/^(?:quanti |mostrami (?:i )?)preventivi(?: (?:ha|abbiamo))?(?: fatto| registrati)?$/.test(text))base.kind="quotes";
  else if(/^(?:quanti |mostrami (?:gli )?)appuntamenti(?: (?:ha|abbiamo))?(?: e (?:gli )?esiti)?$/.test(text))base.kind="appointments";
  else if(/^(?:quali auto abbiamo venduto|quante auto (?:abbiamo|ha) venduto|auto vendute)$/.test(text))base.kind="vehicle-sales";
  else if(follow&&/^(?:a che prezzo medio|a che prezzo mediano|il prezzo medio|il prezzo mediano|chi le ha vendute|per venditore|per marca|per modello|fasce di prezzo)$/.test(text)){
    if(!["vehicle-sales","contracts","lead-contracts"].includes(previous!.kind))throw new Error("Il prezzo è disponibile per le auto vendute. Quali veicoli e quale periodo vuoi analizzare?");
    if(previous!.kind==="lead-contracts")throw new Error("Per analizzare gli importi dei soli contratti da lead serve un filtro Origine aggiuntivo, non ancora disponibile.");
    base.kind="vehicle-sales";
  }else if(follow&&!text){/* Only an explicit period/seller changed. */}
  else {
    const sale=text.match(/^(?:quante|quanti|quali) (.+?) (?:(?:abbiamo|ha) )?vendut[eoia]$/);
    const vehicle=sale?.[1]||(follow?text.replace(/^(?:le |i |la |gli )/,""):"");
    const words=vehicle.split(" ");let brand:string|undefined,model="";
    for(let n=Math.min(3,words.length);n>0;n--){brand=canonicalBrand(words.slice(0,n).join(" "));if(brand){model=words.slice(n).join(" ");break;}}
    if(!brand||(!sale&&!follow))return undefined;
    base.kind="vehicle-sales";base.brand=brand;delete base.model;if(model)base.model=normalizedWords(model);
  }
  if(!base.kind||!base.from||!base.to)return undefined;
  return validateQuery(base);
}
