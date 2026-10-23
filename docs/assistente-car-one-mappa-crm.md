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
9. Solo Facebook / solo un venditore / solo una provincia → filtri non ancora supportati: dichiararlo, senza ignorare la richiesta.
10. Confronta contemporaneamente tre anni / dimmi perché calano / quanto fatturiamo / quanto spendiamo → elaborazioni o fonti aggiuntive; non inventare cause, confronti o risultati.

I riscontri numerici non sono inseriti nelle istruzioni del modello. Nessun dato cliente o chiave in questo documento.

## Passaggi successivi, senza promettere “sa tutto”

1. Rilascio coordinato Apps Script v53 + frontend; prova nel CRM autenticato, smartphone e voce.
2. Confronti controllati con periodi omogenei, filtri canale/geografia e fonti di copertura esplicite; nessun filtro venditore finché resta escluso dal perimetro concordato.
3. Briefing composto da più funzioni con testo narrativo fondato su aggregati minimizzati; le tabelle continuano a provenire dal backend.
4. Target/forecast con regola aziendale documentata; economia e noleggio solo dopo mappatura delle fonti effettive.

Non è addestramento sui clienti: è ampliamento del catalogo delle funzioni e delle definizioni che l’interprete può richiedere.
