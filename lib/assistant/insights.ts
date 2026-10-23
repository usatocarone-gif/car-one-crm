import type { AssistantResult } from "./schema";
import type { AssistantPresentation } from "./summary";

export type ReasoningInsight={observation:string;toCheck:string;action:string};
// Read-only editorial rules over the same validated backend result. No provider calls or causal attribution.
export function reasoningInsights(result:AssistantResult,view:AssistantPresentation):ReasoningInsight[]{
  const items:ReasoningInsight[]=[],q=result.query,rows=result.rows;
  const add=(observation:string,toCheck:string,action:string)=>items.push({observation,toCheck,action});
  if(result.truncated){add("Il risultato supera il limite di lettura verificabile.","Non possiamo interpretare un totale incompleto come risultato aziendale.","Restringi il periodo o i filtri prima di valutare l’andamento.");return items;}
  if(!result.sources.length||result.sources.some(s=>s.status==="unavailable")){
    add("Una o più fonti necessarie non sono disponibili.","Un dato assente non equivale a zero e può alterare confronti e classifiche.","Controlla le fonti indicate e ripeti l’analisi prima di prendere decisioni sui risultati.");return items;
  }
  if(!rows.length){
    add(view.partial?"Non risultano righe valide nelle fonti parziali lette.":"Non risultano record nel periodo e nei filtri scelti.",view.partial?"La copertura non permette di concludere che gli eventi siano stati zero.":"Verifica che periodo, venditore e descrizione del modello corrispondano alla domanda.","Controlla Fonti e criteri e i filtri applicati prima di interpretare l’assenza di risultati.");return items;
  }
  if(view.partial)add("Il risultato riguarda i record validi letti; la copertura è parziale.","Differenze tra fonti, righe escluse o storico incompleto possono cambiare il quadro.","Verifica le esclusioni in Fonti e criteri; mantieni la stessa copertura nei confronti.");
  if(q.analysis==="lead-conversion"||q.analysis==="walkin-conversion"){
    add("Il rapporto confronta eventi registrati nello stesso periodo; non collega i singoli clienti.","Le vendite del mese possono provenire da opportunità entrate in mesi precedenti; un rapporto elevato non certifica una conversione migliore.","Leggi insieme numeratore, denominatore e completezza dello storico. Non assegnare un vincitore finché i denominatori non sono verificati.");
  }else if(q.analysis==="period-comparison"){
    const entry=view.tables?.[0]?.rows.find(r=>/^-?\d+$/.test(r[3])&&Number(r[3])!==0);
    if(view.partial)add("I periodi confrontati hanno la stessa durata, ma le fonti non sono tutte complete.","Una variazione può dipendere anche dalla diversa copertura: da sola non dimostra crescita o calo dell’attività.","Riconcilia le fonti dei due periodi prima di cercare una causa commerciale.");
    else if(entry)add(`${entry[0]}: ${entry[1]} nel periodo attuale e ${entry[2]} nel precedente; differenza ${entry[3]}.`,"Calendario, tempi di registrazione, promozioni e composizione delle opportunità sono spiegazioni da verificare, non cause dimostrate.","Controlla i record che compongono la differenza e verifica il calendario operativo e promozionale, se disponibile.");
    else add("Il confronto non mostra una differenza numerica interpretabile nei conteggi disponibili.","Parità dei volumi non dimostra parità di qualità, margine o lavoro svolto; una base zero non consente una variazione percentuale.","Esamina gli esiti degli appuntamenti e i preventivi prima di valutare la qualità del periodo.");
  }else if(q.analysis==="seller-ranking"){
    add("La classifica misura registrazioni associate ai venditori, non il lavoro svolto o le opportunità ricevute.","Distribuzione dei lead, anzianità delle trattative e composizione dei veicoli possono influire sui risultati: vanno verificati.","Affianca ai conteggi le assegnazioni e gli appuntamenti dello stesso periodo prima di decidere affiancamenti o redistribuzioni.");
  }else if(q.analysis==="best-month"){
    add("Il primo posto considera i mesi chiusi interamente inclusi, con i provvisori separati.","Un solo mese forte non dimostra stagionalità o un effetto delle promozioni.","Verifica se il risultato si ripete negli altri anni e controlla il mix di veicoli prima di usarlo per pianificare acquisti o campagne.");
  }else if(q.kind==="vehicle-sales"){
    const priced=rows.filter(r=>r.invoiceAmount!==undefined).length;
    add(`IMP. FATT. valido per ${priced} record su ${rows.length}, usati nell’analisi del prezzo.`,"Importi mancanti e composizione di modelli e allestimenti possono influire sulla media. Il numero di vendite non misura da solo domanda o redditività.","Leggi media e mediana insieme. Per decidere acquisti o prezzi, verifica anche costo, stock disponibile e tempi di vendita: questa analisi non li misura.");
  }else if(q.kind==="appointments"){
    const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date(result.generatedAt));
    const pending=rows.filter(r=>r.date<today&&r.status==="pending").length;
    if(pending)add(`${pending} ${pending===1?"appuntamento precedente a oggi ha":"appuntamenti precedenti a oggi hanno"} un esito ancora da aggiornare.`,"Esito mancante non significa no-show e rende meno completa la lettura delle presenze.","Verifica gli esiti nei record prima di confrontare gli show rate o cambiare la gestione degli appuntamenti.");
    else add("Gli appuntamenti sono contati alla data dell’evento, con gli esiti registrati disponibili.","Più appuntamenti non dimostra più presenze o più vendite; i futuri restano soltanto programmati.","Leggi insieme presentati, no-show e preventivi del periodo. Verifica su un campione eventuali criticità di conferma o seguito.");
  }else if(q.kind==="lead-management"||q.kind==="lead-quality"||(q.kind==="leads"&&q.seller)){
    add("Questi dati descrivono assegnazioni o feedback registrati; non certificano il primo contatto.","Un feedback assente non dimostra che il venditore non abbia lavorato; lo stato attuale non ricostruisce automaticamente quello passato.","Verifica un campione di record con il team e chiarisci come registrare contatto ed esito prima di valutare la gestione.");
  }else if(q.kind==="leads"){
    add("Il conteggio misura richieste ricevute per data di arrivo, non persone uniche o opportunità qualificate.","Una variazione del volume non dimostra da sola un cambiamento nella qualità o nell’efficacia delle campagne.","Affianca al volume appuntamenti con esito e preventivi dello stesso periodo. Per valutare l’efficienza economica serve anche una fonte di spesa verificata.");
  }else if(q.kind==="quotes"||q.kind==="agenda-quotes"){
    add(q.kind==="quotes"?"Il risultato conta preventivi registrati, non tutte le conversazioni commerciali.":"I richiami riflettono lo stato operativo attuale dei preventivi.","Preventivi assenti o richiami scaduti non provano da soli né assenza di attività né perdita del cliente.","Apri i record da verificare e concorda il prossimo passo con il venditore, controllando che esiti e date siano aggiornati.");
  }else if(q.kind==="funnel"){
    add("Il funnel affianca eventi del periodo che possono riguardare clienti diversi.","Il rapporto fra due conteggi non identifica da solo un collo di bottiglia o una conversione individuale.","Controlla separatamente presenze agli appuntamenti, preventivi registrati e origini dei contratti. Poi confronta periodi con copertura omogenea.");
  }else{
    add("Il conteggio distingue lo storico ufficiale dalle eventuali registrazioni provvisorie.","Il volume di contratti non equivale a consegne, incassi o margine. Senza obiettivo verificato non misura il raggiungimento del target.","Confronta periodi omogenei e affianca il target aziendale verificato. Per decisioni economiche servono anche margini e incassi collegati.");
  }
  return items.slice(0,2);
}
