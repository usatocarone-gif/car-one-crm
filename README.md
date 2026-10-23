# Car One CRM

MVP della dashboard commerciale per il concessionario usato Car One.

## Assistente Car One (pilota non rilasciato)

Implementazione in sola lettura, tre interrogazioni controllate, accesso CRM esistente e nessun servizio AI o vocale attivo. Regole degli indicatori, copertura, test e passaggi di rilascio: [documentazione del pilota](docs/assistente-car-one.md).

La base Apps Script verificata è `integrations/apps-script/published-v51.gs`. I file API V4–V7 sono versioni storiche. Il candidato si genera con `node scripts/build-assistant-script.mjs`; generarlo non effettua il deployment.

## Funzioni disponibili

- viste Oggi, Settimana e Mese & forecast;
- obiettivi settimanali e mensili;
- contratti combinati da `CAR 2026` e `AD MOTOR 2026`;
- lead da Google Sheets;
- appuntamenti `APP` da Google Calendar;
- performance venditori;
- analisi canali a coorte con lead, appuntamenti, preventivi e contratti;
- funnel separato per preventivi diretti;
- fallback automatico su snapshot verificato quando Google non è configurato.

## Avvio locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aprire `http://localhost:3000`.

## Collegamento Google

1. Creare un service account in Google Cloud.
2. Abilitare Google Sheets API e Google Calendar API.
3. Condividere i due fogli e il calendario `Car One Usato` con l’email del service account in sola lettura.
4. Inserire le variabili di `.env.example` in `.env.local` o nell’ambiente di hosting.

Le credenziali restano server-side e non vengono inviate al browser.

## Fonti

- Lead: `Make Leads` → `Foglio1`
- Contratti: `VENDUTO CAR ONE 2024 - 2025 - 2026` → `CAR 2026` e `AD MOTOR 2026`
- Appuntamenti: Google Calendar `Car One Usato`, eventi contenenti `APP`
