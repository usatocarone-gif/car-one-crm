# Assistente Car One — pilota in sola lettura

Stato 23 ottobre 2026: pilota locale pubblicato, PR #3 unita, Apps Script aggiornato alla versione 52 e deploy Production Vercel completato. Verifica UI autenticata ancora da completare. Il collegamento Gemini descritto sotto è un successivo intervento da rilasciare e configurare. Nessun servizio acquistato, nessun dato di produzione modificato, nessun fornitore AI chiamato. L'accesso condiviso del CRM rimane richiesto. Nessuna separazione per venditore nel pilota.

## Base precedente verificata (prima del rilascio v52)

Dal pannello Gestisci deployment Apps Script era attiva la versione 51 del 21 ottobre 2026, ore 18:29 (orario dell'interfaccia). Descrizione: “Report: lead tutti i giorni incluse domeniche; medie lun-sab; planning facoltativo”. Il codice di Cronologia progetto → Versione 51 è stato copiato e confrontato integralmente con l'editor: identico, 93.117 caratteri. Conservato in integrations/apps-script/published-v51.gs; il vecchio file API V7 è storico, non la base corrente.

Progetto: https://script.google.com/home/projects/1rWhTNo8M1qZcDaatSTXMhZfEiw6M9wR2ZP9_ocgA-wuYdNkcrjMt5SMy/edit
Deployment osservato: AKfycbwVVJpZOnb8GiFLTf_wDz_SnBkfVM_ugAPjEKNyEtUUBe4NYLQEi1cpSu2GeUQf7wJv.
Non sono stati letti token né configurazione Vercel: l'URL configurato effettivamente nel frontend va confrontato al rilascio.

`node scripts/build-assistant-script.mjs` genera candidate-v52.gs. “v52” è un nome locale di candidato, non prova di una versione creata in Google. La sola modifica al dispatcher della base è una diramazione token-protetta action=assistant; tutte le nuove letture sono nel modulo assistant-readonly.gs. Le funzioni legacy, report, receiver Infocar e i calcoli della dashboard rimangono nella base. Non sostituire lo script con il vecchio V7.

## Interrogazioni del pilota

1. Contratti nel 2025, divisi Car One e AD Motor: date 2025-01-01 / 2025-12-31.
2. Appuntamenti e preventivi da richiamare oggi: un solo giorno, esplicito in Europe/Rome. Gli appuntamenti si possono leggere anche per altra giornata; i richiami sono disponibili solo per oggi perché lo stato dei preventivi non è uno storico.
3. Contratti da lead: stessi periodi, filtrati esclusivamente dal campo Origine con la regola della vista Contratti esistente.
4. Feedback registrato al controllo serale dal 2026-10-01 al 2026-10-20: tutta l'azienda, osservazioni e ricostruzioni separate.

La chat ha un interprete locale limitato e visibile; i controlli indicatore/periodo permettono la selezione esplicita. Filtri non supportati o ambigui vengono rifiutati. Nessun LLM attivo. Nessun SQL, query generica, strumento di scrittura, email o modifica Calendar. Tutte le tabelle vengono direttamente dai record restituiti dal backend; riepiloghi calcolati deterministicamente. Record paginati nell'interfaccia, 50 per pagina. Limite periodo 367 giorni, 10.000 risultati massimi; un risultato troncato non ha un totale certificabile.

## Definizioni adottate per il test

| Indicatore | Regola |
| --- | --- |
| Contratti registrati nei mesi chiusi | Riga con data valida, cliente, venditore e veicolo/targa nel venduto ufficiale. La data è quella presente nella riga; non certifica consegna, fattura o incasso. |
| Registrazioni provvisorie del mese corrente | Righe valide di PROIEZ. REDDITIVITA', solo nel mese corrente e non successive a oggi. Non vengono sommate indistintamente ai contratti dei mesi chiusi. Società non riconosciuta esclusa. |
| Duplicati sospetti contratti | Stessa data, cliente, modello, targa, venditore e società: tutte le occorrenze escluse, con avviso e righe da controllare. È un controllo conservativo, non una dimostrazione di identità contrattuale; targhe diverse restano vendite distinte. Se manca la targa, un caso ambiguo richiede un ID contratto. |
| Fatturato / incassi | Non disponibili nel pilota. Il campo revenue non dimostra ricavo fiscale né pagamento. Per abilitarli servono fonte contabile, data fattura/pagamento, imponibile/IVA, note di credito e regole di annullamento. |
| Gestione registrata | Nel dato attuale, presenza del feedback. Non equivale automaticamente a contatto telefonico riuscito. |
| Primo giorno | Il pilota espone “feedback registrato al controllo serale”, non tempo di primo contatto. Somma feedback / somma lead in scadenza delle osservazioni effettive. Ricostruzioni escluse dal tasso. Zero denominatore → n.d. |
| Gestito entro il primo giorno come SLA | Da definire prima di esporre questo nome: arrivo prima/dopo orario limite, giorno solare o lavorativo, weekend, scadenza e attività ammesse. Serve un timestamp dell'attività per verificare lo SLA. |
| Appuntamenti | Eventi APP dei due calendari configurati, giorno di inizio Europe/Rome. Deduplica ID evento + istante d'inizio, anche tra calendari; un giorno si legge da mezzanotte locale alla mezzanotte successiva. L'esito derivato dal titolo può restare pending. |
| Preventivi da richiamare | Stato attuale delle sei schede PREV, con la funzione quotePriority già usata nel CRM; stati e date incoerenti mostrati separatamente come “da verificare”. Prossimo richiamo esplicito, altrimenti tre giorni lavorativi da ultimo richiamo o data preventivo. |

Le corrispondenze per nome/telefono tra lead e contratto sono indizi: omonimi, recapiti condivisi, più richieste e nomi trascritti diversamente possono creare falsi collegamenti. Per i “contratti da lead” il pilota usa esclusivamente il campo Origine, come richiesto: contiene lead, social, facebook, instagram, tiktok, sito, autoscout, a24 o bdc, senza distinzione di maiuscole. La regola condivisa in lib/contract-origin.ts è usata dalla vista Contratti, dal backend e incorporata automaticamente nel candidato Apps Script. L’origine originale viene mostrata, senza associare nominativi. Origini mancanti escluse da questo conteggio con avviso. Una catena ID serve eventualmente per analizzare la conversione di una specifica coorte di lead, non per contare i contratti classificati come lead nella fonte.

## Riferimenti, copertura e aggiornamento

| Fonte | Copertura dichiarata | Riferimenti |
| --- | --- | --- |
| Venduto ufficiale | Anni configurati 2024–2026; CAR anno e AD MOTOR 24/25 (alias AD MOTOR) oppure AD MOTOR 2026; solo mesi chiusi | Spreadsheet + gid + numero riga + link + SHA-256 del contenuto letto |
| Proiezioni | Solo mese corrente, data non futura | Come sopra; categoria provvisoria |
| Calendar | Giorno selezionato, entrambi i calendari configurati | ID evento + inizio, calendario d'origine, link evento |
| Preventivi operativi | Schede dei sei venditori, dal cutoff CONFIGURAZIONE; situazione attuale | ID preventivo e URL riga esistenti; Google applica i propri permessi |
| STORICO_V2 | Giorni/venditori osservati nel periodo; ricostruzioni separate | Chiave giorno-venditore e riferimento alla riga. Ogni combinazione dei sei venditori/giorni senza osservazione viene dichiarata mancante, anche se non erano previsti lead. Non implica lavoro non svolto. |

Ogni risposta contiene periodo incluso, fuso, filtri, definizione, fonte, copertura, stato, anomalie e readAt. generatedAt/readAt sono lettura della fonte, NON timestamp dell'ultima attività dell'operatore. Quello non è disponibile uniformemente e non viene inventato. Cache server 120 secondi, browser private/no-store. Una fonte vuota letta non è una fonte assente: available con zero record; una fonte assente è unavailable. Errori o righe escluse rendono il risultato parziale e i conteggi sono subtotali dei record validi.

I numeri di riga sono localizzatori al momento della lettura, non ID permanenti: dopo ordinamenti/inserimenti il link può puntare a un'altra riga. L'impronta consente il confronto, ma il pilota non rilegge il record al click né mantiene snapshot persistenti. Non sono stati aggiunti ID nei fogli per rispettare la sola lettura; eventuali UUID permanenti sono un successivo intervento sul dato. Gli storici aggregati della dashboard restano disponibili e il nuovo adapter conserva il dettaglio separatamente.

## Validazione date

Accettati: celle Date Google valide, stringhe esatte AAAA-MM-GG oppure GG/MM/AAAA (anno a quattro cifre). GG/MM è sempre ordine italiano: 03/04/2026 è 3 aprile. Nessun riconoscimento tramite Date.parse su testo libero. Verifica anno 2000–2100, mese, giorno e bisestile. Mancanti, impossibili, suffissi arbitrari e anni a due cifre esclusi con avviso. Nessuna sostituzione con oggi e nessuno spostamento nel mese corrente. Le richieste API accettano solo date ISO. “Mese scorso”, nomi ambigui e filtri sconosciuti chiedono selezione esplicita.

I percorsi legacy della dashboard mantengono il comportamento v51: non è stata cambiata di nascosto la serie storica già pubblicata. La lettura dell'assistente usa le nuove regole rigorose; eventuali scostamenti richiedono controllo delle righe prima di uniformare anche gli altri report.

## Modello, chiavi e dati ai fornitori

### Prova Gemini: interpretazione delle domande

Il pilota locale rimane disponibile senza chiavi AI. L'integrazione sperimentale usa Gemini solo per tradurre domande non riconosciute localmente in un piano strutturato: status, kind, from, to. Le domande rapide e i controlli non richiedono chiamate AI. L’interfaccia conserva più domande e risposte in memoria mentre la sezione resta aperta; nuova chat o chiusura della sezione azzerano il contesto. Non è un analista che produce commenti liberi: risposte brevi, numeri e tabelle rimangono interamente deterministici. Fonti, criteri e record sono espandibili; dati parziali e periodo rimangono subito visibili. Il catalogo non include ancora le estensioni dei 20 casi di collaudo.

Configurazione server Vercel del progetto car-one-crm (mai NEXT_PUBLIC, browser, fogli o repository):

- GEMINI_API_KEY: chiave dedicata creata in Google AI Studio.
- ASSISTANT_GEMINI_ENABLED=true: consenso operativo all'attivazione. Senza chiave o senza questo flag, nessuna chiamata al fornitore.
- GEMINI_MODEL=gemini-3.5-flash-lite: modello iniziale configurabile, da verificare nell'account. Nessun fallback automatico a un modello più costoso.

Dopo aver configurato le variabili occorre un nuovo deployment. La schermata indica se il collegamento è configurato, non certifica la validità della chiave o la disponibilità del modello: queste richiedono una prova reale. GET /api/assistant richiede il login e restituisce solo un booleano di configurazione.

L'API è chiamata dal server con header x-goog-api-key, timeout 20 secondi, una chiamata per domanda non riconosciuta, nessun retry automatico, limite output 512 token. Throttle best effort per processo: 10 chiamate/minuto, 2 contemporanee. Le istanze serverless non condividono tale contatore: non è un limite di spesa globale. Per un limite economico servono quote del progetto/provider o un contatore persistente; non assumere che gli avvisi budget blocchino la spesa.

Payload: istruzioni aziendali compilate da docs/assistente-car-one-istruzioni.md, catalogo reale delle funzioni, data corrente Europe/Rome, domanda dell'utente ed eventuale contesto validato (ultimo indicatore e periodo). Nessun risultato, riga, nome cliente, venditore, targa o URL delle fonti viene estratto dal CRM per l'invio. La domanda libera può però contenere informazioni personali: l'UI avvisa di non inserirle; i controlli bloccano identificativi comuni (email, telefoni, targhe, URL e alcune richieste nominative), senza garantire anonimizzazione completa. Limitare la prova a domande aggregate. Nessuna persistenza di conversazioni o log del contenuto. Per le domande successive il client passa solo l’ultimo indicatore e periodo, che il server rivalida. Non viene inviata al modello la cronologia né alcuna risposta con righe CRM. “E nel 2024?”, “E l’anno prima?” ed “E quelli da lead?” sono interpretati localmente senza chiamate AI; date impossibili, compreso il 29 febbraio trasposto a un anno non bisestile, richiedono correzione esplicita. Nuove domande complete possono sostituire il contesto; ogni risposta mostra il periodo e i filtri realmente eseguiti.

Il JSON del modello viene rivalidato dal backend: schema chiuso, indicatori permessi, date reali, limite 367 giorni, contratti 2024–2026. Risposte incomplete, filtri aggiuntivi, errore quota e timeout non diventano numeri. L'utente vede il periodo e i filtri interpretati e può usare i controlli espliciti. Un modello può interpretare erroneamente l'intento pur producendo parametri formalmente validi: collaudare anche filtri ignorati e ambiguità con le domande del dataset prima di estendere l'uso.

Le istruzioni aziendali sono incorporate come testo nel modulo server lib/assistant/gemini.ts; quando si modifica il manuale occorre aggiornarne la copia compilata. Le risposte attese e i totali del collaudo non vengono inseriti nel prompt.

Non viene creata una chiave né attivata fatturazione da questo codice. I termini Gemini richiedono Paid Services per applicazioni destinate a utenti EEA; per l'API ciò richiede un progetto con fatturazione attiva. Non presentare la prova nel CRM italiano come gratuita garantita. Verificare quote, costi, account e trattamento prima dell'attivazione. Finché disattivata, nessun costo Gemini. Riferimenti ufficiali consultati il 23 ottobre 2026:

- https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- https://ai.google.dev/gemini-api/terms
- https://ai.google.dev/gemini-api/docs/pricing

## Collaudo

Eseguiti localmente:
- node scripts/build-assistant-script.mjs
- node scripts/test-assistant.cjs
- npm run typecheck
- npm run build

Fixture sintetiche: 29 febbraio bisestile, 31 febbraio escluso, anno a due cifre rifiutato, date italiane e confine mezzanotte Roma; due vendite valide, data invalida e coppia duplicata esclusa; fonte AD mancante esplicitata; link esterno rifiutato; media pesata 10% (1/1 e 0/9), ricostruzione esclusa, denominatore zero n.d.; filtro venditore non supportato rifiutato; API senza credenziali 401, origine diversa 403, domanda ambigua 400, fonte indisponibile 503. Sintassi candidato valida, un solo doGet e un solo doPost.

Da completare prima del rilascio:
1. Riconciliare manualmente le righe 2025 con il precedente riscontro datato 389 (246 Car One / 143 AD Motor). È un riferimento da riconfermare, non un numero codificato nel motore e non una nuova lettura dei dati effettuata in questa sessione. Le esclusioni rigorose potrebbero produrre uno scostamento legittimo da risolvere.
2. Verificare un giorno noto dei due calendari e il corretto collegamento a un evento; confrontare richiami di oggi con sei schede, cutoff e giorni eccezionali.
3. Verificare un periodo STORICO_V2 con numeratori/denominatori manuali e distinguere osservazioni mancanti da giornate senza lead.
4. Prova mobile reale e controlli di accesso sull'ambiente di anteprima; nessuna concessione di accesso Google automatica tramite i link.
5. Confrontare URL Apps Script configurato nel deploy frontend con la versione 51 osservata. Provare candidato in ambiente di test con fonti accessibili in sola lettura prima di aggiornare lo stesso deployment. Non attivare receiver, trigger o email per il collaudo.
6. Rilascio coordinato backend Apps Script + frontend. Con vecchio backend l'API assistente risponde 503 esplicito, senza ripiegare su snapshot o inventare dati. Rollback: versione 51 Apps Script e frontend precedente. I report esistenti non dipendono dall'assistente.

Il commit del branch non rende l'assistente già disponibile online.


## Voce del browser e opzioni avanzate

Prima versione senza ElevenLabs, SDK, chiavi o nuove API a consumo: microfono attivato esplicitamente, dettatura it-IT non continua, testo visibile e correggibile prima dell’invio manuale alla stessa POST /api/assistant della chat. Nessun invio automatico alla fine della frase. Il CRM non registra né conserva l’audio. L’avviso prima dell’attivazione spiega che il servizio di riconoscimento del browser può elaborare audio online: non è una promessa di elaborazione locale o anonimizzazione. Non dettare dati personali.

L’ascolto si chiude dopo la frase, con Stop, al cambio di scheda/uscita e dopo un massimo di 45 secondi. La bozza precedente è preservata; i risultati parziali vengono sostituiti senza duplicazioni, limite 600 caratteri. Durante l’ascolto invio e modifica del testo sono bloccati, finché il risultato finale non è arrivato. Errori di permessi, microfono, rete o browser incompatibile lasciano disponibile la chat; è possibile usare anche la dettatura della tastiera del telefono. Non si riattiva il microfono automaticamente.

“Leggi risposta” usa SpeechSynthesis con periodo, titolo, testo, metriche e avvertenza di dati parziali già prodotti dal backend. Nessuna nuova generazione AI o accesso ai record per la voce. “Ferma audio”, nuova domanda, nuova chat, cambio scheda e uscita interrompono la lettura. Si preferisce una voce italiana locale quando disponibile, senza garantire elaborazione offline: le voci di sistema possono usare servizi online. La lettura è sempre manuale, senza autoplay. Il testo da leggere è la sintesi aggregata, non le righe con dati personali.

Supporto rilevato a runtime per SpeechRecognition o webkitSpeechRecognition e SpeechSynthesis; disponibilità del costruttore non garantisce un servizio funzionante. Su dispositivi reali verificare Chrome desktop/Android e Safari iOS, permessi negati e revocati, rete assente, stop durante la frase, transcrizione di 2024/2025/2026, interruzione lettura e passaggio in background. Non è una conversazione vocale continua. Nessuna modifica all’autenticazione, agli indicatori o alle fonti.

I controlli manuali sono ora chiamati “Opzioni avanzate”; periodo, definizioni e fonti rimangono nella risposta.

Verifica automatica aggiuntiva: node scripts/test-assistant-voice.cjs, con simulazione di risultati cumulativi, callback tardive, errori senza onend, timeout di stop, limite testo, sostituzione audio e pulizia all’uscita. Non sostituisce il collaudo con microfono e altoparlanti reali.

Riferimento tecnico: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition

## Estensione commerciale v53 (candidato, non pubblicato)

Nuove query controllate: leads, quotes, appointments, funnel, lead-management. Stesso accesso CRM e sola lettura. Il catalogo di Gemini è aggiornato; riconoscimento locale di anni espliciti, oggi e questo mese/anno Europe/Rome e continuazioni “E i lead?”, “E i preventivi?”, “E gli appuntamenti?”, “E le conversioni?”. Non si inviano righe, risultati o cronologia al modello. Restano non disponibili filtri individuali e confronti simultanei fra periodi; non ignorarli.

- Lead: data ingresso da timestamp ISO con offset esplicito, Date Google o data italiana rigorosa. La data viene riportata in Europe/Rome; gli istanti UTC rimangono verificabili. Testi senza anno, date impossibili e correzioni automatiche esclusi. Timestamp locali italiani mantengono solo il giorno, senza inventare un istante UTC.
- Fonti lead: Foglio1 per mese corrente, archivi dal catalogo e nomi riconosciuti, Maggio 2025 verificato; giuseppe lead viene letto anche per arrivi precedenti. Ogni mese storico senza archivio dichiarato è unavailable: non dedurre zero. Gli archivi senza header mantengono la prima riga di dati. Righe fuori mese del proprio archivio escluse e segnalate.
- ID: la colonna LEAD ID contiene anche valori non identificativi (struttura disallineata in alcune righe). Solo numeri di 10–30 cifre o UUID formali vengono trattati come ID. Gli altri sono dichiarati non validi; non eliminano richieste distinte. Due ID espliciti diversi restano due richieste, anche con contatto/istante uguali. Lo stesso ID con eventi discordanti è escluso e segnalato. Senza ID si confronta la tupla esatta istante/giorno + email + telefono + nome normalizzati, senza somiglianze; richieste in istanti diversi restano distinte. Copie esatte escluse con riga di riferimento, senza deduplicare semplicemente per persona.
- Preventivi: conteggio delle righe presenti in Make Leads / Preventivi, senza generazione di preventivi da contratti. Copertura storica non certificata: sempre esplicitata come parziale. Non confondere con PREVENTIVI_OPERATIVI, che governa richiami e stato attuale.
- Appuntamenti: eventi APP dei due calendari, per data appuntamento, con SI/NO/pending. Show rate = SI/(SI+NO); pendenti fuori denominatore. Eventi futuri sono programmati, non presenze.
- Feedback attuale: assegnazioni presenti nei sei fogli venditori per data ingresso, con/senza feedback letto oggi. Non persone uniche né stato storico: uno stesso lead assegnato a due venditori non è una sola assegnazione. Nessuna certificazione del momento della chiamata.
- Funnel: rapporti di periodo, numeratore e denominatore visibili, non conversioni di coorte. Contratti da lead secondo Origine; origine mancante impedisce il rapporto completo da lead. Fonti mancanti e denominatore zero → n.d.; su fonti parziali i rapporti sono dichiarati osservati. Non calcolare conversione individuale o per canale usando matching per nome/telefono. Ufficiali e provvisori distinti nei record e richiamati nella sintesi.

Calcoli e tabelle per giorno, mese e canale prodotti dal backend. Fino a 50.000 righe validate per query; oltre il limite nessun totale. Cache server compressa 120 secondi per evitare il limite di dimensione della Data Cache. Le risposte API restituiscono al massimo 500 riferimenti: recordCount è il numero completo già elaborato, presentazione e totali sono calcolati prima del taglio. L’UI indica “500 su N” e invita a restringere il periodo per consultare gli altri record. Nessun totale è dedotto da un campione.

### Verifica reale e anomalie

Lettura in sola lettura del 23/10/2026 di Foglio1 e giuseppe lead: il nuovo adapter, eseguito localmente sui valori letti, trova 1.219 eventi dal 1 al 23 ottobre, 25 il 23 ottobre e 42 il 1 ottobre. Un conteggio indipendente di timestamp ISO e tuple esatte produce gli stessi tre risultati. Sono riscontri datati, non totali da inserire nel prompt. Le anomalie ID e una data non valida rendono il risultato parziale: non è una garanzia di assenza di righe mancanti. Questo test non certifica ancora il deployment Apps Script v53 o una risposta live dell’API aggiornata.

### Scorrimento chat

Prova nel CRM principale con due domande reali (contratti 2025 e “E nel 2024?”): campo fisso su desktop, nessun salto della pagina riprodotto. La correzione evita scrollIntoView sugli antenati, limita lo scorrimento al transcript, fissa il contenitore al viewport e segue visualViewport quando appare la tastiera. Focus con preventScroll; su dispositivi touch non si richiama il focus alla fine di una risposta aprendo nuovamente la tastiera. Da verificare sul dispositivo su cui è stato segnalato il problema.

### Rilascio coordinato

Non sostituire candidate-v52.gs, che resta il riferimento pubblicato. scripts/build-assistant-script.mjs ora genera candidate-v53.gs dalla stessa base verificata, con adapter esteso. Prima aggiornare e collaudare la versione Apps Script dello stesso deployment (URL e permessi invariati), poi frontend. Non creare trigger, non eseguire receiver Infocar o funzioni di scrittura. Rollback: versione 52 Apps Script e frontend PR6. Finché v53 non è pubblicato, le nuove query devono fallire esplicitamente: non ripiegare sui totali o sullo snapshot della dashboard.

### Veicoli venduti e prezzo di riferimento concordato

Scelta esplicita dell’utente: **IMP. FATT.**. Query vehicle-sales: stesse vendite valide dei contratti, descrizione marca-modello e importo fattura individuato dall’intestazione, non da offset fissi. In CAR 2024 la colonna differisce dal 2025: il campo AGENZIA non deve finire nel prezzo. In AD Motor la posizione differisce nuovamente.

Fasce prezzo basate su IMP. FATT.: sotto 10.000 €, 10–15 mila, 15–20 mila, 20–25 mila, 25–30 mila, 30–40 mila, da 40 mila. Confini inferiori inclusi e superiori esclusi. Importi positivi numerici o formati monetari validati rigorosamente; zero, mancanti e valori ambigui fuori dai calcoli, mantenendo il veicolo nei conteggi. Media pesata sui singoli record valorizzati e mediana, con denominatore visibile. Il mese corrente VAL. VENDITA / PROVVIGIONE è escluso dai prezzi perché mescola due concetti.

Classificazione marca solo da prefisso esplicito con alias noti; modello raggruppato per descrizione normalizzata di maiuscole e spazi, senza inventare allestimenti o segmenti. Tabelle marche, top 20 descrizioni modello e fasce. Descrizioni non classificate esplicite. I campi KM e ANNO del prospetto corrente sono nella sezione PERMUTA: non vengono attribuiti al mezzo venduto. Segmento, alimentazione e target/obiettivo futuro di prezzo non sono registrati nelle fonti analizzate.

Domande locali: “Quali auto abbiamo venduto nel 2025?”, “Marche e modelli venduti nel 2026”, “Fasce di prezzo delle auto vendute nel 2025”, “Prezzo medio delle auto vendute nel 2025”. Seguito “E le auto vendute?” conserva il periodo. Voce e chat usano la stessa presentazione server.


## Filtri e memoria conversazionale

Composizione locale: indicatore + venditore + periodo possono comparire in ordini diversi. Esempi equivalenti: “Quanti contratti ha fatto Caironi a dicembre 2025?”, “Caironi quanti contratti ha firmato nel mese di dicembre del 2025?” e “A dicembre 2025 quanti contratti ha concluso Caironi?”. Sono piani contracts, CAIRONI, 2025-12-01–2025-12-31, senza chiamate al modello. Supportati anche contratti da lead, preventivi fatti/preparati/registrati e appuntamenti presi/fissati/registrati. Questo non aggiunge la disponibilità storica delle fonti operative.

“E a novembre?”, “E Pagliara?” e “E nel 2024?” modificano soltanto il parametro richiesto; una nuova domanda autonoma non eredita il vecchio venditore. Un conteggio esplicito successivo elimina una precedente analisi di classifica/confronto. Mese senza anno e indicatore senza periodo chiedono chiarimenti; più mesi/anni non vengono ridotti al primo. Filtri sconosciuti, venditori non configurati e più indicatori nella stessa frase non vengono assorbiti dalla grammatica locale: restano al pianificatore validato. Non sono ancora risposte multiple indipendenti nello stesso turno. Collaudo con dati sintetici nell’API: filtro venditore applicato prima del campione di 500 riferimenti, periodo e parametri mantenuti, nessun numero reale certificato dal solo test.

L’estensione successiva alla PR 7 abilita venditore e, per le auto vendute, marca/modello. I filtri sono visibili in ogni risposta e vengono letti anche dalla voce. Le domande comuni non richiedono Gemini. Il fornitore riceve soltanto domanda e ultimo contesto validato; il cognome del venditore può essere presente. Per i lead di un venditore si contano le assegnazioni conservate nel suo foglio per Data, con copertura storica dichiarata parziale. Non è prova dell’ora di assegnazione o della gestione. Implementazione e collaudo in assistente-car-one-mappa-crm.md. Riusa il backend Apps Script v53 già pubblicato.


## Spunti per ragionare (estensione successiva alla PR 8)

Ogni risposta include fino a due spunti, apribili nella sezione “Spunti per ragionare”: dato osservato, da verificare, azione possibile. Stesse informazioni nella lettura vocale. Generazione deterministica sul risultato validato completo, prima del campione dei riferimenti; nessuna chiamata AI, servizio aggiuntivo o invio di risultati al modello. Non è un’analisi causale o una raccomandazione automatica su persone, budget o acquisti.

Regole: risultato troncato o fonte indisponibile → solo controllo copertura; dati parziali → priorità a esclusioni e omogeneità. Confronti completi possono riprendere una differenza calcolata dal backend; parziali non la trasformano in un segnale certo di crescita/calo. Classifiche → verificare opportunità ricevute prima di giudicare; tassi → denominatori e assenza di coorti. Veicoli → copertura IMP. FATT., media/mediana e dati mancanti per stock/margini. Appuntamenti passati con esito pendente non diventano no-show. Feedback mancante non prova assenza di lavoro.

Seguiti “Cosa emerge?”, “Perché?”, “Cosa dovrei controllare?”, “Quali spunti di ragionamento?” e “Come possiamo migliorare?” ripetono la lettura controllata conservando tutti i filtri; le spiegazioni sono ipotesi da verificare. Questo non introduce il briefing CEO multi-fonte o dati di margine/stock/incasso non ancora collegati. Collaudo: scripts/test-assistant-insights.cjs e regressioni esistenti; includono fonte mancante, storico parziale, risultati troncati, appuntamenti futuri esclusi dagli arretrati e 601 record prima del campione 500.
