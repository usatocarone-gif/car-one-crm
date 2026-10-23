const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>imports[n]||(n==="./filters"||n==="@/lib/assistant/filters"?load("lib/assistant/filters.ts",{"./schema":schema,"./vehicles":load("lib/assistant/vehicles.ts")}):n==="./conversation"?load("lib/assistant/conversation.ts",{"./schema":schema}):require(n)),Buffer,URL,Date,Intl,AbortSignal,process,TextDecoder,Response,Request,...globals});return exports;}
const schema=load('lib/assistant/schema.ts'),summary=load('lib/assistant/summary.ts',{'./vehicles':load('lib/assistant/vehicles.ts'),'../contract-origin':load('lib/contract-origin.ts')});
const operational=load('lib/operational-quotes.ts');
const origins=load('lib/contract-origin.ts');
const gemini=load('lib/assistant/gemini.ts',{'./schema':schema});
const server=load('lib/assistant/server.ts',{'next/cache':{unstable_cache:f=>f},'./schema':schema,'../operational-quotes':operational,'../contract-origin':origins});
for(const day of ['2026-02-29','2026-02-31','2026-13-01','2026-00-10','03/04/26','2026-10','2026-01-01junk'])assert.equal(schema.validDay(day),false,day);
assert.equal(schema.validDay('2024-02-29'),true);
assert.equal(schema.interpretQuestion('Quanti contratti abbiamo nel 2025 divisi tra Car One e AD Motor?').from,'2025-01-01');
assert.equal(schema.interpretQuestion('Qual è la percentuale di lead gestiti il primo giorno dal 2026-10-01 al 2026-10-20?').kind,'lead-quality');
for(const q of ['Quanti contratti di Caironi nel 2025?','Quanti contratti nel 2025 esclusi AD Motor?','Quanti contratti abbiamo il mese scorso?','Fatturato nel 2025?','Quanti contratti abbiamo nel 2025 solo Car One?'])assert.throws(()=>schema.interpretQuestion(q));
assert.throws(()=>schema.validateQuery({kind:'contracts',from:'2025-01-01',to:'2025-12-31',seller:'NON_CONFIGURATO'}));
const oldUser=process.env.DASHBOARD_USER,oldPass=process.env.DASHBOARD_PASSWORD;
process.env.DASHBOARD_USER='test';process.env.DASHBOARD_PASSWORD='a:b';
assert.equal(server.authenticated(new Request('http://localhost')),false);
assert.equal(server.authenticated(new Request('http://localhost',{headers:{authorization:'Basic '+Buffer.from('test:a:b').toString('base64')}})),true);
process.env.DASHBOARD_USER=oldUser;process.env.DASHBOARD_PASSWORD=oldPass;
const query={kind:'contracts',from:'2025-01-01',to:'2025-12-31'};
const evidence={locatorId:'row:2',source:'CAR 2025',url:'https://docs.google.com/spreadsheets/d/test#gid=1&range=A2:N2'};
const raw={schemaVersion:'assistant-v1',query,generatedAt:'2026-10-23T10:00:00Z',sources:[{name:'CAR 2025',status:'available',readAt:'2026-10-23T10:00:00Z',coverage:'2025',issues:[]}],rows:[{date:'2025-01-01',category:'Contratti registrati · Car One',seller:'CAIRONI',value:1,origin:'Lead',evidence}],truncated:false};
assert.equal(server.normalizeResult(raw,query).rows.length,1);
assert.throws(()=>server.normalizeResult({...raw,rows:[{...raw.rows[0],evidence:{...evidence,url:'https://evil.example'}}]},query));
assert.throws(()=>server.normalizeResult({...raw,schemaVersion:'legacy'},query));
assert.match(summary.summarize({...raw,rows:[],sources:[{...raw.sources[0],status:'unavailable'}]}),/Non è possibile concludere/);
const quality={...raw,query:{...query,kind:'lead-quality'},rows:[{due:1,managed:1,measurement:'evening-observation'},{due:9,managed:0,measurement:'evening-observation'},{due:100,managed:100,measurement:'reconstructed'}]};
assert.match(summary.summarize(quality),/10%/); // weighted; reconstructed excluded
assert.match(summary.summarize({...quality,rows:[]}),/Percentuale non disponibile/);
assert.equal(summary.presentResult({...raw,truncated:true}).metrics.length,0);
assert.equal(summary.presentResult({...raw,rows:[],sources:[{...raw.sources[0],status:'unavailable'}]}).title,'Non ho dati sufficienti');
assert.equal(summary.presentResult(raw).title,'1 contratto registrato');
assert.equal(summary.presentResult({...quality,sources:[{...raw.sources[0],status:'partial'}]}).title,'10% con feedback registrato');
assert.equal(summary.presentResult({...quality,sources:[{...raw.sources[0],status:'partial'}]}).partial,true);

const formatDate=(date,tz,pattern)=>{
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:tz}).format(date);
 return pattern==='yyyy-MM-dd'?day:pattern==='HH:mm'?new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit'}).format(date):day;
};
const util={formatDate,computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),DigestAlgorithm:{SHA_256:'sha256'},base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')};
let books={};
const context=vm.createContext({Date,console,Utilities:util,SpreadsheetApp:{openById:id=>{if(!books[id])throw Error('missing');return books[id];}},SALES_ID:'sales',SELLERS:['CAIRONI','PAGLIARA'],assistantOriginIsLead_:origins.isLeadContractOrigin,normalizeHistorySeller_:v=>String(v).toUpperCase(),findSheetByNames_:(b,ns)=>ns.map(n=>b.getSheetByName(n)).find(Boolean),saleKey_:(d,c,m,s,co)=>[formatDate(d,'Europe/Rome','yyyy-MM-dd'),c,m,s,co].join('|')});
vm.runInContext(readFileSync('integrations/apps-script/assistant-readonly.gs','utf8'),context);
for(const date of ['31/02/2026','03/04/26','2026-02-29','2026-01-01Tbad',''])assert.equal(context.assistantDay_(date),null);
assert.equal(context.assistantDay_('03/04/2026'),'2026-04-03');
assert.equal(context.assistantDay_(new Date('2026-10-22T23:30:00Z')),'2026-10-23');
const makeSheet=(name,rows)=>({getName:()=>name,getSheetId:()=>name==='CAR 2025'?1:2,getLastRow:()=>rows.length+1,getRange:()=>({getValues:()=>rows})});
const sale=(date,client)=>[date,client,'Auto','AB123CD','Caironi','Lead','','','','',100,'',200];
const tabs={'CAR 2025':makeSheet('CAR 2025',[sale('2025-01-02','A'),sale('31/02/2025','B'),sale('2025-03-04','C'),sale('2025-03-04','C')]),'AD MOTOR 24/25':makeSheet('AD MOTOR 24/25',[sale('2025-04-01','D')])};
books.sales={getId:()=> 'sales',getUrl:()=> 'https://docs.google.com/spreadsheets/d/test',getSheetByName:n=>tabs[n]};
const result=()=>({query,sources:[],rows:[],generatedAt:'2026-10-23T10:00:00Z'});
let r=result();context.assistantContracts_(r,new Date('2026-10-23T10:00:00Z'));
assert.equal(r.rows.length,2);assert.equal(r.sources[0].status,'partial');assert.equal(r.rows[0].evidence.row,2);assert.match(r.rows[0].evidence.fingerprint,/^[\w-]+$/);
delete tabs['AD MOTOR 24/25'];r=result();context.assistantContracts_(r,new Date('2026-10-23T10:00:00Z'));assert.equal(r.sources[1].status,'unavailable');
const candidate=readFileSync('integrations/apps-script/candidate-v52.gs','utf8');new vm.Script(candidate);
assert.equal((candidate.match(/function doGet\(/g)||[]).length,1);
assert.equal((candidate.match(/function doPost\(/g)||[]).length,1);
assert.ok(candidate.includes("if (e.parameter.action === 'assistant')"));
console.log('PASS: date, filtri, autenticazione, provenienza, sorgenti mancanti, duplicati, medie pesate, sintassi Apps Script');
(async()=>{
 const route=load('app/api/assistant/route.ts',{'next/server':{NextResponse:{json:(body,init={})=>Response.json(body,init)}},'@/lib/assistant/server':{authenticated:server.authenticated,readAssistant:()=>{throw Error('must not read');}},'@/lib/assistant/schema':schema,'@/lib/assistant/summary':summary,'@/lib/assistant/gemini':gemini});
 process.env.DASHBOARD_USER='pilot';process.env.DASHBOARD_PASSWORD='local-test';
 const auth='Basic '+Buffer.from('pilot:local-test').toString('base64');
 assert.equal((await route.POST(new Request('https://crm.example/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(query)}))).status,401);
 assert.equal((await route.POST(new Request('https://crm.example/api/assistant',{method:'POST',headers:{authorization:auth,origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify(query)}))).status,403);
 assert.equal((await route.POST(new Request('https://crm.example/api/assistant',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify({question:'Quanti contratti di Caironi nel 2025?'})}))).status,503);
 assert.equal((await route.POST(new Request('https://crm.example/api/assistant',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify(query)}))).status,503);
 await testGemini();
 console.log('PASS: API 401, 403, chiarimenti 400, fonte indisponibile 503');
})().catch(e=>{console.error(e);process.exitCode=1;});
// The current-month source must never coerce a bad or out-of-month date.
const projection=(date,client,property='CAR ONE')=>[date,client,'Auto','AA111AA','Caironi',property,'Lead','','',100];
tabs["PROIEZ. REDDITIVITA'"]=makeSheet("PROIEZ. REDDITIVITA'",[projection('2026-10-01','Valid'),projection('31/10/26','Invalid'),projection('2026-09-01','Previous'),projection('2026-10-24','Future'),projection('2026-10-02','Unknown','?')]);
r={...result(),query:{kind:'contracts',from:'2026-10-01',to:'2026-10-23'}};
context.assistantContracts_(r,new Date('2026-10-23T10:00:00Z'));
assert.equal(r.rows.length,1);assert.equal(r.rows[0].date,'2026-10-01');assert.match(r.rows[0].category,/provvisorie/);assert.equal(r.sources[0].status,'partial');
const quote={id:'q1',date:'2026-10-19',seller:'CAIRONI',client:'',vehicle:'',status:'DA RICHIAMARE',lastFollowup:null,nextFollowup:null,note:'',url:evidence.url};
assert.equal(operational.quotePriority(quote,'2026-10-23'),'overdue');
assert.equal(operational.quotePriority({...quote,status:'VINTO'},'2026-10-23'),'closed');
assert.equal(operational.quotePriority({...quote,status:'?unknown'},'2026-10-23'),'verify');
assert.equal(operational.businessShift('2026-10-23',1),'2026-10-26');
assert.equal(operational.businessShift('2026-10-23',1,{'2026-10-24':true}),'2026-10-24');
for(const q of ['Quanti contratti Car One nel 2025?','Quanti contratti abbiamo nel 2025 per tutti i lead?'])assert.throws(()=>schema.interpretQuestion(q));
console.log('PASS: proiezioni senza correzioni automatiche, società ignota, giorni lavorativi, filtri non ignorati');
// Origin-based attribution: the same recorded-field rule as the existing Contracts view.
for(const origin of ['lead','Lead Facebook','LEAD qualcosa','Facebook','SOCIAL','Instagram','TikTok','Sito web','AutoScout24','A24','BDC'])assert.equal(origins.isLeadContractOrigin(origin),true,origin);
for(const origin of ['Walk-in','Loyalty','Passaparola','', 'Non indicata'])assert.equal(origins.isLeadContractOrigin(origin),false,origin);
assert.equal(schema.interpretQuestion('Quanti contratti da lead abbiamo nel 2025?').kind,'lead-contracts');
assert.equal(schema.interpretQuestion('Quanti contratti con origine lead nel 2025?').kind,'lead-contracts');
const originRows=[sale('2025-01-02','Lead A'),sale('2025-01-03','Facebook B'),sale('2025-01-04','Walkin C'),sale('2025-01-05','Missing D')];
originRows[0][5]='Lead qualcosa';originRows[1][5]='Facebook';originRows[2][5]='Walk-in';originRows[3][5]='';
tabs['CAR 2025']=makeSheet('CAR 2025',originRows);tabs['AD MOTOR 24/25']=makeSheet('AD MOTOR 24/25',[]);
r={...result(),query:{...query,kind:'lead-contracts'}};context.assistantContracts_(r,new Date('2026-10-23T10:00:00Z'));
assert.equal(r.rows.length,2);assert.equal(r.rows[1].origin,'Facebook');assert.equal(r.sources[0].status,'partial');assert.match(r.sources[0].issues.join(' '),/Origine mancante/);
assert.equal(server.normalizeResult({...r,schemaVersion:'assistant-v1',truncated:false},r.query).rows.length,2);
assert.throws(()=>server.normalizeResult({...raw,query:{...query,kind:'lead-contracts'},rows:[{...raw.rows[0],origin:'Walk-in'}]},{...query,kind:'lead-contracts'}));
const classifierContext=vm.createContext({});vm.runInContext(candidate.match(/function assistantOriginIsLead_\(origin\) \{[^\n]+/)[0],classifierContext);
for(const origin of ['Lead Facebook','walk-in','BDC','', 'Sito web'])assert.equal(classifierContext.assistantOriginIsLead_(origin),origins.isLeadContractOrigin(origin));
console.log('PASS: campo Origine, Facebook/Lead varianti, walk-in esclusi, origini mancanti e parità regola CRM/Apps Script');

const distinctCars=[sale('2025-10-04','Same client'),sale('2025-10-04','Same client')];distinctCars[0][3]='AA111AA';distinctCars[1][3]='BB222BB';
tabs['CAR 2025']=makeSheet('CAR 2025',distinctCars);r=result();context.assistantContracts_(r,new Date('2026-10-23T10:00:00Z'));assert.equal(r.rows.length,2);assert.equal(r.sources[0].status,'available');
console.log('PASS: stesso cliente/modello/giorno ma targhe diverse = due vendite distinte');

async function testGemini(){
 const saved={key:process.env.GEMINI_API_KEY,enabled:process.env.ASSISTANT_GEMINI_ENABLED,model:process.env.GEMINI_MODEL};
 try{
  process.env.GEMINI_API_KEY='synthetic-key';process.env.ASSISTANT_GEMINI_ENABLED='false';
  let sent=0, last;
  const response=plan=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(plan)}]}}]});
  const ok={status:'query',kind:'contracts',from:'2024-01-01',to:'2024-12-31'};
  const mock=async(url,init)=>{sent++;last={url,init};return response(ok);};
  let g=load('lib/assistant/gemini.ts',{'./schema':schema},{fetch:mock});
  await assert.rejects(g.planWithGemini('Quante vendite registrate nel 2024?'),/non è ancora attivo/);assert.equal(sent,0);
  process.env.ASSISTANT_GEMINI_ENABLED='true';delete process.env.GEMINI_MODEL;
  assert.doesNotThrow(()=>g.validatePublicQuestion('Vendite dal 2026-01-01 al 23/10/2026'));
  for(const question of ['cliente di nome Mario Rossi','email test@example.test','targa AB123CD','telefono 3331234567','vedi https://example.test'])await assert.rejects(g.planWithGemini(question));
  assert.equal(sent,0);
  assert.equal((await g.interpretAssistantQuestion('Quanti contratti abbiamo nel 2025?')).engine,'local');assert.equal(sent,0);
  const previous={kind:'contracts',from:'2025-01-01',to:'2025-12-31'};
  let follow=await g.interpretAssistantQuestion('E nel 2024?',previous);assert.equal(follow.query.from,'2024-01-01');assert.equal(follow.query.to,'2024-12-31');
  follow=await g.interpretAssistantQuestion('E quelli da lead?',previous);assert.equal(follow.query.kind,'lead-contracts');assert.equal(follow.query.from,previous.from);
  follow=await g.interpretAssistantQuestion('E l’anno prima?',{...previous,from:'2026-01-01',to:'2026-10-23'});assert.equal(follow.query.to,'2025-10-23');
  await assert.rejects(g.interpretAssistantQuestion('E nel 2025?',{...previous,from:'2024-02-29',to:'2024-02-29'}));
  await assert.rejects(g.interpretAssistantQuestion('E l’anno prima?',{...previous,from:'2024-01-01',to:'2024-12-31'}));
  await assert.rejects(g.interpretAssistantQuestion('E nel 2024?',{...previous,seller:'test'}));assert.equal(sent,0);

  assert.equal((await g.planWithGemini('Quante vendite registrate nel 2024?',new Date('2026-10-22T23:30:00Z'))).from,'2024-01-01');
  assert.ok(!last.url.includes('synthetic-key'));assert.equal(last.init.headers['x-goog-api-key'],'synthetic-key');
  const payload=JSON.parse(last.init.body),question=JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(question.today,'2026-10-23');assert.deepEqual(Object.keys(question).sort(),['question','timeZone','today']);
  assert.equal(payload.tools,undefined);assert.equal(payload.generationConfig.responseMimeType,'application/json');
  assert.ok(payload.systemInstruction.parts[0].text.includes('## Ruolo e stile'));assert.ok(!payload.systemInstruction.parts[0].text.includes('389'));
  for(const plan of [{...ok,status:'unsupported',kind:'none',from:'',to:''},{...ok,status:'clarification',kind:'none',from:'',to:''},{...ok,from:'2024-02-31'},{...ok,seller:'NON_CONFIGURATO'},{...ok,kind:'sql'},{...ok,from:'2023-01-01',to:'2023-12-31'}]){
   g=load('lib/assistant/gemini.ts',{'./schema':schema},{fetch:async()=>response(plan)});await assert.rejects(g.planWithGemini('domanda aggregata'));
  }
  g=load('lib/assistant/gemini.ts',{'./schema':schema},{fetch:async()=>new Response('private-provider-error',{status:429})});
  await assert.rejects(g.planWithGemini('domanda aggregata'),e=>e instanceof g.GeminiUnavailable&&!e.message.includes('private-provider-error'));
  g=load('lib/assistant/gemini.ts',{'./schema':schema},{fetch:async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:JSON.stringify(ok)}]}}]})});
  await assert.rejects(g.planWithGemini('domanda aggregata'),e=>e instanceof g.GeminiUnavailable);
  g=load('lib/assistant/gemini.ts',{'./schema':schema},{fetch:mock});
  for(let i=0;i<10;i++)await g.planWithGemini('domanda aggregata');
  await assert.rejects(g.planWithGemini('domanda aggregata'),e=>e instanceof g.GeminiUnavailable);
  console.log('PASS: Gemini disattivato, identificativi bloccati, richieste locali senza AI, date Roma, piano validato, filtri extra rifiutati, errori senza dettagli, throttle');
 }finally{
  for(const [name,value] of [['GEMINI_API_KEY',saved.key],['ASSISTANT_GEMINI_ENABLED',saved.enabled],['GEMINI_MODEL',saved.model]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}
 }
}
