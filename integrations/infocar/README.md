# Ricezione preventivi Infocar → Google Sheets

Modulo aggiuntivo per il progetto Apps Script esistente `car one crm`.
Non sostituisce `doGet`, le credenziali del CRM o le funzioni precedenti.
Il ricevitore rimane **disabilitato** finché non sono configurate le proprietà sotto.

## Configurazione dopo approvazione

Nelle proprietà dello script, senza inserire segreti nel codice o in Git:

| Proprietà | Valore |
|---|---|
| `IW3_RECEIVER_SECRET` | Segreto casuale dedicato di almeno 40 caratteri |
| `IW3_RECEIVER_MODE` | `preview` per il primo invio; `active` solo dopo verifica |
| `IW3_ACCOUNT_AND_SELLERS_CONFIRMED` | `TRUE` dopo verifica XML reale e concessionaria |
| `IW3_MORNING_COMPATIBLE` | `TRUE` dopo aggiornamento e verifica del codice Make |

Destinazione Infocar: `https://<dominio-produzione-crm>/api/integrations/infocar?iw3key=<segreto>`.
Impostare lo stesso segreto dedicato nella variabile Vercel di produzione
`INFOCAR_RECEIVER_SECRET`; `GOOGLE_APPS_SCRIPT_URL` resta quello già configurato.
Il gateway del CRM decodifica il file (anche Windows-1252) e inoltra XML UTF-8
all'applicazione Google. Non usare direttamente Google per gli allegati multipart:
nelle prove reali il relativo evento non espone né il corpo né il file.
Il link è una credenziale di sola ricezione: non pubblicarlo o salvarlo nel repository.
La risposta non espone dati clienti. `GET` resta protetto dal token preesistente.

Su Infocar: **Esportazione Completa → Standard → Preventivi → Http**.
Nome file proposto: `preventivi.xml`. Verificare il primo trasferimento prima di programmare quello serale.

Il trasporto effettivo di Infocar non è stato ancora osservato: sono accettati XML raw,
un singolo allegato multipart e XML in campo form. XML ZIP/base64 o codifiche
che producono caratteri sostitutivi sono rifiutati, non interpretati arbitrariamente.
Il gateway accetta al massimo **4.000.000 byte**, sotto il limite di richiesta Vercel.
Prima di attivare l'esportazione completa verificare la dimensione di un file reale:
se lo supera, questo trasporto non è adatto e occorre una ricezione FTP o equivalente.
Il gateway non conserva il file. Le pagine CRM mantengono l'autenticazione precedente;
solo questo esatto endpoint POST usa la credenziale dedicata (assente → HTTP 503).
Gli errori del gateway hanno codici HTTP 4xx/5xx. Apps Script restituisce invece gli esiti
applicativi in JSON: verificare `ok`, non soltanto HTTP 200. Il gateway segue
i redirect del Content Service Google; la compatibilità resta da provare con Infocar.

## Dati e idempotenza

- Identificativo operativo nuovo: `iw3:carone:<codpreventivo>`; ID conservati come stringhe.
- Cutoff letto da `CONFIGURAZIONE.preventivi_da_data`.
- I codici venditore sono quelli osservati nel filtro della sessione Car One;
  vanno confermati sul primo XML, perché il manuale parla di codice comune funzionario.
- `14721` corrisponde a Rossi Massimo in Infocar e alla scheda operativa `PREV_Rossi`
  utilizzata da Pagliara. Fornaciari e codici sconosciuti non sono assegnati automaticamente.
- Un ID già presente non viene aggiunto nuovamente. Un ID presente nel centrale ma
  assente nella scheda personale viene ripristinato nella scheda senza perdere feedback.
- Un preventivo con stesso cliente/giorno/venditore già caricato manualmente viene
  classificato da verificare; nessuna fusione automatica per solo nominativo.
- Note, stato e date di richiamo esistenti non vengono mai sovrascritti.
- Nuovi contratti, ritiri ed eliminazioni non diventano richiami aperti.
- Nessuna cancellazione automatica se un record scompare dall'esportazione.
- Gli aggiornamenti dello stato Infocar restano separati in `IW3_RICEZIONI`:
  non sostituiscono lo stato operativo dei venditori. Non esiste ancora una regola
  automatica che chiuda una trattativa personale già presente quando diventa contratto.
- La scheda tecnica viene creata soltanto in modalità active, con protezione proprietario.
- Il lock serializza le ricezioni Apps Script. Make non usa lo stesso lock:
  programmare l'esportazione lontano dalle 09:00 e dalle esecuzioni manuali del briefing.
  Le scritture su più schede non sono atomiche: il retry ripara i record grazie all'ID.

## Verifica

`node --test integrations/infocar/receiver.test.cjs`

`node --test integrations/infocar/gateway.test.cjs`

I test usano solo dati sintetici. Il parser XML locale di test usa Python ElementTree
come adattatore; la prova online `verificaRicevitoreInfocar` verifica XmlService
e la lettura reale del database senza scrivere dati o creare credenziali.

## Crediti

Ricezione ed elaborazione eseguite in Apps Script: nessuna operazione Make aggiuntiva.
Il briefing usa le letture Google già esistenti; il suo codice deve mantenere anche
le righe `iw3:carone:` del registro centrale, assenti dal vecchio file manuale.
Restano applicabili le quote Google Apps Script, da misurare sul file reale.
