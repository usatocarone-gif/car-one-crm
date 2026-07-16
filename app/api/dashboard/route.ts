import { NextResponse } from "next/server";
import { googleIsConfigured, loadGoogleDashboard } from "@/lib/google-dashboard";
import { snapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const payload = googleIsConfigured() ? await loadGoogleDashboard() : snapshot;
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Google dashboard refresh failed", error);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
