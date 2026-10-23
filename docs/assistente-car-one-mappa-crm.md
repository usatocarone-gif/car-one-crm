# Copertura dell’Assistente Car One — audit 23 ottobre 2026

Repository analizzato: Next.js App Router, API server, adapter Apps Script v52 pubblicato, sorgenti Sheets e calendari, componenti della dashboard, autenticazione Basic sul server. Nessun database SQL: Sheets è il sistema operativo; alcune viste sono aggregazioni in memoria, altre usano uno snapshot di ripiego. L’assistente non deve usare lo snapshot per rispondere a richieste aggiornate.

## Inventario e confini

| Area CRM | Fonti effettive | Estensione preparata | Limiti da mostrare |
|---|---|---|---|
| Lead ricevuti | Make Leads: Foglio1, giuseppe lead, archivi mensili | Conteggio, giorno/ora disponibile, mese e canale, link riga | Mesi senza archivio non equivalgono a zero; record storici 2024 non trovati nelle fonti configurate |
| Gestione lead | Sei fogli venditori; LEAD_MASTER; STORICO_V2 | Feedback attuale su assegnazioni; feedback serale già disponibile | Feedback non prova una chiamata. LEAD_MASTER registra osservazioni, non il primo contatto reale |
| Appuntamenti | Due Google Calendar con eventi APP; tab Appuntamenti di supporto | Periodi, esiti SI/NO/pendente, show rate | Conteggi calendario di tutti i canali; attribuzione lead della dashboard usa euristiche |
| Preventivi | Make Leads / Preventivi; database commerciale PREVENTIVI_OPERATIVI e PREV_* | Emissioni presenti nel tab; richiami attuali già disponibili | Archivi e processi diversi: non sommare fonti operative e tab come se fossero preventivi distinti |
| Contratti | Venduto CAR 2024/25/26, AD MOTOR 24/25 e 2026; proiezioni | Conteggi esistenti, Origine lead e rapporti di periodo | CAR 2024 senza Origine; mese corrente provvisorio; non fatturato fiscale |
| Canali e conversioni | leadCohorts, directCohorts, showRateHistory calcolati | Rapporto registrazioni da Origine lead / ingressi; contratti / preventivi; quota contratti lead | “Coorti” legacy includono eventi a date diverse e matching nominativo. Non certificare il percorso del singolo lead |
| Geografia/ZIC | Città nei lead, classificazione comuni in Next.js | Dato presente, estensione interrogazione geografica successiva | Località ambigue, mancanti e riclassificate; non dare per certe province inferite |
| Target e forecast | Costanti e giorni di vendita nel codice; appuntamenti futuri | Presenti in dashboard, non ancora nel catalogo numerico nuovo | Obiettivo non è risultato; previsione non è contratto registrato |
| Valori economici | Campi revenue nei venduti e proiezioni; tab DA INCASSARE | Non esposti come fatturato o incassi | Serve una definizione contabile e verifica dei campi prima di integrare |
| Marketing, CPL, ROI | Canali dei lead; nessun connettore spesa pubblicitaria nel motore | Solo volumi canale | Senza costi e attribuzione non si può calcolare CPL/ROI |
| Noleggio | Nessun adapter dedicato nel repository analizzato | Non disponibile | La presenza del business NLT non implica dati caricati nel CRM |
| Stock Infocar | Receiver e gateway XML separati | Esclusi dall’assistente in sola lettura | Non attivare import, scritture o operazioni amministrative |

## Date e sorgenti verificate

Metadata dei tre fogli principali letti dal connettore. Make Leads e Venduto impostati Europe/Paris, database commerciale Europe/Rome: il conteggio dell’assistente usa esplicitamente Europe/Rome, non il fuso implicito del foglio. Per gli istanti ISO con Z/offset il confine del giorno viene convertito. Nessun anno ricostruito da una data senza anno.

Make Leads contiene archivi espliciti da maggio 2025 e archivi con nomi riconoscibili fino a settembre 2026; questo non certifica automaticamente la completezza di ogni mese. Le fonti e le esclusioni vengono verificate a ogni lettura. Righe di primo mese fuori archivio e valori non ID nella colonna LEAD ID sono anomalie rilevate, da mostrare senza correggere il dato originale.

## Domande di collaudo

1. Quanti lead abbiamo ricevuto questo mese? → al 23 ottobre: 1.219 eventi validi letti nel campione completo delle due fonti correnti; risultato parziale con esclusioni visibili.
2. Quanti lead abbiamo ricevuto il 2026-10-23? → 25; distribuzione nel giorno, canali e link verificabili.
3. Quanti lead abbiamo ricevuto il 2026-10-01? → 42; nessun cambio di giorno dovuto a UTC interpretato come ora italiana.
4. Quanti lead nel 2024? → fonti non configurate/copertura mancante, nessuno zero inventato.
5. Mostrami il funnel questo mese → numeri delle fonti, denominatori, rapporti di periodo osservati; nessuna attribuzione individuale.
6. E i lead? / E i preventivi? / E gli appuntamenti? → stesso periodo validato, nuovo indicatore.
7. Quanti lead hanno un feedback nel 2026? → stato presente delle assegnazioni arrivate nel periodo; non “contattati entro il primo giorno”.
8. Quanti sono diventati contratti tra i lead arrivati ieri? → non certificabile senza legami ID registrati; proporre rapporto di periodo solo esplicitandolo.
9. Solo venditore → filtro controllato disponibile nella nuova estensione; lead = assegnazioni conservate nel foglio. Solo Facebook / solo provincia → ancora non supportati.
10. Confronta contemporaneamente tre anni / dimmi perché calano / quanto fatturiamo / quanto spendiamo → elaborazioni o fonti aggiuntive; non inventare cause, confronti o risultati.

I riscontri numerici non sono inseriti nelle istruzioni del modello. Nessun dato cliente o chiave in questo documento.

## Passaggi successivi, senza promettere “sa tutto”

1. Rilascio coordinato Apps Script v53 + frontend; prova nel CRM autenticato, smartphone e voce.
2. Confronti controllati con periodi omogenei, filtri canale/geografia e fonti di copertura esplicite; filtro venditore sui singoli dataset, senza attribuzioni individuali di conversione.
3. Briefing composto da più funzioni con testo narrativo fondato su aggregati minimizzati; le tabelle continuano a provenire dal backend.
4. Target/forecast con regola aziendale documentata; economia e noleggio solo dopo mappatura delle fonti effettive.

Non è addestramento sui clienti: è ampliamento del catalogo delle funzioni e delle definizioni che l’interprete può richiedere.

## Estensione veicoli venduti, richiesta durante l’audit

Aggiunta query vehicle-sales. Utente ha confermato IMP. FATT. come prezzo di riferimento. Campi effettivamente verificati nelle intestazioni dei cinque fogli ufficiali e del prospetto corrente: marca-modello, targa (non esposta al modello), data, venditore, Origine dove presente, IMP. FATT. con posizioni diverse fra società/anni. Nel corrente il campo è VAL. VENDITA / PROVVIGIONE e resta escluso dai prezzi.

Analisi disponibili: marche, descrizioni modello, fasce IMP. FATT., prezzo medio e mediano sui record valorizzati; ufficiali e provvisori distinti. Non sono disponibili segmento SUV/utilitaria, alimentazione, anno o km del veicolo venduto. I campi anno e km visibili nel prospetto riguardano la permuta. Non inferirli automaticamente dal nome del modello e non promettere analisi di marginalità o obiettivi futuri di prezzo.


## Filtri conversazionali (estensione successiva alla PR 7)

Parametri validati dal server: seller fra i sei venditori configurati; brand fra marche esplicite/alias; model come parole contigue esatte nella descrizione. Marca/modello solo su vehicle-sales, combinabili con venditore. Filtro venditore su lead, feedback, contratti, contratti da lead, preventivi e appuntamenti. Funnel e agenda/richiami combinati restano senza filtro venditore: non eliminare la richiesta silenziosamente.

Le nuove query riusano Apps Script v53: il server richiede il dataset senza filtri dalla cache, valida tutte le righe e applica i filtri prima di aggregare e prima del campione di 500 riferimenti. Non serve un deployment Apps Script diverso. Per lead con seller legge lead-management, conserva soltanto la fonte e le righe del venditore richiesto e conta assegnazioni, non il totale aziendale. Queste fonti sono sempre qualificate parziali per lo storico: Data è quella registrata nel foglio, non un log dell’istante di assegnazione; rimozioni/spostamenti non ricostruibili. Zero righe non certifica zero lead ricevuti.

Contesto di sessione: ultimo indicatore, periodo e filtri validati; una domanda successiva modifica ciò che viene richiesto. Nuova domanda autonoma riparte senza filtri precedenti. Cambio marca elimina il precedente modello se non esplicitato; date impossibili chiedono chiarimento. Parser locale per domande comuni, Gemini per altre formulazioni: nessun codice o SQL generato. Testo cliente e risultati non inviati al modello. La domanda dell’utente e il contesto di filtri possono contenere il cognome del venditore configurato.

Collaudo riproducibile: node scripts/test-assistant-filters.cjs. Domande Caironi/settembre 2026 e Alfa Romeo Stelvio/2026; seguiti anno, mese, venditore, prezzo medio, venditore delle auto; cambio argomento; filtri non consentiti; data bisestile; alias VW; 500 diverso da 500X; media sulle sole righe filtrate; fonti mancanti e attribuzioni ignote; autenticazione; 601 auto filtrate prima del limite 500. Risultati attesi dei test sono sintetici, non conteggi di produzione. Verifica live delle nuove risposte ancora da eseguire.


### Classifiche, rapporti e confronti

analysis seller-ranking: conteggi per venditore di contratti, contratti con Origine lead, auto filtrate, preventivi e appuntamenti. Non inferisce chi ha materialmente prenotato: il calendario attribuisce il venditore nel titolo. Parità mantenute; venditori sconosciuti esclusi e dichiarati. Con fonti parziali la classifica riguarda solo registrazioni lette, senza certificare un migliore assoluto.

analysis best-month: sceglie il mese chiuso interamente incluso con più vendite ufficiali lette. Mesi tagliati, mese corrente e provvisori sono separati e non vincono la classifica.

analysis period-comparison: due intervalli anteriori/distinti di stessa durata, letti tramite le funzioni esistenti. La domanda su questa settimana confronta lunedì–oggi con lunedì–stesso giorno della settimana precedente (Europe/Rome). Giorno corrente incompleto dichiarato. Fonte mancante: differenze/variazioni n.d.; base zero: variazione percentuale n.d. Riferimenti ai record di entrambi i periodi, distinti dalla data e dal campo comparisonPeriod.

analysis lead-conversion e walkin-conversion: tabelle per venditore con numeratore e denominatore. Lead = contratti classificati dal solo Origine / assegnazioni nei fogli. Walk-in = Origine esplicita walk-in / Fonte esplicita walk-in del tab Preventivi; altri non-lead non diventano walk-in. Poiché completezza storica delle assegnazioni e dei preventivi non è certificata, nessun miglior tasso viene attribuito: solo rapporti osservati di periodo, che non misurano coorti e possono superare il 100%. Origine/Fonte/venditore mancante o fonte non disponibile: percentuali n.d. Uno zero al denominatore resta n.d. Tutte queste analisi usano Apps Script v53 e conservano letture in sola lettura.

Test aggiunti: classifiche e parità, conteggi da lead a settembre 2025, rapporti ottobre 2026, esclusione passaparola da walk-in, fonte mancante, confini settimanali e corrispondenza giorni, esclusione mese corrente dal migliore e orchestrazione multi-fonte sul server. Il collaudo usa dati sintetici; conteggi reali delle classifiche ancora da riconciliare prima di considerarli certificati.
