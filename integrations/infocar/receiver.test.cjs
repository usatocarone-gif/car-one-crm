const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const python=process.env.PYTHON || 'C:/Users/Utente/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const py="import sys,json,xml.etree.ElementTree as E\ndef tree(e):\n return {'name':e.tag.split('}')[-1],'ns':e.tag[1:].split('}')[0] if e.tag.startswith('{') else '', 'text':e.text or '', 'children':[tree(c) for c in e]}\nprint(json.dumps(tree(E.fromstring(sys.stdin.read()))))";
function facade(node){return {getName:()=>node.name,getNamespace:()=>({getURI:()=>node.ns}),getText:()=>node.text,getChildren:()=>node.children.map(facade)};}
const properties={};
const context={console,Date,JSON,Set,PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key]||null,setProperty:(key,value)=>properties[key]=value})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,text)=>[...crypto.createHash('sha256').update(text).digest()]},XmlService:{parse:xml=>({getRootElement:()=>facade(JSON.parse(execFileSync(python,['-c',py],{input:xml,encoding:'utf8'})))})},ContentService:{MimeType:{JSON:'json'},createTextOutput:value=>({getContent:()=>value,setMimeType(){return this;}})}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/receiver.gs','utf8'),context);
const xml=(id='123',extra='',client='Cliente Test')=>`<Archivio_Preventivi xmlns="http://tempuri.org/IntegrationSchema.xsd"><Preventivo><Preventivo_ID><codpreventivo>${id}</codpreventivo><sede>TEST</sede><tipo>U</tipo><data>2026-10-16</data><funzvendita>38475</funzvendita></Preventivo_ID><cliente><ragionesociale>${client}</ragionesociale></cliente><veicolo><descrizione>Auto test</descrizione></veicolo>${extra}</Preventivo></Archivio_Preventivi>`;
const record=context.iw3Parse_(xml())[0];
const plan=(records=[record],central=[],previous=[])=>context.iw3Plan_(records,central,previous,'2026-10-01','2026-10-16');
test('namespace ufficiale e soli campi necessari',()=>{assert.equal(record.id,'123');assert.equal(record.sellerCode,'38475');assert.equal(record.client,'Cliente Test');assert.equal(record.phone,undefined);});
test('ID senza perdita di precisione',()=>assert.equal(context.iw3Parse_(xml('9223372036854775807'))[0].id,'9223372036854775807'));
test('date non valide, XML estraneo e DTD rifiutati',()=>{assert.throws(()=>context.iw3Parse_(xml().replace('2026-10-16','2026-02-31')));assert.throws(()=>context.iw3Parse_('<Stock_usato/>'));assert.throws(()=>context.iw3Parse_('<!DOCTYPE test>'+xml()));});
test('ID duplicati discordanti rifiutano intero invio',()=>{const second=xml('123','','Altro Test').replace(/^.*?<Preventivo>/,'<Preventivo>').replace('</Archivio_Preventivi>','');assert.throws(()=>context.iw3Parse_(xml().replace('</Archivio_Preventivi>',second+'</Archivio_Preventivi>')));});
test('upload multipart, raw e form',()=>{assert.equal(context.iw3Extract_({postData:{contents:xml(),type:'application/xml'}}),xml());assert.equal(context.iw3Extract_({postData:{contents:'--abc\r\nContent-Disposition: form-data; name="file"; filename="preventivi.xml"\r\nContent-Type: text/xml\r\n\r\n'+xml()+'\r\n--abc--\r\n',type:'multipart/form-data; boundary=abc'}}),xml());assert.equal(context.iw3Extract_({postData:{contents:'test',type:'application/x-www-form-urlencoded'},parameters:{payload:[xml()]}}),xml());});
test('upload multiplo e file eccessivo rifiutati',()=>{assert.throws(()=>context.iw3Extract_({postData:{contents:'x',type:'multipart/form-data; boundary=abc'}}));assert.throws(()=>context.iw3Extract_({postData:{contents:xml(),type:'text/xml',length:10000001}}));});
test('file decodificato da Google senza postData',()=>{assert.equal(context.iw3Extract_({parameters:{file:[xml()],iw3key:['ignored']}}),xml());assert.throws(()=>context.iw3Extract_({parameters:{file:[xml(),xml('124')]}}));});
test('endpoint chiuso senza chiave, chiave errata e modalità assente',()=>{assert.equal(JSON.parse(context.doPost({parameter:{}}).getContent()).ok,false);properties.IW3_RECEIVER_SECRET='x'.repeat(64);assert.equal(JSON.parse(context.doPost({parameter:{iw3key:'wrong'}}).getContent()).ok,false);assert.equal(JSON.parse(context.doPost({parameter:{iw3key:'x'.repeat(64)}}).getContent()).ok,false);});
test('nuovo preventivo assegnato alla scheda corretta',()=>{const p=plan()[0];assert.equal(p.state,'NUOVO');assert.equal(p.key,'iw3:carone:123');assert.equal(p.team[1],'PREV_Caironi');});
test('riesecuzione conserva esito, richiamo e nota esistenti',()=>{const row=['iw3:carone:123','16/10/2026','Caironi','Cliente Test','Auto test','RICHIAMATO','16/10/2026','20/10/2026','Nota da conservare'];const before=JSON.stringify(row);assert.equal(plan([record],[row])[0].state,'GIA_PRESENTE');assert.equal(JSON.stringify(row),before);});
test('preventivo manuale simile richiede verifica, senza duplicarlo',()=>{const row=['prev:manuale','16/10/2026 09:30','Caironi','Test Cliente','','RICHIAMATO','','','Nota'];assert.equal(plan([record],[row])[0].state,'POSSIBILE_DUPLICATO_DA_VERIFICARE');});
test('venditore ignoto, date future e storico esclusi',()=>{assert.equal(plan([{...record,sellerCode:'999'}])[0].state,'VENDITORE_DA_ABBINARE');assert.equal(plan([{...record,date:'2026-10-17'}])[0].state,'DATA_FUTURA_DA_VERIFICARE');assert.equal(plan([{...record,date:'2026-09-30'}])[0].state,'FUORI_PERIODO');});
test('contratti, ritiri ed eliminati non diventano nuovi richiami',()=>{assert.equal(plan([{...record,contractDate:'2026-10-16'}])[0].state,'CONTRATTO_IN_FONTE');assert.equal(plan([{...record,type:'R'}])[0].state,'TIPO_ESCLUSO');assert.equal(plan([{...record,deleted:true}])[0].state,'ELIMINATO_IN_FONTE');});
test('Rossi assegnato alla scheda Pagliara senza usare email manager',()=>assert.equal(plan([{...record,sellerCode:'14721'}])[0].team[1],'PREV_Rossi'));
test('nessuna formula da dati XML',()=>assert.equal(context.iw3SafeCell_('=IMPORTXML("bad")'),'\'=IMPORTXML("bad")'));
test('due codici stesso cliente e giorno non vengono fusi',()=>{const p=plan([record,{...record,id:'124'}]);assert(p.every(item=>item.state==='POSSIBILE_DUPLICATO_DA_VERIFICARE'));});

test('scrittura simulata e retry non duplicano né sovrascrivono le note',()=>{
 const headers=vm.runInContext('({central:IW3_CENTRAL_HEADER,personal:IW3_PERSONAL_HEADER,inbox:IW3_INBOX_HEADER,team:IW3_TEAM})',context);
 const all={};
 const makeSheet=(name,rows)=>{
  const sheet={rows,getLastRow:()=>rows.length,getMaxRows:()=>1000,insertRowsAfter:()=>{},setFrozenRows:()=>{},protect:()=>({setDescription(){return this;},removeEditors(){return this;},getEditors:()=>[],canDomainEdit:()=>false}),
   getRange:(r,c,n,m)=>({getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>String(rows[r-1+i]?.[c-1+j]??''))),setNumberFormat(){return this;},setValues(values){values.forEach((line,i)=>{rows[r-1+i]??=[];line.forEach((v,j)=>rows[r-1+i][c-1+j]=v);});return this;}})};
  all[name]=sheet;return sheet;
 };
 makeSheet('CONFIGURAZIONE',[['Parametro','Valore'],['preventivi_da_data','2026-10-01']]);
 makeSheet('PREVENTIVI_OPERATIVI',[[...headers.central]]);
 Object.values(headers.team).forEach(pair=>makeSheet(pair[1],[[...headers.personal]]));
 context.SpreadsheetApp={openById:()=>({getSheetByName:name=>all[name],insertSheet:name=>makeSheet(name,[])})};
 context.Utilities.formatDate=()=> '2026-10-16';
 properties.IW3_ACCOUNT_AND_SELLERS_CONFIRMED='TRUE';properties.IW3_MORNING_COMPATIBLE='TRUE';
 let result=context.iw3Receive_([record],'active');assert.equal(result.written,1);
 const row=all.PREV_Caironi.rows[1];row[4]='RICHIAMATO';row[5]='16/10/2026';row[7]='Nota intatta';
 const before=JSON.stringify(row);result=context.iw3Receive_([record],'active');assert.equal(result.written,0);assert.equal(all.PREV_Caironi.rows.length,2);assert.equal(all.PREVENTIVI_OPERATIVI.rows.length,2);assert.equal(JSON.stringify(row),before);
 all.PREV_Caironi.rows.pop();result=context.iw3Receive_([record],'active');assert.equal(result.written,0);assert.equal(all.PREV_Caironi.rows.length,2);
 assert.equal(all.IW3_RICEZIONI.rows.length,2);
});
