// Additive module for the existing, token-protected Car One Apps Script web app.
// Default: disabled. No raw XML, phone, email, identity or financial data is stored.
const IW3_BOOK = '19XAvwQY9gg1yCC-FSkfCwiqaS9bmNiHQhuhuaoB6rHA';
const IW3_TEAM = {
  '36606': ['Bordini','PREV_Bordini'], '38475': ['Caironi','PREV_Caironi'],
  '29832': ['Liguori','PREV_Liguori'], '14749': ['Monacelli','PREV_Monacelli'],
  '14712': ['Grandolini','PREV_Grandolini'], '14721': ['Rossi Massimo','PREV_Rossi']
};
const IW3_INBOX_HEADER = ['ID Infocar','Data','Codice venditore','Venditore','Cliente','Veicolo','Tipo','Data contratto','Stato Infocar','Data stato','Eliminato','Impronta','Esito','ID operativo','Ricezione UTC'];
const IW3_CENTRAL_HEADER = ['ID preventivo','Data preventivo','Venditore','Cliente','Veicolo','Stato','Ultimo richiamo','Prossimo richiamo','Nota venditore','Link originale','Info originale'];
const IW3_PERSONAL_HEADER = ['ID preventivo','Data','Cliente','Veicolo','Stato','Ultimo richiamo','Prossimo richiamo','Nota'];

function doPost(e) {
  const properties = PropertiesService.getScriptProperties();
  const expected = properties.getProperty('IW3_RECEIVER_SECRET');
  const received = e && e.parameter && e.parameter.iw3key;
  if (!expected || expected.length < 40 || !iw3Equal_(expected, received || '')) return iw3Response_({ok:false,error:'Non autorizzato'});
  const mode = properties.getProperty('IW3_RECEIVER_MODE');
  if (mode !== 'preview' && mode !== 'active') return iw3Response_({ok:false,error:'Ricevitore non abilitato'});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return iw3Response_({ok:false,error:'Ricezione occupata: riprovare'});
  let phase='upload';
  try {
    const xml = iw3Extract_(e);
    phase='xml';
    const records = iw3Parse_(xml);
    phase='database';
    const result = iw3Receive_(records, mode);
    return iw3Response_(Object.assign({ok:true,mode:mode},result));
  } catch (error) {
    // Never reflect an XML body, customer data, parser error or secret in HTTP responses/logs.
    console.error('IW3 importazione rifiutata');
    const diagnostics=mode==='preview'?{phase:phase,type:String(e.postData && e.postData.type || '').split(';')[0],hasBoundary:/^\s*--/.test(e.postData && e.postData.contents || ''),hasAttachment:/filename\s*=/i.test(e.postData && e.postData.contents || '')}:undefined;
    return iw3Response_({ok:false,error:'File non valido o configurazione incompleta. Verificare il ricevitore.',diagnostics:diagnostics});
  } finally { lock.releaseLock(); }
}
function iw3Response_(result) { return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON); }
function iw3Equal_(a,b) { let diff = a.length ^ b.length; for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i)||0); return diff === 0; }
function iw3Hash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join(''); }
function iw3Text_(value) { return String(value == null ? '' : value).trim(); }
function iw3SafeCell_(value) { const text = iw3Text_(value); return /^[=+@\-]/.test(text) ? "'"+text : text; }
function iw3Day_(value) {
  const text=iw3Text_(value), iso=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/), it=text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:$|\s)/);
  if (!iso && !it) return '';
  const y=+(iso?iso[1]:it[3]),m=+(iso?iso[2]:it[2]),d=+(iso?iso[3]:it[1]),date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d ? y+'-'+('0'+m).slice(-2)+'-'+('0'+d).slice(-2) : '';
}
function iw3Extract_(e) {
  // Google can parse multipart uploads into e.parameters and omit e.postData.
  const parameterXml=Object.keys(e && e.parameters || {}).filter(function(key){return key!=='iw3key';}).reduce(function(all,key){return all.concat(e.parameters[key]);},[]).filter(function(value){return typeof value==='string' && /^\s*(?:<\?xml|<Archivio_Preventivi)/.test(value);});
  if(parameterXml.length>1)throw Error('Atteso un file XML');
  if(parameterXml.length===1){if(parameterXml[0].length>10000000)throw Error('Dimensione file');return parameterXml[0];}
  const post=e && e.postData;
  if (!post || !post.contents || post.length > 10000000) throw Error('Dimensione file');
  const type=String(post.type || '').toLowerCase(), body=post.contents;
  if (/multipart\/form-data/.test(type)) {
    // Apps Script may expose only the MIME type, omitting the boundary parameter.
    const match=String(post.type).match(/boundary=(?:"([^"]+)"|([^;\s]+))/i) || body.match(/^--([^\r\n]{1,200})\r?\n/);
    if (!match) throw Error('Boundary mancante');
    const parts=body.split('--'+(match[1]||match[2])), xml=[];
    parts.forEach(function(part){
      const separator=part.match(/\r?\n\r?\n/); if(!separator) return;
      const split=separator.index;
      const header=part.slice(0,split), content=part.slice(split+separator[0].length).replace(/\r?\n$/,'');
      if (/filename=/i.test(header) && content.trim()) xml.push(content);
    });
    if (xml.length !== 1) throw Error('Atteso un file XML');
    return xml[0];
  }
  if (/application\/x-www-form-urlencoded/.test(type)) {
    const candidates=Object.keys(e.parameters || {}).filter(function(key){return key !== 'iw3key';}).reduce(function(all,key){return all.concat(e.parameters[key]);},[]).filter(function(value){return /^\s*(?:<\?xml|<Archivio_Preventivi)/.test(value);});
    if(candidates.length!==1) throw Error('Atteso XML form'); return candidates[0];
  }
  if (!/^(?:application\/(?:xml|octet-stream)|text\/(?:xml|plain))(?:;|$)/.test(type)) throw Error('Tipo non supportato');
  return body;
}
function iw3Parse_(xml) {
  if (xml.length>10000000 || /<!DOCTYPE|<!ENTITY|\uFFFD/i.test(xml)) throw Error('XML non consentito o codifica non valida');
  const root=XmlService.parse(xml.replace(/^\uFEFF/,'')).getRootElement();
  if(root.getName()!=='Archivio_Preventivi' || !['','http://tempuri.org/IntegrationSchema.xsd'].includes(root.getNamespace().getURI())) throw Error('Archivio non riconosciuto');
  function child(node,name) { return node && node.getChildren().filter(function(c){return c.getName()===name;})[0]; }
  function field(node,name) { const item=child(node,name); return item ? iw3Text_(item.getText()) : ''; }
  const seen={},records=[];
  root.getChildren().forEach(function(node){
    if(node.getName()!=='Preventivo') throw Error('Nodo non riconosciuto');
    const identity=child(node,'Preventivo_ID'),client=child(node,'cliente'),vehicle=child(node,'veicolo');
    const id=field(identity,'codpreventivo'),rawDate=field(identity,'data'),date=iw3Day_(rawDate);
    if (!/^\d{1,19}$/.test(id) || /^0+$/.test(id) || !date) throw Error('ID o data non valida');
    const company=field(client,'ragionesociale'),name=field(client,'nome');
    const record={id:id,date:date,sellerCode:field(identity,'funzvendita'),client:[company,name].filter(Boolean).join(' '),vehicle:field(vehicle,'descrizione') || [field(vehicle,'descrmarca'),field(vehicle,'descrmodello')].filter(Boolean).join(' '),type:field(identity,'tipo'),contractDate:field(node,'datavendita'),sourceStatus:field(identity,'ultimostato'),statusDate:field(identity,'datastato'),deleted:field(identity,'flg_delete')==='S'};
    if(record.contractDate && !iw3Day_(record.contractDate)) throw Error('Data contratto non valida');
    if(record.statusDate && !iw3Day_(record.statusDate)) throw Error('Data stato non valida');
    record.contractDate=iw3Day_(record.contractDate); record.statusDate=iw3Day_(record.statusDate);
    if(!record.client || record.client.length>200 || record.vehicle.length>500 || record.sourceStatus.length>300) throw Error('Campi non validi');
    record.hash=iw3Hash_(JSON.stringify(record));
    if(seen[id] && seen[id]!==record.hash) throw Error('ID duplicato discordante');
    if(!seen[id]) records.push(record); seen[id]=record.hash;
  });
  if(records.length>15000) throw Error('Troppi record');
  return records;
}
function iw3Signature_(seller,date,client) { return JSON.stringify([seller,iw3Day_(date),iw3Text_(client).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ')]); }

// Pure planner: existing seller status/dates/notes are never updated by the import.
function iw3Plan_(records, central, previous, cutoff, today) {
  const index={}, aliases={}, used={}, signatures={};
  central.forEach(function(row){ if(!row[0])return;if(index[row[0]])throw Error('ID operativi duplicati');index[row[0]]=row; });
  previous.forEach(function(row){if(row[0] && row[13]){aliases[row[0]]=row[13];used[row[13]]=row[0];}});
  records.forEach(function(r){const team=IW3_TEAM[r.sellerCode];if(team){const key=iw3Signature_(team[0],r.date,r.client);signatures[key]=(signatures[key]||0)+1;}});
  return records.map(function(record){
    const team=IW3_TEAM[record.sellerCode];let state='',key=aliases[record.id]||'iw3:carone:'+record.id;
    if(record.date<cutoff)state='FUORI_PERIODO';
    else if(record.date>today)state='DATA_FUTURA_DA_VERIFICARE';
    else if(!team)state='VENDITORE_DA_ABBINARE';
    else if(!['U','NC','NFC'].includes(record.type))state='TIPO_ESCLUSO';
    else if(record.deleted)state='ELIMINATO_IN_FONTE';
    else if(record.contractDate)state='CONTRATTO_IN_FONTE';
    else if(index[key])state=index[key][2]===team[0]?'GIA_PRESENTE':'ASSEGNAZIONE_DA_VERIFICARE';
    else if(aliases[record.id])state='COLLEGAMENTO_DA_VERIFICARE';
    else {
      const signature=iw3Signature_(team[0],record.date,record.client);
      const matches=central.filter(function(row){return iw3Signature_(row[2],row[1],row[3])===signature;});
      // First import does not guess links to manually loaded quotes. Review the candidates once.
      state=(matches.length || signatures[signature]>1)?'POSSIBILE_DUPLICATO_DA_VERIFICARE':'NUOVO';
    }
    return {record:record,team:team,key:key,state:state};
  });
}
function iw3Read_(book,name,header) {
  const sheet=book.getSheetByName(name);if(!sheet)throw Error('Scheda mancante');
  const values=sheet.getRange(1,1,Math.max(1,sheet.getLastRow()),header.length).getDisplayValues();
  if(header.some(function(value,index){return values[0][index]!==value;}))throw Error('Colonne non riconosciute');
  const seen={};values.slice(1).forEach(function(row){if(!row[0])return;if(seen[row[0]])throw Error('ID duplicati nella scheda');seen[row[0]]=true;});
  return {sheet:sheet,rows:values.slice(1)};
}
function iw3Append_(sheet,rows) {
  if(!rows.length)return;
  const start=sheet.getLastRow()+1,required=start+rows.length-1;
  if(required>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),required-sheet.getMaxRows());
  sheet.getRange(start,1,rows.length,rows[0].length).setNumberFormat('@').setValues(rows.map(function(row){return row.map(iw3SafeCell_);}));
}
function iw3Receive_(records,mode) {
  const book=SpreadsheetApp.openById(IW3_BOOK),config=book.getSheetByName('CONFIGURAZIONE');
  if(!config)throw Error('Configurazione mancante');
  const cutoffEntry=config.getRange(1,1,config.getLastRow(),2).getDisplayValues().filter(function(row){return row[0]==='preventivi_da_data';})[0];
  const cutoff=cutoffEntry && iw3Day_(cutoffEntry[1]);if(!cutoff)throw Error('Cutoff mancante');
  const central=iw3Read_(book,'PREVENTIVI_OPERATIVI',IW3_CENTRAL_HEADER);
  const inboxSheet=book.getSheetByName('IW3_RICEZIONI'),inbox=inboxSheet?iw3Read_(book,'IW3_RICEZIONI',IW3_INBOX_HEADER).rows:[];
  const today=Utilities.formatDate(new Date(),'Europe/Rome','yyyy-MM-dd');
  const plan=iw3Plan_(records,central.rows,inbox,cutoff,today),counts={};
  plan.forEach(function(item){counts[item.state]=(counts[item.state]||0)+1;});
  if(mode==='preview')return {received:records.length,counts:counts,written:0};
  const properties=PropertiesService.getScriptProperties();
  if(properties.getProperty('IW3_ACCOUNT_AND_SELLERS_CONFIRMED')!=='TRUE' || properties.getProperty('IW3_MORNING_COMPATIBLE')!=='TRUE')throw Error('Conferme di integrazione mancanti');
  // Validate every personal tab before the first write.
  const personal={};Object.keys(IW3_TEAM).forEach(function(code){const pair=IW3_TEAM[code];personal[pair[1]]=iw3Read_(book,pair[1],IW3_PERSONAL_HEADER);personal[pair[1]].rows.forEach(function(row){if(!row[0])return;const owner=central.rows.filter(function(c){return c[0]===row[0];})[0];if(!owner || owner[2]!==pair[0])throw Error('Assegnazione scheda non valida');});});
  const newCentral=[],newPersonal={},now=new Date().toISOString();
  plan.forEach(function(item){
    if(!['NUOVO','GIA_PRESENTE'].includes(item.state))return;
    const r=item.record,pair=item.team;
    let row=central.rows.filter(function(existing){return existing[0]===item.key;})[0];
    if(!row){row=[item.key,r.date.split('-').reverse().join('/'),pair[0],r.client,r.vehicle,'DA RICHIAMARE','','','','','Infocar #'+r.id];newCentral.push(row);}
    const tab=personal[pair[1]];
    if(!tab.rows.some(function(existing){return existing[0]===item.key;})){
      (newPersonal[pair[1]]||(newPersonal[pair[1]]=[])).push([row[0],row[1],row[3],row[4],row[5],row[6]||'',row[7]||'',row[8]||'']);
    }
  });
  // Central first: a retry repairs missing personal rows using the stable ID.
  iw3Append_(central.sheet,newCentral);
  Object.keys(newPersonal).forEach(function(name){iw3Append_(personal[name].sheet,newPersonal[name]);});
  // Inbox contains latest source metadata; no seller-editable data is written here.
  const existing={};inbox.forEach(function(row){existing[row[0]]=row;});
  plan.forEach(function(item){const r=item.record;existing[r.id]=[r.id,r.date,r.sellerCode,item.team?item.team[0]:'',r.client,r.vehicle,r.type,r.contractDate,r.sourceStatus,r.statusDate,r.deleted?'TRUE':'FALSE',r.hash,item.state,['NUOVO','GIA_PRESENTE'].includes(item.state)?item.key:'',now];});
  let target=inboxSheet;
  if(!target){target=book.insertSheet('IW3_RICEZIONI');target.getRange(1,1,1,IW3_INBOX_HEADER.length).setValues([IW3_INBOX_HEADER]);target.setFrozenRows(1);const protection=target.protect().setDescription('Registro tecnico Infocar: solo amministrazione');protection.removeEditors(protection.getEditors());if(protection.canDomainEdit())protection.setDomainEdit(false);}
  const values=Object.keys(existing).map(function(id){return existing[id];});
  if(values.length){const range=target.getRange(2,1,values.length,IW3_INBOX_HEADER.length);range.setNumberFormat('@').setValues(values.map(function(row){return row.map(iw3SafeCell_);}));}
  properties.setProperty('IW3_LAST_RECEIPT',JSON.stringify({receivedAt:now,received:records.length,counts:counts,added:newCentral.length}));
  return {received:records.length,counts:counts,written:newCentral.length};
}

function verificaRicevitoreInfocar() {
  const xml='<Archivio_Preventivi xmlns="http://tempuri.org/IntegrationSchema.xsd"><Preventivo><Preventivo_ID><codpreventivo>900000000000001</codpreventivo><sede>TEST</sede><tipo>U</tipo><data>2026-10-16</data><funzvendita>38475</funzvendita></Preventivo_ID><cliente><ragionesociale>TEST NON IMPORTARE</ragionesociale></cliente><veicolo><descrizione>TEST</descrizione></veicolo></Preventivo></Archivio_Preventivi>';
  const parsed=iw3Parse_(xml),plan=iw3Receive_(parsed,'preview');
  console.log(JSON.stringify({test:'Solo simulazione, nessuna scrittura',result:plan,authRejectsMissingKey:JSON.parse(doPost({parameter:{}}).getContent()).ok===false}));
}
