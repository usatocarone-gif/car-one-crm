const {readFileSync}=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>imports[n]||(n==="./filters"||n==="@/lib/assistant/filters"?load("lib/assistant/filters.ts",{"./schema":schema,"./vehicles":load("lib/assistant/vehicles.ts")}):n==="./conversation"?load("lib/assistant/conversation.ts",{"./schema":schema}):require(n)),Buffer,URL,Date,Intl,AbortSignal,process,TextDecoder,Response,Request,...globals});return exports;}
const origins=load('lib/contract-origin.ts'),schema=load('lib/assistant/schema.ts'),summary=load('lib/assistant/summary.ts',{'./vehicles':load('lib/assistant/vehicles.ts'),'../contract-origin':origins});
const server=load('lib/assistant/server.ts',{'next/cache':{unstable_cache:f=>f},'../contract-origin':origins,'./schema':schema,'../operational-quotes':{}});
const now=new Date('2026-10-23T12:00:00Z');
for(const [question,kind] of [['Quanti lead abbiamo ricevuto questo mese?','leads'],['Quanti lead sono arrivati nel 2025 divisi per canale?','leads'],['Quanti preventivi abbiamo nel 2026?','quotes'],['Mostrami gli appuntamenti e gli esiti dal 2026-10-01 al 2026-10-23','appointments'],['Mostrami il funnel questo mese','funnel'],['Quanti lead hanno un feedback nel 2026?','lead-management']])assert.equal(schema.interpretQuestion(question,now).kind,kind,question);
assert.equal(schema.interpretQuestion('Quanti lead abbiamo ricevuto oggi?',new Date('2026-10-22T23:30:00Z')).from,'2026-10-23');
for(const question of ['Quanti lead Facebook nel 2026?','Quanti lead di Caironi nel 2026?','Quanti lead nel 2026 senza Facebook?','Quanti lead nel 2026 rispetto al 2025?','Quanti lead ricevuti nel 2026 solo Umbria?'])assert.throws(()=>schema.interpretQuestion(question,now));
let tabs={};
function sheet(name,rows){return {getName:()=>name,getSheetId:()=>Object.keys(tabs).indexOf(name)+1,getLastRow:()=>rows.length,getRange:(row,col,height,width)=>({getValues:()=>rows.slice(row-1,row-1+height).map(r=>r.slice(col-1,col-1+width))}),getDataRange:()=>({getValues:()=>rows})};}
const book={getId:()=> 'leads',getUrl:()=> 'https://docs.google.com/spreadsheets/d/leads',getSheetByName:name=>tabs[name],getSheets:()=>Object.values(tabs)};
const date=(d,tz,format)=>format==='yyyy-MM-dd'?new Intl.DateTimeFormat('sv-SE',{timeZone:tz}).format(d):new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit'}).format(d);
const util={formatDate:date,computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),DigestAlgorithm:{SHA_256:'sha256'},base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')};
const context=vm.createContext({Date,Intl,Utilities:util,SpreadsheetApp:{openById:()=>book},LEADS_ID:'leads',LEAD_MANAGEMENT_SOURCES:[{id:'leads',sheet:'seller',seller:'SELLER'}],leadHistorySources_:()=>Object.values(tabs).filter(s=>s.getName()==='settembre 2026').map(s=>({name:s.getName(),year:2026,month:9})),normalizeSource_:v=>v==='fb'?'Facebook':v||'Non indicata',normalizeHistorySeller_:String,headerIndex_:(h,a)=>h.findIndex(x=>a.includes(x))});
vm.runInContext(readFileSync('integrations/apps-script/assistant-readonly.gs','utf8'),context);
for(const value of ['2026-02-31T10:00:00Z','2026-10-23T24:00:00Z','2026-10-23T12:60:00Z','2026-10-23T12:30:00+15:00','2026-10-23T12:30:00+14:30','2026-10-23garbage','11/082026','31/02/2026 11:30','12/10',''])assert.equal(context.assistantArrival_(value),null,value);
assert.equal(context.assistantArrival_('2024-02-29T23:30:00.000Z').day,'2024-03-01');
assert.equal(context.assistantArrival_('21/04/2026 11:36').day,'2026-04-21');
const headers=['Data','NOME','EMAIL','MODULO','TELEFONO','Origine','Città','Budget','Auto','LEAD ID'];
const lead=(time,id='',name='A')=>[time,name,'a@example.test','','12345','fb','Perugia','','',id];
const a=lead('2026-10-01T21:30:00.000Z','10000000001'),b=lead('2026-10-01T22:30:00.000Z','10000000002');
tabs.Foglio1=sheet('Foglio1',[headers,a,b,lead('2026-02-31T10:30:00Z','bad'),lead('2026-10-24T12:00:00Z','future'),lead('2026-09-25T12:00:00Z','outside')]);
tabs['giuseppe lead']=sheet('giuseppe lead',[headers,a]);
const result=kind=>({schemaVersion:'assistant-v1',query:{kind,from:'2026-10-01',to:'2026-10-23'},sources:[],rows:[],generatedAt:now.toISOString(),truncated:false});
let r=result('leads');context.assistantLeads_(r,now);assert.equal(r.rows.length,2);assert.equal(r.rows.find(r=>r.arrivedAt===b[0]).date,'2026-10-02');assert.ok(r.rows.every(r=>r.evidence.row>=2));assert.equal('client' in r.rows[0],false);assert.ok(r.sources.some(s=>s.status==='partial'));assert.equal(server.normalizeResult(r,r.query).rows.length,2);
const presentation=summary.presentResult(r);assert.equal(presentation.tables.find(t=>t.title==='Lead per canale').rows[0][1],'2');assert.equal(presentation.tables.find(t=>t.title==='Lead per giorno').rows.length,2);
// Distinct explicit IDs are distinct requests, even for the same exact contact and timestamp.
tabs.Foglio1=sheet('Foglio1',[headers,lead(a[0],'20000000001'),lead(a[0],'20000000002')]);tabs['giuseppe lead']=sheet('giuseppe lead',[headers]);
r=result('leads');context.assistantLeads_(r,now);assert.equal(r.rows.length,2);
// Product text misplaced in the ID column must not erase distinct requests.
tabs.Foglio1=sheet('Foglio1',[headers,lead(a[0],'SUV'),lead(b[0],'SUV')]);r=result('leads');context.assistantLeads_(r,now);assert.equal(r.rows.length,2);
// Reused ID with conflicting event data is excluded, without exposing customer identifiers in issues.
tabs.Foglio1=sheet('Foglio1',[headers,lead(a[0],'30000000001'),lead(b[0],'30000000001')]);r=result('leads');context.assistantLeads_(r,now);assert.equal(r.rows.length,0);assert.ok(r.sources[0].issues.some(v=>v.includes('discordanti')));
// Missing monthly archives do not become zero. A headerless first data row is retained.
tabs['settembre 2026']=sheet('settembre 2026',[lead('2026-09-01T12:30:00Z','sep')]);r={...result('leads'),query:{kind:'leads',from:'2026-08-01',to:'2026-09-30'}};context.assistantLeads_(r,now);assert.equal(r.rows.length,1);assert.equal(r.rows[0].evidence.row,1);assert.ok(r.sources.some(s=>s.name==='Archivio lead 2026-08'&&s.status==='unavailable'));
// Quote historical coverage is explicitly partial; no reconstructed quotes from contracts.
tabs.Preventivi=sheet('Preventivi',[['Data','Cliente','Telefono','Funzionario'],['21/04/2026 11:36','A','','Seller'],['31/02/2026','B','','Seller']]);r={...result('quotes'),query:{kind:'quotes',from:'2026-01-01',to:'2026-10-23'}};context.assistantQuotes_(r,now);assert.equal(r.rows.length,1);assert.equal(r.sources[0].status,'partial');
tabs.seller=sheet('seller',[['Data','feedback','lead id'],[a[0],'Richiamare','id1'],[b[0],'','id2']]);r=result('lead-management');context.assistantManagement_(r,now);assert.equal(r.rows.length,2);assert.equal(summary.presentResult(r).metrics.find(m=>m.label==='Senza feedback registrato').value,'1');
// Ratios use controlled rows, are not cohorts, and never conceal missing sources/origins.
const evidence={locatorId:'ref',source:'test',url:'https://docs.google.com/spreadsheets/d/test'};
const row=(metric,extra={})=>({date:'2026-10-01',category:'test',seller:'Tutti',value:1,metric,evidence,...extra});
r={...result('funnel'),sources:[{name:'test',status:'available',readAt:now.toISOString(),coverage:'test',issues:[]}],rows:[row('lead',{channel:'Facebook'}),row('lead',{channel:'Facebook'}),row('quote'),row('appointment',{status:'presented'}),row('appointment',{status:'pending'}),row('contract',{origin:'Lead Facebook',category:'Contratti registrati · Car One'})]};
let view=summary.presentResult(r);assert.match(view.message,/non attribuiscono/);assert.match(view.metrics.find(m=>m.label.startsWith('Rapporto contratti da lead')).value,/50% \(1\/2\)/);assert.match(view.metrics.find(m=>m.label.startsWith('Show rate')).value,/100% \(1\/1\)/);
r.sources[0].status='unavailable';view=summary.presentResult(r);assert.match(view.metrics.find(m=>m.label.startsWith('Rapporto contratti /')).value,/n.d./);
r.sources[0].status='available';r.rows.at(-1).origin='';view=summary.presentResult(r);assert.match(view.metrics.find(m=>m.label.startsWith('Rapporto contratti da lead')).value,/Origine mancante/);
assert.equal(summary.presentResult({...r,truncated:true}).metrics.length,0);
for(const bad of [{...row('lead'),arrivedAt:'2026-10-01T23:30:00.000Z',channel:'Facebook'},row('appointment',{status:'invented'})])assert.throws(()=>server.normalizeResult({...r,query:{...r.query,kind:bad.metric==='lead'?'leads':'appointments'},rows:[bad]}, {...r.query,kind:bad.metric==='lead'?'leads':'appointments'}));
const compiled=readFileSync('integrations/apps-script/candidate-v53.gs','utf8');new vm.Script(compiled);assert.equal((compiled.match(/function doGet\(/g)||[]).length,1);assert.equal((compiled.match(/function doPost\(/g)||[]).length,1);
console.log('PASS: lead arrivals, Rome boundaries, monthly coverage, exact-event copies, distinct/conflicting IDs, source links, quotes, feedback, backend ratios and missing data');
(async()=>{
 const planner=load('lib/assistant/gemini.ts',{'./schema':schema});
 assert.equal((await planner.interpretAssistantQuestion('E i lead?',{kind:'funnel',from:'2026-10-01',to:'2026-10-23'})).query.kind,'leads');
 assert.equal((await planner.interpretAssistantQuestion('E le conversioni?',{kind:'leads',from:'2026-10-01',to:'2026-10-23'})).query.kind,'funnel');
 const query={kind:'leads',from:'2026-10-01',to:'2026-10-23'};
 const all={schemaVersion:'assistant-v1',query,generatedAt:now.toISOString(),sources:[{name:'test',status:'available',readAt:now.toISOString(),coverage:'test',issues:[]}],rows:Array.from({length:601},(_,i)=>row('lead',{channel:'Facebook',evidence:{...evidence,locatorId:'row-'+i}})),truncated:false};
 const route=load('app/api/assistant/route.ts',{'next/server':{NextResponse:{json:(body,init={})=>Response.json(body,init)}},'@/lib/assistant/server':{authenticated:()=>true,readAssistant:async()=>all},'@/lib/assistant/schema':schema,'@/lib/assistant/summary':summary,'@/lib/assistant/gemini':planner});
 const response=await route.POST(new Request('https://crm.example/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(query)}));
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.rows.length,500);assert.equal(body.recordCount,601);assert.match(body.presentation.title,/601/);assert.equal(body.presentation.tables.find(t=>t.title==='Lead per canale').rows[0][1],'601');
 console.log('PASS: follow-up context and totals from all 601 rows before limiting 500 visible references');
})().catch(e=>{console.error(e);process.exitCode=1;});
const vehicles=load('lib/assistant/vehicles.ts');
assert.equal(vehicles.vehicleBrand('VW GOLF'),'Volkswagen');assert.equal(vehicles.vehicleBrand('Mercedes-Benz Classe A'),'Mercedes-Benz');assert.equal(vehicles.vehicleBrand('500 1.2'),'Non classificata');
assert.equal(schema.interpretQuestion('Quali auto abbiamo venduto nel 2025?').kind,'vehicle-sales');
assert.equal(schema.interpretQuestion('Fasce di prezzo delle auto vendute nel 2025?').kind,'vehicle-sales');
assert.equal(schema.interpretQuestion('Prezzo medio delle auto vendute nel 2025?').kind,'vehicle-sales');
for(const value of [0,-3,'n.d.','1,000.00','1.000,123',Infinity])assert.equal(context.assistantInvoiceAmount_(value),null,String(value));
for(const [value,expected] of [[15000,15000],['€ 15.000,50',15000.5],['15000.50',15000.5],['1.000',1000]])assert.equal(context.assistantInvoiceAmount_(value),expected);
let vehicleResult={...result('vehicle-sales'),rows:[row('contract',{category:'Contratti registrati · Car One',vehicle:'FIAT PANDA',origin:'Lead',invoiceAmount:10000}),row('contract',{category:'Contratti registrati · Car One',vehicle:'FIAT 500',origin:'Walk-in',invoiceAmount:20000}),row('contract',{category:'Registrazioni provvisorie · AD Motor',vehicle:'VW GOLF',origin:'Lead'})]};
const vehicleView=summary.presentResult(vehicleResult);assert.equal(vehicleView.metrics.find(m=>m.label.startsWith('Prezzo mediano')).value,'15.000 €');assert.equal(vehicleView.tables.find(t=>t.title.startsWith('Fasce')).rows.at(-1)[1],'1');assert.match(vehicleView.message,/riferimento concordato è IMP. FATT./);assert.equal(vehicleView.tables.find(t=>t.title==='Marche registrate').rows.find(r=>r[0]==='Volkswagen')[2],'1');
// CAR 2024's invoice column differs from 2025: identify IMP. FATT. by header, never by old revenue offsets.
const h2024=['NR','DATA','CLIENTE','MARCA-MODELLO','TARGA','VENDITORE','N/U/S','PR','FIN','IMP FIN','IMP. FATT.','AGENZIA','NR FT','ART15'];
const raw2024=['2024-01-02','A','FIAT PANDA','AA111AA','CAIRONI','U','','','',12000,500,'',''];
const historicSheet={getName:()=> 'CAR 2024',getSheetId:()=>1,getLastRow:()=>2,getLastColumn:()=>14,getRange:(r)=>({getValues:()=>[raw2024],getDisplayValues:()=>[h2024]})};
context.SALES_ID='sales';context.SpreadsheetApp={openById:()=>({...book,getSheetByName:name=>name==='CAR 2024'?historicSheet:null})};context.findSheetByNames_=(b,names)=>names.map(n=>b.getSheetByName(n)).find(Boolean);context.saleKey_=(...v)=>v.join('|');
vehicleResult={...result('vehicle-sales'),query:{kind:'vehicle-sales',from:'2024-01-01',to:'2024-12-31'}};context.assistantContracts_(vehicleResult,now);assert.equal(vehicleResult.rows.length,1);assert.equal(vehicleResult.rows[0].invoiceAmount,12000);assert.equal(vehicleResult.rows[0].vehicle,'FIAT PANDA');
const validVehicle={...result('vehicle-sales'),sources:[{name:'CAR',status:'available',readAt:now.toISOString(),coverage:'test',issues:[]}],rows:[row('contract',{category:'Contratti registrati · Car One',vehicle:'FIAT PANDA',origin:'Lead',invoiceAmount:12000})]};
assert.equal(server.normalizeResult(validVehicle,validVehicle.query).rows[0].invoiceAmount,12000);
assert.throws(()=>server.normalizeResult({...validVehicle,rows:[{...validVehicle.rows[0],category:'Registrazioni provvisorie · Car One'}]},validVehicle.query));
console.log('PASS: vehicle descriptions, invoice header mapping CAR 2024, strict amounts, weighted price statistics, brands and exclusion of mixed provisional commissions');
