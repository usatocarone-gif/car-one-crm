import type { OperationalQuote } from "./types";

export type QuotePriority = "overdue" | "today" | "recent" | "scheduled" | "waiting" | "verify" | "closed";
export const QUOTE_PRIORITY_LABEL: Record<QuotePriority, string> = {
  overdue: "Richiamo scaduto", today: "Da richiamare oggi", recent: "Preventivo di ieri",
  scheduled: "Richiamo programmato", waiting: "Nei tempi", verify: "Aggiornamento da verificare", closed: "Chiuso",
};
export function romeDate(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(now);
}
function shift(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z"); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function businessShift(date: string, days: number, calendar: Record<string, boolean> = {}) {
  let cursor = date, remaining = Math.abs(days);
  while (remaining) {
    cursor = shift(cursor, Math.sign(days));
    const weekday = new Date(cursor + "T12:00:00Z").getUTCDay();
    if (calendar[cursor] ?? (weekday !== 0 && weekday !== 6)) remaining--;
  }
  return cursor;
}
export function quotePriority(item: OperationalQuote, today: string, calendar: Record<string, boolean> = {}): QuotePriority {
  if (["CHIUSO", "VINTO", "PERSO"].includes(item.status.toUpperCase())) return "closed";
  if (!["DA RICHIAMARE", "RICHIAMATO"].includes(item.status)) return "verify";
  if (item.date > today || (item.lastFollowup && item.lastFollowup > today)) return "verify";
  if (item.lastFollowup && (item.lastFollowup < item.date || (item.nextFollowup && item.nextFollowup < item.lastFollowup))) return "verify";
  if (item.nextFollowup) return item.nextFollowup > today ? "scheduled" : item.nextFollowup < today ? "overdue" : "today";
  if (item.status === "RICHIAMATO" && !item.lastFollowup) return "verify";
  const due = businessShift(item.lastFollowup || item.date, 3, calendar);
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (!item.lastFollowup && item.date === businessShift(today, -1, calendar)) return "recent";
  return "waiting";
}
