import { NextResponse } from "next/server";
import { googleIsConfigured, loadGoogleDashboard } from "@/lib/google-dashboard";
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
  };
}

export async function GET() {
  try {
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
      payload = dashboard;
    } else if (googleIsConfigured()) {
      payload = await loadGoogleDashboard();
    }

    return NextResponse.json(enrichLeadHistory(payload as DashboardPayload), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Google dashboard refresh failed", error);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
