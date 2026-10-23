// Existing CRM Contracts-view rule. Classification uses only the recorded Origin field.
export const LEAD_ORIGIN_KEYWORDS = ["lead", "social", "facebook", "instagram", "tiktok", "sito", "autoscout", "a24", "bdc"];
export function isLeadContractOrigin(origin: string) {
  const value = origin.toLowerCase();
  return LEAD_ORIGIN_KEYWORDS.some(keyword => value.includes(keyword));
}
