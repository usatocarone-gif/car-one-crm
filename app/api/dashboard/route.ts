import { NextResponse } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { gzipSync, gunzipSync } from "node:zlib";
import { googleIsConfigured, loadGoogleDashboard, loadGoogleLeadDailyQuality } from "@/lib/google-dashboard";
import { snapshot } from "@/lib/snapshot";
import { resolveItalianGeo } from "@/lib/italian-geo";
import type { DashboardPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function enrichLeadHistory(payload: DashboardPayload) {
  return {
    ...payload,
    leadHistory: (payload.leadHistory ?? []).map((item) => ({
      ...item,
      ...resolveItalianGeo(item.city),
    })),
    leadItems: payload.leadItems?.map((item) => ({
      ...item,
      ...resolveItalianGeo(item.city),
    })),
  };
}

let inFlight: Promise<DashboardPayload> | undefined;

async function loadFreshDashboard(): Promise<DashboardPayload> {
    const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const appsScriptToken = process.env.GOOGLE_APPS_SCRIPT_TOKEN;
    let payload = snapshot;

    if (appsScriptUrl && appsScriptToken) {
      const separator = appsScriptUrl.includes("?") ? "&" : "?";
      const response = await fetch(`${appsScriptUrl}${separator}token=${encodeURIComponent(appsScriptToken)}`, {
        cache: "no-store",
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
      const dashboard = await response.json();
      if (dashboard.error) throw new Error(String(dashboard.error));
      if (!dashboard.periods || !Number.isFinite(Date.parse(dashboard.lastUpdated))) {
        throw new Error("Risposta dashboard Google non valida");
      }
      payload = dashboard;
    } else if (googleIsConfigured()) {
      payload = await loadGoogleDashboard();
    }

    const result: DashboardPayload = { ...payload };
    if (result.leadDailyQuality === undefined && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      try {
        result.leadDailyQuality = await loadGoogleLeadDailyQuality();
        delete result.leadDailyQualityError;
      } catch {
        // Un errore dello storico non deve sostituire tutti i dati live con lo snapshot.
        result.leadDailyQuality = undefined;
        result.leadDailyQualityError = "Storico del primo giorno non disponibile: verificare collegamento e accesso al database commerciale.";
      }
    }
    return enrichLeadHistory(result);
}

function loadOnce() {
  if (!inFlight) {
    inFlight = loadFreshDashboard().finally(() => { inFlight = undefined; });
  }
  return inFlight;
}

// Server-only Data Cache: never put customer data in the public CDN cache.
// Compression keeps the complete historical payload below cache item limits.
const cachedDashboard = unstable_cache(async (_source: string) => {
  const payload = await loadOnce();
  return gzipSync(JSON.stringify(payload)).toString("base64");
}, ["crm-dashboard-v1"], { revalidate: 120, tags: ["crm-dashboard"] });

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("refresh") === "1") {
      revalidateTag("crm-dashboard");
      // Invalidation is committed after the response. Do not repopulate that
      // same cache inside this request, or the fresh entry is invalidated too.
      return NextResponse.json(await loadOnce(), {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    const compressed = await cachedDashboard(process.env.GOOGLE_APPS_SCRIPT_URL || "direct-google");
    const payload = JSON.parse(gunzipSync(Buffer.from(compressed, "base64")).toString("utf8"));
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Google dashboard refresh failed", error);
    return NextResponse.json({ error: "Aggiornamento Google non disponibile. Mantengo l’ultimo dato valido." }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
