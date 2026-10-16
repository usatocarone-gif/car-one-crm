import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// Below Vercel's platform request limit. A larger export must use another transport.
const MAX_BYTES = 4_000_000;
const reply = (body: object, status = 200) => NextResponse.json(body, {status,headers:{"Cache-Control":"no-store"}});

export async function POST(request: NextRequest) {
  const secret = process.env.INFOCAR_RECEIVER_SECRET;
  const target = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!secret || secret.length < 40 || !target) return reply({ok:false,error:"Ricevitore non configurato"},503);
  const received = request.nextUrl.searchParams.get("iw3key") ?? "";
  if (Buffer.byteLength(received) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(received),Buffer.from(secret))) return reply({ok:false,error:"Non autorizzato"},401);
  if (!request.body || Number(request.headers.get("content-length") || 0) > MAX_BYTES) return reply({ok:false,error:"File assente o superiore a 4 MB"},413);
  const chunks: Uint8Array[] = [], reader = request.body.getReader();
  let size=0;
  try {
    for (;;) { const part=await reader.read(); if(part.done)break;size+=part.value.byteLength;if(size>MAX_BYTES){await reader.cancel();return reply({ok:false,error:"Esportazione superiore a 4 MB: serve un altro trasporto"},413);}chunks.push(part.value); }
    const bytes = Buffer.concat(chunks);
    const type = request.headers.get("content-type") || "application/octet-stream";
    let file: Uint8Array = bytes;
    if (/multipart\/form-data|application\/x-www-form-urlencoded/i.test(type)) {
      const parsed = await new Request(request.url,{method:"POST",headers:{"Content-Type":type},body:bytes}).formData();
      const candidates: Uint8Array[]=[];
      for(const [name,value] of parsed.entries()) {
        if(name === "iw3key")continue;
        if(typeof value !== "string" && value.size)candidates.push(new Uint8Array(await value.arrayBuffer()));
        else if(typeof value === "string" && /^\s*(?:<\?xml|<Archivio_Preventivi)/.test(value))candidates.push(new TextEncoder().encode(value));
      }
      if(candidates.length!==1)return reply({ok:false,error:"Inviare un solo file XML"},400);
      file=candidates[0];
    } else if (!/^(?:application\/(?:xml|octet-stream)|text\/(?:xml|plain))(?:;|$)/i.test(type)) return reply({ok:false,error:"Formato non supportato"},415);
    const prefix=Buffer.from(file.subarray(0,256)).toString("latin1");
    const declared=prefix.match(/<\?xml[^>]*encoding=["']([^"']+)/i)?.[1]?.toLowerCase();
    const encoding=file[0]===255&&file[1]===254?"utf-16le":file[0]===254&&file[1]===255?"utf-16be":declared || "utf-8";
    if(!["utf-8","utf8","windows-1252","iso-8859-1","utf-16le","utf-16be"].includes(encoding)) return reply({ok:false,error:"Codifica XML non supportata"},415);
    const xml=new TextDecoder(encoding,{fatal:true}).decode(file).replace(/^\uFEFF/,"").replace(/(<\?xml[^>]*encoding=)["'][^"']+["']/i,'$1"UTF-8"');
    if(!/^\s*(?:<\?xml|<Archivio_Preventivi)/.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml))return reply({ok:false,error:"File XML non valido"},400);
    const destination=new URL(target);destination.searchParams.set("iw3key",secret);
    const response=await fetch(destination,{method:"POST",headers:{"Content-Type":"application/xml; charset=utf-8"},body:xml,cache:"no-store",redirect:"follow",signal:AbortSignal.timeout(45_000)});
    if(!response.ok)return reply({ok:false,error:"Ricevitore Google temporaneamente non disponibile"},502);
    const result=await response.json();
    if(result.ok!==true)return reply({ok:false,error:"Importazione rifiutata dal controllo Google"},422);
    return reply({ok:true,mode:result.mode,received:result.received,counts:result.counts,written:result.written});
  } catch {
    // Do not log URLs (contain a credential), payloads, upstream errors or customer data.
    return reply({ok:false,error:"Impossibile elaborare il file: verificare formato e collegamento"},502);
  } finally { reader.releaseLock(); }
}
