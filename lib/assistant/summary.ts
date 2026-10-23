import type { AssistantResult } from "./schema";

export const DEFINITIONS = {
  contracts: "Mesi chiusi: registrazioni nel venduto ufficiale, alla data della riga. Mese corrente: registrazioni provvisorie in PROIEZ. REDDITIVITA', con data valida non futura. Le due categorie restano separate. Non sono consegne o fatturato fiscale. Duplicati sospetti esclusi e segnalati.",
  "lead-contracts": "Contratti da lead secondo il campo Origine, come nella vista Contratti del CRM: contiene lead, social, facebook, instagram, tiktok, sito, autoscout, a24 o bdc, senza distinzione maiuscole/minuscole. Nessun abbinamento per cliente. Mesi chiusi: venduto ufficiale; mese corrente: registrazioni provvisorie non future, separate. Origine mancante esclusa e segnalata. Non è il tasso di conversione di una coorte di lead.",
  "agenda-quotes": "Appuntamenti: eventi APP della giornata nei due calendari, deduplicati per ID evento e inizio. Richiami: situazione attuale dei preventivi aperti scaduti o dovuti alla data selezionata, secondo calendario operativo e regola dei tre giorni lavorativi. Non ricostruisce lo stato storico dei preventivi.",
  "lead-quality": "Somma feedback registrati al controllo serale / somma lead in scadenza, solo osservazioni effettive. Le ricostruzioni sono separate ed escluse dal tasso. Assenza di feedback non dimostra assenza di attività; il controllo non prova l'ora del primo contatto.",
};
export function summarize(result: AssistantResult) {
  if (result.truncated) return "Risultato troppo ampio: restringi il periodo. Nessun totale certificabile.";
  const byCategory = new Map<string, number>();
  for (const row of result.rows) byCategory.set(row.category, (byCategory.get(row.category) || 0) + 1);
  const complete = result.sources.length > 0 && result.sources.every(s => s.status === "available");
  const prefix = complete ? "" : "Dati parziali o non disponibili: i valori riguardano soltanto i record validi letti. ";
  if (result.query.kind === "lead-quality") {
    const observed = result.rows.filter(r => r.measurement === "evening-observation");
    const due = observed.reduce((n, r) => n + (r.due || 0), 0);
    const managed = observed.reduce((n, r) => n + (r.managed || 0), 0);
    return prefix + (due ? `${managed} feedback registrati su ${due} lead in scadenza: ${(managed / due * 100).toLocaleString("it-IT", {maximumFractionDigits: 1})}%.` : "Percentuale non disponibile: nessun denominatore osservato valido.");
  }
  if (!result.rows.length) return prefix + (complete ? "Nessun record nel periodo e nei filtri indicati." : "Non è possibile concludere che il risultato sia zero.");
  return prefix + Array.from(byCategory, ([label, count]) => `${label}: ${count}`).join("; ") + ".";
}
