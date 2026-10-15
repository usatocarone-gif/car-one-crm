import type { LeadDailyQualityItem } from "./types";

const NAMES: Record<string, string> = { CAIRONI: "Francesco Caironi", MONACELLI: "Marcello Monacelli", LIGUORI: "Giuseppe Liguori", BORDINI: "Cristiano Bordini", GRANDOLINI: "Paolo Grandolini", PAGLIARA: "Giuseppe Pagliara" };

export function parseLeadDailyQuality(values: unknown[][], now = new Date()): LeadDailyQualityItem[] {
  const expected = ["Chiave giorno-venditore", "Data", "Venditore", "Lead in scadenza", "Feedback al controllo", "Senza feedback al controllo", "Percentuale lavorazione", "Recuperati osservati", "Arretrati aperti", "Controllo UTC", "Qualità misurazione", "Settimana", "Mese"];
  if (values[0]?.join("|") !== expected.join("|")) throw new Error("Schema storico giornaliero non valido");
  const seen = new Set<string>();
  return values.slice(1).filter(r => String(r[0] ?? "").trim()).map(r => {
    const date = String(r[1]), seller = String(r[2]).trim().toUpperCase(), key = date + "|" + seller;
    const due = Number(r[3]), managedWithinDay = Number(r[4]), missingAtDeadline = Number(r[5]);
    if (seen.has(key)) throw new Error("Duplicato nello storico giornaliero");
    seen.add(key);
    const observed = new Date(String(r[9]));
    const note = String(r[10] ?? ""), reconstructed = /ricostru/i.test(note);
    const validCounts = [due, managedWithinDay, missingAtDeadline].every(n => Number.isInteger(n) && n >= 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !NAMES[seller] || !validCounts || managedWithinDay + missingAtDeadline !== due) throw new Error("Consuntivo giornaliero non valido");
    if (!reconstructed) {
      if (!Number.isFinite(observed.valueOf()) || observed > now) throw new Error("Controllo serale non valido");
      const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(observed);
      if (local.slice(0,10) !== date || local.slice(11,16) < "19:05") throw new Error("Controllo fuori dalla giornata di scadenza");
    }
    return { date, seller, name: NAMES[seller], due, managedWithinDay, missingAtDeadline, rate: due ? managedWithinDay / due * 100 : null, recovered: Number(r[7] || 0), backlog: Number(r[8] || 0), measurement: reconstructed ? "reconstructed" as const : "evening-observation" as const, note };
  });
}
