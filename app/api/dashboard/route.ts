import { NextRequest, NextResponse } from "next/server";
import { googleIsConfigured, loadGoogleDashboard } from "@/lib/google-dashboard";
import { snapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  if (!googleIsConfigured()) {
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const dashboard = await loadGoogleDashboard();
    return NextResponse.json(dashboard, { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Google dashboard sync failed", error);
    return NextResponse.json({ ...snapshot, warning: "Sincronizzazione Google non riuscita: visualizzato l’ultimo snapshot." }, { status: 200 });
  }
}
