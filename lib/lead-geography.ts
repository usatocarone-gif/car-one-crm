export const LEAD_REGION_CLUSTERS = ["Umbria", "Toscana", "Marche", "Lazio", "Altro"] as const;

export function leadRegionCluster(region: string) {
  return LEAD_REGION_CLUSTERS.find(name => name.toLowerCase() === region.trim().toLowerCase()) ?? "Altro";
}

// Raggruppamento di visualizzazione richiesto dal marketing; le fonti restano invariate.
export function leadCityCluster(city: string) {
  const key = city.trim().toLowerCase().replace(/[().]/g, "").replace(/\s+/g, " ");
  return ["pg", "perugia", "perugia pg"].includes(key) ? "Perugia" : city.trim() || "Non indicata";
}
