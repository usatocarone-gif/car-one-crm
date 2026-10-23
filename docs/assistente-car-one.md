# Assistente Car One — pilota in sola lettura

Stato 23 ottobre 2026: implementato su branch feat/assistant-readonly; rilascio da verificare. Nessun servizio acquistato, nessun dato di produzione modificato, nessun fornitore AI chiamato. L'accesso condiviso del CRM rimane richiesto. Nessuna separazione per venditore nel pilota.

## Base pubblicata verificata

Dal pannello Gestisci deployment Apps Script è attiva la versione 51 del 21 ottobre 2026, ore 18:29 (orario dell'interfaccia). Descrizione: “Report: lead tutti i giorni incluse domeniche; medie lun-sab; planning facoltativo”. Il codice di Cronologia progetto → Versione 51 è stato copiato e confrontato integralmente con l'editor: identico, 93.117 caratteri. Conservato in integrations/apps-script/published-v51.gs; il vecchio file API V7 è storico, non la base corrente.

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
| Duplicati sospetti contratti | Stessa data, cliente, modello, venditore e società: tutte le occorrenze escluse, con avviso e righe da controllare. È un controllo conservativo, non una dimostrazione di identità contrattuale; due acquisti veri simili richiedono un ID contratto. |
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

Scelta del pilota: nessun modello, costo API AI zero; rimangono consumi dell'hosting e quote Google. L'architettura è pronta per un interprete che restituisce soltanto kind/from/to, sempre rivalidati.

Candidato successivo da collaudare: GPT-5.6 Terra, supporto function calling e structured outputs, prezzo consultato $2/M token input e $12/M output. Non attivato. Riferimento: https://developers.openai.com/api/docs/models/gpt-5.6-terra . Non serve un modello per fare somme. La scelta finale dipende da test di interpretazione in italiano, latenza e costo misurato; per ora il pilota evita del tutto tali chiamate.

Configurazione futura: chiave dedicata solo variabile server, progetto con limite di spesa, output limitato, niente NEXT_PUBLIC, nessuna chiave nei fogli/browser/log. Al modello solo domanda e schema delle funzioni, senza esportare database, nominativi, telefoni, email o note clienti. Anche una domanda scritta dall'utente può contenere dati personali: minimizzazione e oscuramento da collaudare prima dell'attivazione. Nessuna memoria di conversazione persistente necessaria per queste tre domande.

I dati API OpenAI non sono usati per addestramento per impostazione predefinita; ciò non significa assenza di conservazione. I log di monitoraggio possono essere conservati fino a 30 giorni e si applicano condizioni/limiti per endpoint e controlli speciali. store:false non equivale a Zero Data Retention. Verificare account, configurazione, informativa e trattamento prima dell'invio di dati aziendali reali. Riferimento: https://developers.openai.com/api/docs/guides/your-data .

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
