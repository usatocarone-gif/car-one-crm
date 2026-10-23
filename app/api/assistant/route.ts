import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticated, readAssistant } from "@/lib/assistant/server";
import { interpretQuestion, validateQuery } from "@/lib/assistant/schema";
import { DEFINITIONS, summarize } from "@/lib/assistant/summary";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store, max-age=0"};
export async function POST(request: Request) {
  if (!authenticated(request)) return NextResponse.json({error:"Accesso CRM richiesto"},{status:401,headers});
  const origin=request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({error:"Origine non consentita"},{status:403,headers});
  let query;
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Formato richiesto: JSON");
    const reader=request.body?.getReader();if(!reader)throw new Error("Domanda mancante");
    let size=0, text=""; const decoder=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new Error("Domanda troppo lunga");}text+=decoder.decode(value,{stream:true});}
    const body=JSON.parse(text+decoder.decode());
    if (body && typeof body === "object" && Object.keys(body).length===1 && typeof body.question==="string") query=interpretQuestion(body.question);
    else query=validateQuery(body);
  } catch(error) { return NextResponse.json({status:"needs-clarification",error:error instanceof Error?error.message:"Domanda non valida"},{status:400,headers}); }
  try {
    const result=await readAssistant(query);
    return NextResponse.json({...result,resultId:randomUUID(),definition:DEFINITIONS[query.kind],summary:summarize(result),filters:"Tutta l’azienda; nessun filtro venditore; Europe/Rome. Date incluse."+(query.kind==="lead-contracts"?" Solo origini lead/digitali riconosciute dal CRM.":"")},{headers});
  } catch {
    // No raw upstream errors, customer data, URLs or API secrets in client/log output.
    return NextResponse.json({status:"unavailable",error:"Fonte assistente non disponibile o versione Apps Script non compatibile. Nessun numero calcolato."},{status:503,headers});
  }
}
