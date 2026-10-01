import type { LeadItem } from "@/lib/types";
import { LEAD_SCORING_CONFIG } from "./config";

export type LeadTemperature = "CALDO" | "TIEPIDO" | "FREDDO";
export type LeadNextAction = "Contattare" | "Ricontattare" | "Confermare appuntamento" | "Follow-up" | "Nessuna azione";
export type LeadOperationalStatus = "Da lavorare" | "Lavorato" | "Appuntamento" | "No-show" | "Show" | "Preventivo" | "Contratto";

export type LeadScoreResult = {
  score: number;
  temperature: LeadTemperature;
  reasons: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function hasNormalizedValue(values: readonly string[], candidate: string) {
  const normalizedCandidate = normalize(candidate);
  return values.some((value) => normalize(value) === normalizedCandidate);
}

export function isZicLead(lead: LeadItem) {
  return hasNormalizedValue(LEAD_SCORING_CONFIG.zic.regions, lead.region)
    || hasNormalizedValue(LEAD_SCORING_CONFIG.zic.provinces, lead.province)
    || hasNormalizedValue(LEAD_SCORING_CONFIG.zic.cities, lead.city);
}

function interestLevel(interest: string): "specific" | "generic" | "none" {
  const normalizedInterest = normalize(interest);
  if (!normalizedInterest) return "none";
  if (LEAD_SCORING_CONFIG.genericInterests.some((value) => normalize(value) === normalizedInterest)) return "generic";
  return "specific";
}

export function getLeadTemperature(score: number): LeadTemperature {
  if (score >= LEAD_SCORING_CONFIG.temperatures.hot) return "CALDO";
  if (score >= LEAD_SCORING_CONFIG.temperatures.warm) return "TIEPIDO";
  return "FREDDO";
}

export function calculateLeadScore(lead: LeadItem): LeadScoreResult {
  const { weights } = LEAD_SCORING_CONFIG;
  const reasons: string[] = [];
  let rawScore = 0;

  if (isZicLead(lead)) {
    rawScore += weights.zic;
    reasons.push("zona ZIC");
  }

  const interest = interestLevel(lead.interest);
  if (interest === "specific") {
    rawScore += weights.specificInterest;
    reasons.push("auto specifica");
  } else if (interest === "generic") {
    rawScore += weights.genericInterest;
    reasons.push("interesse auto generico");
  }

  if (lead.appointment) {
    rawScore += weights.appointment;
    reasons.push("appuntamento presente");
  }
  if (lead.show) {
    rawScore += weights.show;
    reasons.push("show confermato");
  }
  if (lead.quote) {
    rawScore += weights.quote;
    reasons.push("preventivo presente");
  }
  if (lead.contract) {
    rawScore += weights.contract;
    reasons.push("contratto presente");
  }

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  return { score, temperature: getLeadTemperature(score), reasons };
}

export function getLeadOperationalStatus(lead: LeadItem): LeadOperationalStatus {
  if (lead.contract) return "Contratto";
  if (lead.quote) return "Preventivo";
  if (lead.show) return "Show";
  if (lead.appointmentStatus === "no-show") return "No-show";
  if (lead.appointment) return "Appuntamento";
  if (lead.managed) return "Lavorato";
  return "Da lavorare";
}

export function getNextLeadAction(lead: LeadItem): LeadNextAction {
  if (lead.contract) return "Nessuna azione";
  if (lead.appointmentStatus === "no-show") return "Ricontattare";
  if (lead.appointment && !lead.show) return "Confermare appuntamento";
  if (lead.quote || lead.show) return "Follow-up";
  if (lead.managed) return "Ricontattare";
  return "Contattare";
}
