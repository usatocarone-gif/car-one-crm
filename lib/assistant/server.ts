import { gzipSync, gunzipSync } from "node:zlib";
import { timingSafeEqual } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { AssistantQuery, AssistantResult, AssistantRow } from "./schema";
import { validDay } from "./schema";
import { quotePriority } from "../operational-quotes";
import type { OperationalQuote } from "../types";
import { isLeadContractOrigin } from "../contract-origin";

export function authenticated(request: Request) {
  const user = process.env.DASHBOARD_USER, password = process.env.DASHBOARD_PASSWORD;
  if (!user || !password) return false;
  const expected = Buffer.from(`Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`);
  const actual = Buffer.from(request.headers.get("authorization") || "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function safeLink(value: unknown) {
  if (typeof value !== "string") return false;
  try { const u = new URL(value); return u.protocol === "https:" && ["docs.google.com", "calendar.google.com"].includes(u.hostname) && !u.username && !u.password; } catch { return false; }
}
export function normalizeResult(value: unknown, query: AssistantQuery): AssistantResult {
  const raw = value as AssistantResult & { operationalQuotes?: OperationalQuote[]; quoteCalendar?: Record<string, boolean> };
  if (!raw || raw.schemaVersion !== "assistant-v1" || JSON.stringify(raw.query) !== JSON.stringify(query) || !Number.isFinite(Date.parse(raw.generatedAt)) || !Array.isArray(raw.sources) || !raw.sources.length || !Array.isArray(raw.rows) || raw.rows.length > 50000) throw new Error("Formato fonte non supportato");
  const sources = raw.sources.map(s => {
    if (!s || !["available", "partial", "unavailable"].includes(s.status) || typeof s.name !== "string" || typeof s.coverage !== "string" || !Number.isFinite(Date.parse(s.readAt)) || !Array.isArray(s.issues) || s.issues.some(x => typeof x !== "string")) throw new Error("Metadati fonte non validi");
    if(s.dataset!==undefined&&!["leads","quotes","appointments","contracts","management"].includes(s.dataset))throw new Error("Dataset non valido");
    return { dataset:s.dataset, name:s.name, status:s.status, readAt:s.readAt, coverage:s.coverage, issues:s.issues };
  });
  const rows:AssistantRow[] = raw.rows.map(r => {
    if (!r || !validDay(r.date) || r.date < query.from || r.date > query.to || typeof r.seller !== "string" || typeof r.category !== "string" || !["number", "string"].includes(typeof r.value) || (typeof r.value === "number" && !Number.isFinite(r.value)) || !r.evidence || typeof r.evidence.locatorId !== "string" || typeof r.evidence.source !== "string" || !safeLink(r.evidence.url)) throw new Error("Record fonte non valido");
    if (["contracts", "lead-contracts"].includes(query.kind) && (r.value !== 1 || !/^(Contratti registrati|Registrazioni provvisorie) · (Car One|AD Motor)$/.test(r.category) || typeof r.origin !== "string")) throw new Error("Contratto non valido");
    if (query.kind === "lead-contracts" && !isLeadContractOrigin(r.origin || "")) throw new Error("Origine contratto non consentita");
    const metrics=["lead","quote","appointment","contract","management"];
    const newKinds=["leads","quotes","appointments","funnel","lead-management"];
    if (newKinds.includes(query.kind)) {
      const expected:Record<string,string>={leads:"lead",quotes:"quote",appointments:"appointment","lead-management":"management"};
      if(!metrics.includes(r.metric||"") || (expected[query.kind]&&r.metric!==expected[query.kind]) || r.value!==1)throw new Error("Misura fonte non valida");
      if(r.metric==="contract"&&(!/^(Contratti registrati|Registrazioni provvisorie) · (Car One|AD Motor)$/.test(r.category)||typeof r.origin!=="string"))throw new Error("Contratto non valido");
      if(r.metric==="appointment"&&!["presented","no-show","pending"].includes(r.status||""))throw new Error("Esito non valido");
      if(r.metric==="management"&&typeof r.feedback!=="boolean")throw new Error("Feedback non valido");
      if(r.metric==="lead"&&(typeof r.channel!=="string"||(r.arrivedAt!=null&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.arrivedAt)||!Number.isFinite(Date.parse(r.arrivedAt))||new Date(r.arrivedAt).toISOString()!==r.arrivedAt||new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date(r.arrivedAt))!==r.date))))throw new Error("Arrivo lead non valido");
    }
    if (query.kind === "lead-quality" && (!Number.isSafeInteger(r.due) || !Number.isSafeInteger(r.managed) || r.due! < 0 || r.managed! < 0 || r.managed! > r.due! || !["evening-observation", "reconstructed"].includes(r.measurement || ""))) throw new Error("Misurazione non valida");
    return {channel:r.channel,arrivedAt:r.arrivedAt,metric:r.metric,status:r.status,feedback:r.feedback,date:r.date,category:r.category,seller:r.seller,value:r.value,origin:r.origin,due:r.due,managed:r.managed,measurement:r.measurement,evidence:{locatorId:r.evidence.locatorId,url:r.evidence.url,source:r.evidence.source,row:r.evidence.row,fingerprint:r.evidence.fingerprint}};
  });
  if (query.kind === "agenda-quotes" && raw.operationalQuotes) {
    if (!Array.isArray(raw.operationalQuotes) || raw.operationalQuotes.length > 10000) throw new Error("Preventivi non validi");
    const calendar = raw.quoteCalendar || {};
    if (Object.entries(calendar).some(([day, working]) => !validDay(day) || typeof working !== "boolean")) throw new Error("Calendario non valido");
    for (const r of raw.operationalQuotes) {
      if (!r || !r.id || !validDay(r.date) || (r.lastFollowup && !validDay(r.lastFollowup)) || (r.nextFollowup && !validDay(r.nextFollowup)) || typeof r.status !== "string" || typeof r.seller !== "string" || !safeLink(r.url)) throw new Error("Preventivo non valido");
      const priority = quotePriority(r, query.from, calendar);
      if (["today", "overdue", "verify"].includes(priority)) rows.push({date:query.from,category:priority === "verify" ? "Preventivi da verificare (esclusi dai richiami certi)" : "Preventivi da richiamare",seller:r.seller,value:priority === "today" ? "In scadenza" : priority === "overdue" ? "Scaduto" : "Da verificare",origin:undefined,due:undefined,managed:undefined,measurement:undefined,evidence:{locatorId:r.id,url:r.url,source:"Preventivi operativi",row:undefined,fingerprint:undefined}});
    }
  }
  return {schemaVersion:"assistant-v1", query, generatedAt:raw.generatedAt, sources, rows, truncated:!!raw.truncated};
}
const cachedRead = unstable_cache(async (endpoint: string, kind: string, from: string, to: string) => {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) throw new Error("Endpoint Apps Script non valido");
  url.searchParams.set("token", process.env.GOOGLE_APPS_SCRIPT_TOKEN || "");
  url.searchParams.set("action", "assistant");url.searchParams.set("kind",kind);url.searchParams.set("from",from);url.searchParams.set("to",to);
  const response = await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(110000)});
  if (!response.ok) throw new Error("Fonte non disponibile");
  const value = await response.json();
  return gzipSync(JSON.stringify(normalizeResult(value,{kind:kind as AssistantQuery["kind"],from,to}))).toString("base64");
},["assistant-v2-commercial"],{revalidate:120});
export async function readAssistant(query: AssistantQuery) {
  if (!process.env.GOOGLE_APPS_SCRIPT_URL || !process.env.GOOGLE_APPS_SCRIPT_TOKEN) throw new Error("Fonte assistente non configurata");
  const compressed=await cachedRead(process.env.GOOGLE_APPS_SCRIPT_URL,query.kind,query.from,query.to);
  return JSON.parse(gunzipSync(Buffer.from(compressed,"base64")).toString("utf8")) as AssistantResult;
}
