const {readFileSync}=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const modules={};
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>imports[n]||modules[n]||require(n),Buffer,URL,Date,Intl,AbortSignal,process,TextDecoder,Response,Request,...globals});return exports;}
const schema=modules['./schema']=modules['@/lib/assistant/schema']=load('lib/assistant/schema.ts');
const vehicles=modules['./vehicles']=load('lib/assistant/vehicles.ts');
const filters=modules['./filters']=modules['@/lib/assistant/filters']=load('lib/assistant/filters.ts');
modules['./conversation']=load('lib/assistant/conversation.ts');
modules['../contract-origin']=load('lib/contract-origin.ts');
modules['./analytics']=load('lib/assistant/analytics.ts');
modules['./insights']=load('lib/assistant/insights.ts');
const summary=modules['@/lib/assistant/summary']=load('lib/assistant/summary.ts');
const now=new Date('2026-10-23T12:00:00Z'),plain=v=>JSON.parse(JSON.stringify(v));
const parse=(s,ctx)=>modules['./conversation'].localConversation(s,ctx,now);
const sold=parse('Quante Alfa Romeo Stelvio abbiamo venduto nel 2026?');
assert.deepEqual(plain(sold),{kind:'vehicle-sales',from:'2026-01-01',to:'2026-12-31',brand:'Alfa Romeo',model:'STELVIO'});
const leads=parse('Quanti lead ha ricevuto Caironi a settembre 2026?');
const caironiDecember={kind:'contracts',from:'2025-12-01',to:'2025-12-31',seller:'CAIRONI'};
for(const question of [
 'Quanti contratti ha fatto Caironi a dicembre 2025?',
 'Caironi quanti contratti ha firmato nel mese di dicembre del 2025?',
 'A dicembre 2025 quanti contratti ha concluso Caironi?',
 'Quanti contratti nel mese di dicembre 2025 ha registrato Caironi?',
 'Quanti contratti di Caironi durante il mese di dicembre del 2025?',
])assert.deepEqual(plain(parse(question)),caironiDecember,question);
for(const seller of schema.ASSISTANT_SELLERS)assert.deepEqual(plain(parse(`Quanti contratti ha fatto ${seller} a dicembre 2025?`)),{...caironiDecember,seller});
assert.deepEqual(plain(parse('E a novembre?',caironiDecember)),{...caironiDecember,from:'2025-11-01',to:'2025-11-30'});
assert.deepEqual(plain(parse('E Pagliara?',caironiDecember)),{...caironiDecember,seller:'PAGLIARA'});
assert.deepEqual(plain(parse('E nel 2024?',caironiDecember)),{...caironiDecember,from:'2024-12-01',to:'2024-12-31'});
assert.equal(parse('Quanti contratti da lead ha fatto Caironi a dicembre 2025?').kind,'lead-contracts');
assert.equal(parse('Quanti appuntamenti ha preso Caironi a dicembre 2025?').kind,'appointments');
assert.equal(parse('Quanti appuntamenti ha fissato Caironi a dicembre 2025?').kind,'appointments');
assert.equal(parse('Quanti preventivi ha preparato Caironi a dicembre 2025?').kind,'quotes');
assert.throws(()=>parse('Quanti contratti ha fatto Caironi?'),/Per quale periodo/);
assert.throws(()=>parse('Quanti contratti ha fatto Caironi a dicembre?'),/Di quale anno/);
assert.throws(()=>parse('Quanti contratti ha fatto Caironi a dicembre 2025 e gennaio 2026?'),/un solo periodo/);
assert.equal(parse('Confronta i contratti del 2025 rispetto al 2026'),undefined);
assert.equal(parse('Quanti contratti ha fatto Caironi dal 01/12/2025 al 31/12/2025?'),undefined);
assert.equal(parse('Quanti contratti ha fatto Caironi da gennaio a marzo 2025?'),undefined);
assert.throws(()=>parse('Quanti contratti ha fatto Caironi a dicembre del 2027?'),/2024 al 2026/);
assert.equal(parse('Quanti contratti ha fatto Caironi a dicembre 2025 solo Facebook?'),undefined);
assert.equal(parse('Quanti contratti ha fatto Rossi a dicembre 2025?'),undefined);
assert.equal(parse('Quanti contratti e preventivi ha fatto Caironi a dicembre 2025?'),undefined);
assert.equal(parse('Quanti contratti abbiamo fatto a dicembre 2025?',caironiDecember).seller,undefined);
assert.deepEqual(plain(parse('E quanti preventivi ha fatto?',{...caironiDecember,analysis:'seller-ranking'})),{...caironiDecember,kind:'quotes'});
assert.deepEqual(plain(leads),{kind:'leads',from:'2026-09-01',to:'2026-09-30',seller:'CAIRONI'});
assert.equal(parse('Quante Alfa Romeo Stelvio ha venduto Caironi nel 2026?').seller,'CAIRONI');
let follow=parse('E nel 2025?',sold);assert.equal(follow.brand,sold.brand);assert.equal(follow.model,sold.model);assert.equal(follow.to,'2025-12-31');
assert.deepEqual(plain(parse('A che prezzo medio?',follow)),plain(follow));
assert.equal(parse('Chi le ha vendute?',follow).analysis,'seller-ranking');assert.equal(parse('Chi le ha vendute?',follow).model,follow.model);
follow=parse('E Pagliara?',leads);assert.equal(follow.seller,'PAGLIARA');assert.equal(follow.from,'2026-09-01');
follow=parse('E ad agosto?',leads);assert.equal(follow.from,'2026-08-01');
follow=parse('E ad agosto 2026?',leads);assert.equal(follow.to,'2026-08-31');
follow=parse('E agosto?',leads);assert.equal(follow.from,'2026-08-01');assert.equal(follow.to,'2026-08-31');assert.equal(follow.seller,'CAIRONI');
assert.equal(parse('E nel 2025?',leads).from,'2025-09-01');
assert.equal(parse('E le Fiat Panda?',sold).brand,'Fiat');assert.equal(parse('E le Fiat?',sold).model,undefined);
assert.equal(parse('Quanti lead abbiamo ricevuto nel 2026?',sold).brand,undefined); // independent topic resets
assert.equal(parse('E tutti i venditori?',{...sold,seller:'CAIRONI'}).seller,undefined);
for(const q of ['Quante Alfa Romeo Stelvio abbiamo venduto nel 2026 sotto 20000 euro?','Quanti lead di Caironi nel 2026 esclusi Facebook?','Quanti lead di Caironi e Pagliara a settembre 2026?','Quanti lead di Caironi a settembre?']){
 let rejected=false;try{rejected=!parse(q);}catch{rejected=true;}assert.ok(rejected,q);
}
assert.throws(()=>parse('E nel 2025?',{kind:'vehicle-sales',from:'2024-02-29',to:'2024-02-29'}));
for(const extra of [{seller:'Rossi'},{seller:'CAIRONI',kind:'funnel'},{brand:'Fiat',kind:'leads'},{brand:'UNKNOWN'},{model:'.*'},{sql:'SELECT 1'},{model:'x'.repeat(81)}])assert.throws(()=>schema.validateQuery({...sold,...extra}));
const ev=i=>({locatorId:'row-'+i,source:'CAR',url:'https://docs.google.com/spreadsheets/d/test#range=A'+i});
const row=(vehicle,seller='CAIRONI',invoiceAmount=10000,i=1)=>({date:'2026-09-01',category:'Contratti registrati · Car One',seller,value:1,origin:'Lead',vehicle,invoiceAmount,evidence:ev(i)});
const result={schemaVersion:'assistant-v1',query:{kind:'vehicle-sales',from:'2026-01-01',to:'2026-12-31'},generatedAt:now.toISOString(),sources:[{name:'CAR',status:'available',readAt:now.toISOString(),coverage:'test',issues:[]}],rows:[row('ALFA ROMEO STELVIO 2.2'),row('Alfa Romeo Stelvio Q4','PAGLIARA',30000,2),row('ALFA ROMEO GIULIA','CAIRONI',50000,3),row('FIAT PANDA','CAIRONI',5000,4)],truncated:false};
let subset=filters.filterResult(result,sold);assert.equal(subset.rows.length,2);
assert.equal(summary.presentResult(subset).metrics.find(m=>m.label.startsWith('Prezzo medio')).value,'20.000 €');
assert.equal(summary.presentResult(subset).tables.find(t=>t.title==='Veicoli per venditore').rows.length,2);
assert.equal(filters.filterResult(result,{...sold,seller:'CAIRONI'}).rows.length,1);
assert.equal(filters.filterResult({...result,rows:[row('FIAT 500X'),row('FIAT 500')]},{...sold,brand:'Fiat',model:'500'}).rows.length,1);
assert.equal(filters.filterResult({...result,rows:[row('VW GOLF')]},{...sold,brand:'Volkswagen',model:'GOLF'}).rows.length,1);
subset=filters.filterResult({...result,rows:[...result.rows,row('STELVIO 2.2')]},sold);assert.equal(subset.sources.at(-1).status,'partial');
const source=filters.sourceQuery(leads);assert.equal(source.kind,'lead-management');assert.equal(source.seller,undefined);
subset=filters.filterResult({...result,query:source,sources:[{...result.sources[0],name:'Gestione CAIRONI'},{...result.sources[0],name:'Gestione PAGLIARA',status:'unavailable'}],rows:[row('', 'CAIRONI'),row('','PAGLIARA')]},leads);
assert.equal(subset.rows.length,1);assert.equal(subset.sources.length,1);assert.equal(subset.sources[0].status,'partial');assert.match(summary.presentResult(subset).title,/assegnazioni lead lette/);assert.match(summary.presentResult(subset).message,/non sono certificati/);
assert.throws(()=>filters.filterResult({...result,sources:[]},leads));
assert.match(summary.presentResult({...subset,rows:[]}).message,/Non posso considerare il risultato pari a zero/);
assert.match(filters.describeFilters(sold),/Alfa Romeo.*STELVIO/);
const rank=parse('Chi ha venduto più auto nel 2026?');assert.equal(rank.analysis,'seller-ranking');assert.equal(rank.kind,'contracts');
const leadRank=parse('Chi ha venduto più auto da lead a settembre 2025?');assert.equal(leadRank.kind,'lead-contracts');assert.equal(leadRank.from,'2025-09-01');
const leadRate=parse('Chi ha il miglior tasso di conversione lead>contratto lead di ottobre 2026?');assert.equal(leadRate.analysis,'lead-conversion');
const walkRate=parse('Chi ha il miglior tasso di conversione sui walkin quindi preventivi walkin>contratti a settembre 2026?');assert.equal(walkRate.analysis,'walkin-conversion');
assert.equal(parse('Chi prende più appuntamenti nel 2026?').kind,'appointments');
const weekly=parse('Come sta andando questa settimana confronto a quella scorsa?');assert.equal(weekly.from,'2026-10-19');assert.equal(weekly.to,'2026-10-23');assert.equal(weekly.compareFrom,'2026-10-12');assert.equal(weekly.compareTo,'2026-10-16');
const best=parse("Qual'è il miglior mese per nr. vendite nel 2026?");assert.equal(best.analysis,'best-month');
assert.throws(()=>parse('Chi prende più appuntamenti?'));
assert.throws(()=>schema.validateQuery({...weekly,compareTo:'2026-10-18'}));
assert.throws(()=>schema.validateQuery({...rank,analysis:'sql'}));
let ranked=summary.presentResult({...result,query:rank,rows:[row('FIAT PANDA'),row('FIAT 500','PAGLIARA')]});assert.match(ranked.title,/CAIRONI e PAGLIARA/);assert.equal(ranked.tables[0].rows.length,2);
const monthly=summary.presentResult({...result,query:best,rows:[{...row('FIAT'),date:'2026-09-01'},{...row('FIAT'),date:'2026-10-01',category:'Registrazioni provvisorie · Car One'},{...row('FIAT'),date:'2026-10-02',category:'Registrazioni provvisorie · Car One'}]});assert.match(monthly.title,/2026-09/);assert.equal(monthly.tables[0].rows.find(r=>r[0]==='2026-10')[3],'No');
const rateRows=[{...row('FIAT'),metric:'contract',origin:'Lead Facebook'},{...row('FIAT'),metric:'management',feedback:true}];
let rates=summary.presentResult({...result,query:leadRate,rows:rateRows});assert.match(rates.title,/non certificabile/);assert.equal(rates.tables[0].rows[0][3],'100%');
rates=summary.presentResult({...result,query:leadRate,sources:[{...result.sources[0],status:'unavailable'}],rows:rateRows});assert.match(rates.tables[0].rows[0][3],/n.d./);
const walkRows=[{...row('FIAT'),metric:'contract',origin:'Walk-in'},{...row('FIAT'),metric:'contract',origin:'Passaparola'},{...row('FIAT'),metric:'quote',channel:'Walk-in'},{...row('FIAT'),metric:'quote',channel:'Facebook'}];
rates=summary.presentResult({...result,query:walkRate,rows:walkRows});assert.equal(rates.tables[0].rows[0][1],'1');assert.equal(rates.tables[0].rows[0][2],'1');
const comparisonSources=['Periodo attuale','Periodo precedente'].map(name=>({...result.sources[0],name:name+' · CAR'}));
const compared=summary.presentResult({...result,query:{...weekly,kind:'contracts'},sources:comparisonSources,rows:[row('FIAT'),row('FIAT'),{...row('FIAT'),comparisonPeriod:true}]});assert.deepEqual(plain(compared.tables[0].rows[0].slice(1)),['2','1','1','100%']);
assert.match(summary.presentResult({...result,query:{...weekly,kind:'contracts'},sources:comparisonSources.map(s=>({...s,status:'unavailable'})),rows:[]}).tables[0].rows[0][4],/n.d./);
console.log('PASS: seller rankings/ties, lead and walk-in observed ratios, missing sources, weekly alignment and closed-month eligibility');
console.log('PASS: composable filters, exact vehicle tokens, period/seller/model follow-ups, source coverage and strict validation');
(async()=>{
 const old={...process.env};
 try{
  process.env.GOOGLE_APPS_SCRIPT_URL='https://script.google.com/macros/s/test/exec';process.env.GOOGLE_APPS_SCRIPT_TOKEN='synthetic';
  process.env.DASHBOARD_USER='test';process.env.DASHBOARD_PASSWORD='test';
  process.env.GEMINI_API_KEY='synthetic';process.env.ASSISTANT_GEMINI_ENABLED='true';
  const plans=[];
  const planner=modules['@/lib/assistant/gemini']=load('lib/assistant/gemini.ts',{}, {fetch:async(url,init)=>{plans.push(JSON.parse(init.body));return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({status:'query',...sold,seller:'CAIRONI'})}]}}]});}});
  const planned=await planner.planWithGemini('Vendite Stelvio del venditore Caironi nel 2026',now,sold);assert.equal(planned.seller,'CAIRONI');assert.equal(planned.model,'STELVIO');
  const callsBefore=plans.length;
  assert.deepEqual(plain(await planner.interpretAssistantQuestion('Quanti contratti ha fatto Caironi nel mese di dicembre del 2025?')),{query:caironiDecember,engine:'local'});
  assert.equal(plans.length,callsBefore); // deterministic composition does not call the provider
  assert.deepEqual(plain(JSON.parse(plans[0].contents[0].parts[0].text).context),plain(sold));
  await assert.rejects(planner.interpretAssistantQuestion('Quante auto con targa AA123BB abbiamo venduto nel 2026?'));
  const calls=[];
  const server=modules['@/lib/assistant/server']=load('lib/assistant/server.ts',{'next/cache':{unstable_cache:f=>f},'../operational-quotes':{}},{fetch:async url=>{
   const u=new URL(url);calls.push(u);assert.equal(u.searchParams.has('seller'),false);assert.equal(u.searchParams.has('brand'),false);
   const kind=u.searchParams.get('kind'),q={kind,from:u.searchParams.get('from'),to:u.searchParams.get('to')};
   if(kind==='lead-management')return Response.json({...result,query:q,sources:[{...result.sources[0],name:'Gestione CAIRONI'}],rows:[{...row('', 'CAIRONI'),date:q.from,invoiceAmount:undefined,metric:'management',feedback:false}]});
   return Response.json({...result,query:q,rows:[...Array.from({length:601},(_,i)=>row('ALFA ROMEO STELVIO Q4','CAIRONI',10000,i+1)),row('ALFA ROMEO GIULIA','PAGLIARA',50000,999)].map(r=>({...r,date:q.from}))});
  }});
  const assigned=await server.readAssistant(leads);assert.equal(calls.at(-1).searchParams.get('kind'),'lead-management');assert.equal(assigned.rows.length,1);assert.equal(assigned.query.seller,'CAIRONI');
  const combined=await server.readAssistant(leadRate);assert.equal(combined.query.analysis,'lead-conversion');assert.ok(combined.rows.some(r=>r.metric==='management'));assert.ok(combined.rows.some(r=>r.metric==='contract'));
  const periods=await server.readAssistant({...weekly,kind:'contracts'});assert.ok(periods.rows.some(r=>r.comparisonPeriod));assert.ok(periods.rows.every(r=>r.date===(r.comparisonPeriod?weekly.compareFrom:weekly.from)));
  const route=load('app/api/assistant/route.ts',{'next/server':{NextResponse:{json:(body,init={})=>Response.json(body,init)}}});
  const auth='Basic '+Buffer.from('test:test').toString('base64');
  const composed=await route.POST(new Request('https://crm.example/api/assistant',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify({question:'Quanti contratti ha fatto Caironi a dicembre 2025?'})}));
  const counted=await composed.json();assert.equal(composed.status,200);assert.deepEqual(plain(counted.query),caironiDecember);assert.equal(counted.recordCount,601);assert.match(counted.filters,/CAIRONI/);assert.ok(counted.rows.every(r=>r.seller==='CAIRONI'&&r.date==='2025-12-01'));
  const response=await route.POST(new Request('https://crm.example/api/assistant',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify({question:'Quante Alfa Romeo Stelvio ha venduto Caironi nel 2026?'})}));
  const body=await response.json();assert.equal(response.status,200);assert.equal(body.rows.length,500);assert.equal(body.recordCount,601);assert.match(body.presentation.insights[0].observation,/601 record su 601/);assert.match(body.filters,/CAIRONI.*Alfa Romeo.*STELVIO/);assert.match(body.presentation.title,/601/);assert.equal(body.presentation.metrics.find(m=>m.label.startsWith('Prezzo medio')).value,'10.000 €');
  assert.equal((await route.POST(new Request('https://crm.example/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(sold)}))).status,401);
  console.log('PASS: planner filters/context, privacy guard, unchanged v53 source queries, API authentication, all-row totals before 500-record sample');
 }finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);}
})().catch(e=>{console.error(e);process.exitCode=1;});
