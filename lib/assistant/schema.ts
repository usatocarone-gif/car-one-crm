export type QueryKind = "contracts" | "lead-contracts" | "agenda-quotes" | "lead-quality" | "leads" | "quotes" | "appointments" | "funnel" | "lead-management";
export type AssistantQuery = { kind: QueryKind; from: string; to: string };
export type Evidence = { locatorId: string; url: string; source: string; row?: number; fingerprint?: string };
export type SourceCoverage = {
  dataset?: "leads" | "quotes" | "appointments" | "contracts" | "management";
  name: string; status: "available" | "partial" | "unavailable"; readAt: string;
  coverage: string; issues: string[];
};
export type AssistantRow = {
  date: string; category: string; seller: string; value: string | number;
  channel?: string; arrivedAt?: string; metric?: "lead" | "quote" | "appointment" | "contract" | "management"; status?: string; feedback?: boolean;
  origin?: string; due?: number; managed?: number; measurement?: string; evidence: Evidence;
};
export type AssistantResult = {
  schemaVersion: "assistant-v1"; query: AssistantQuery; generatedAt: string;
  sources: SourceCoverage[]; rows: AssistantRow[]; truncated: boolean;
};
export function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === value;
}
export function validateQuery(input: unknown): AssistantQuery {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Domanda non valida");
  const q = input as Record<string, unknown>;
  if (Object.keys(q).some(k => !["kind", "from", "to"].includes(k))) throw new Error("Parametri non consentiti");
  if (!["contracts", "lead-contracts", "agenda-quotes", "lead-quality", "leads", "quotes", "appointments", "funnel", "lead-management"].includes(String(q.kind))) throw new Error("Indicatore non supportato");
  if (!validDay(q.from) || !validDay(q.to) || q.to < q.from) throw new Error("Usa date reali AAAA-MM-GG, dalla minore alla maggiore");
  if ((Date.parse(q.to) - Date.parse(q.from)) / 86400000 > 366) throw new Error("Seleziona al massimo 367 giorni");
  if (q.kind === "agenda-quotes" && q.from !== q.to) throw new Error("Per agenda e richiami seleziona una sola giornata");
  return { kind: q.kind as QueryKind, from: q.from, to: q.to };
}

// Common explicit questions stay local; the server validates every plan.
export function interpretQuestion(text: string, now=new Date()): AssistantQuery {
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(now);
  text=text.replace(/\bquesto mese\b/gi,`dal ${today.slice(0,7)}-01 al ${today}`).replace(/\bquest[’']anno\b/gi,`dal ${today.slice(0,4)}-01-01 al ${today}`).replace(/\boggi\b/gi,`il ${today}`);
  if (!text || text.length > 600) throw new Error("Scrivi una domanda entro 600 caratteri");
  const lower = text.toLowerCase().trim().replace(/[?!.]+$/, "").replace(/\s+/g," ");
  const iso = "\\d{4}-\\d{2}-\\d{2}";
  let kind: QueryKind;
  const contracts = new RegExp(`^quanti contratti(?: registrati)?(?: (?:da|con origine) lead)?(?: abbiamo| sono)? (?:nel 20\\d{2}|dal ${iso} al ${iso}|il ${iso})(?: divisi tra car one e ad motor)?$`);
  const agenda = new RegExp(`^(?:mostrami )?(?:gli )?appuntamenti e (?:i )?preventivi da richiamare il ${iso}$`);
  const quality = new RegExp(`^(?:qual è la percentuale di )?lead gestiti il primo giorno dal ${iso} al ${iso}$`);
  if (contracts.test(lower)) kind = /(?:da|con origine) lead/.test(lower) ? "lead-contracts" : "contracts";
  else if (agenda.test(lower)) kind = "agenda-quotes";
  else if (quality.test(lower)) kind = "lead-quality";
  else {
    const time = `(?:nel 20\\d{2}|dal ${iso} al ${iso}|il ${iso})`;
    const patterns: [QueryKind,RegExp][] = [
      ["leads",new RegExp(`^(?:quanti lead(?: abbiamo)?(?: ricevuto| sono arrivati)?|(?:mostrami )?(?:i )?lead(?: ricevuti| arrivati)?) ${time}(?: (?:divisi per canale|giorno per giorno|mese per mese))?$`)],
      ["quotes",new RegExp(`^(?:quanti preventivi(?: abbiamo| registrati)?|(?:mostrami )?(?:i )?preventivi) ${time}$`)],
      ["appointments",new RegExp(`^(?:quanti appuntamenti(?: abbiamo)?|(?:mostrami )?(?:gli )?appuntamenti(?: e (?:gli )?esiti)?) ${time}$`)],
      ["funnel",new RegExp(`^(?:mostrami il funnel|funnel|tassi di conversione|qual è il tasso di conversione) ${time}$`)],
      ["lead-management",new RegExp(`^(?:quanti lead hanno un feedback|gestione lead|lead con e senza feedback) ${time}$`)],
    ];
    const matched=patterns.find(([,pattern])=>pattern.test(lower));
    if(!matched)throw new Error("Specifica indicatore e periodo. Filtri non disponibili non vengono ignorati.");
    kind=matched[0];
  }
  const dates = text.match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (dates.length > 2) throw new Error("Indica un solo periodo");
  if (!dates.length) {
    const years = text.match(/\b20\d{2}\b/g) || [];
    if (years.length !== 1) throw new Error("Specifica il periodo con date AAAA-MM-GG, oppure selezionalo nei controlli.");
    return validateQuery({kind: kind, from: `${years[0]}-01-01`, to: `${years[0]}-12-31`});
  }
  return validateQuery({kind: kind, from: dates[0], to: dates[1] || dates[0]});
}
