// Read-only assistant adapter. No call into Infocar, mail, triggers or write helpers.
// Built on the verified v51; kept separate from legacy dashboard calculations.
function assistantDay_(value) {
  if (value instanceof Date) {
    if (!isFinite(value.getTime())) return null;
    value = Utilities.formatDate(value, 'Europe/Rome', 'yyyy-MM-dd');
  }
  const text = String(value == null ? '' : value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const it = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!iso && !it) return null;
  const y = +(iso ? iso[1] : it[3]), m = +(iso ? iso[2] : it[2]), d = +(iso ? iso[3] : it[1]);
  if (y < 2000 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
}
function assistantRef_(book, sheet, row, values) {
  return {
    locatorId: book.getId() + ':' + sheet.getSheetId() + ':' + row,
    source: sheet.getName(), row: row,
    url: book.getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + row + ':N' + row,
    // Fingerprint detects a changed row; a row number is NOT a permanent business ID.
    fingerprint: Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(values)))
  };
}
function assistantSource_(name, readAt, coverage) {
  return {name:name,status:'available',readAt:readAt,coverage:coverage,issues:[]};
}
function assistantIssue_(source, message) {
  if (source.status !== 'unavailable') source.status = 'partial';
  if (source.issues.length < 100) source.issues.push(message);
}
function assistantRead_(parameter) {
  const q = {kind:parameter.kind,from:parameter.from,to:parameter.to};
  if (['contracts','lead-contracts','agenda-quotes','lead-quality','leads','quotes','appointments','funnel','lead-management','vehicle-sales'].indexOf(q.kind) < 0 || assistantDay_(q.from) !== q.from || assistantDay_(q.to) !== q.to || q.from > q.to) throw new Error('Parametri assistente non validi');
  if ((Date.parse(q.to) - Date.parse(q.from)) / 86400000 > 366 || (q.kind === 'agenda-quotes' && q.from !== q.to)) throw new Error('Periodo assistente non valido');
  const now = new Date(), readAt = now.toISOString();
  const result = {schemaVersion:'assistant-v1',query:q,generatedAt:readAt,sources:[],rows:[],truncated:false};
  if (q.kind === 'contracts' || q.kind === 'lead-contracts' || q.kind === 'vehicle-sales') assistantContracts_(result,now);
  if (q.kind === 'agenda-quotes') assistantAgendaQuotes_(result,now);
  if (q.kind === 'lead-quality') assistantLeadQuality_(result);
  function read(dataset,reader){const count=result.sources.length;reader();result.sources.slice(count).forEach(function(source){source.dataset=dataset;});}
  if (q.kind === 'leads' || q.kind === 'funnel') read('leads',function(){assistantLeads_(result,now);});
  if (q.kind === 'quotes' || q.kind === 'funnel') read('quotes',function(){assistantQuotes_(result,now);});
  if (q.kind === 'appointments' || q.kind === 'funnel') read('appointments',function(){assistantAppointments_(result);});
  if (q.kind === 'lead-management') read('management',function(){assistantManagement_(result,now);});
  if (q.kind === 'funnel') {
    const count=result.rows.length;read('contracts',function(){assistantContracts_(result,now);});
    result.rows.slice(count).forEach(function(row){row.metric='contract';});
  }
  if (result.rows.length > 50000) { result.truncated = true; result.rows = []; }
  return result;
}
function assistantContracts_(result,now) {
  const q = result.query, today = assistantDay_(now), month = today.slice(0,7);
  let book;
  try { book = SpreadsheetApp.openById(SALES_ID); }
  catch (_) { result.sources.push({name:'Venduto e proiezioni',status:'unavailable',readAt:result.generatedAt,coverage:q.from+' / '+q.to,issues:['Fonte non accessibile']}); return; }
  const specs = [], closedYears = {};
  for (let cursor = new Date(q.from+'T12:00:00Z'); cursor.toISOString().slice(0,10) <= q.to; cursor.setUTCDate(cursor.getUTCDate()+1)) {
    const day = cursor.toISOString().slice(0,10);
    if (day.slice(0,7) < month) closedYears[day.slice(0,4)] = true;
  }
  Object.keys(closedYears).forEach(function(year) {
    if (['2024','2025','2026'].indexOf(year) < 0) {
      result.sources.push({name:'Venduto '+year,status:'unavailable',readAt:result.generatedAt,coverage:year,issues:['Anno non configurato, non equivale a zero']}); return;
    }
    specs.push({names:['CAR '+year],company:'Car One',year:year,projection:false});
    const names = year === '2026' ? ['AD MOTOR 2026'] : ['AD MOTOR 24/25','AD MOTOR'];
    specs.push({names:names,company:'AD Motor',year:year,projection:false});
  });
  if (q.from.slice(0,7) <= month && q.to.slice(0,7) >= month) specs.push({names:["PROIEZ. REDDITIVITA'"],projection:true,year:month.slice(0,4)});
  if (q.to > today) result.sources.push({name:'Date future',status:'partial',readAt:result.generatedAt,coverage:q.from+' / '+q.to,issues:['Date future escluse: non sono contratti registrati alla data di lettura']});
  const candidates = [];
  specs.forEach(function(spec) {
    const source = assistantSource_(spec.names[0],result.generatedAt,spec.projection?'Solo mese corrente '+month:'Mesi chiusi '+spec.year);
    result.sources.push(source);
    try {
      const sheet = findSheetByNames_(book,spec.names);
      if (!sheet) { source.status='unavailable'; source.issues.push('Foglio mancante'); return; }
      source.name = sheet.getName();
      if (sheet.getLastRow()<2) return;
      const rows=sheet.getRange(2,2,sheet.getLastRow()-1,spec.projection?10:13).getValues();
      let invoiceIndex=-1;
      if(q.kind==='vehicle-sales'){
        if(spec.projection)assistantIssue_(source,'Importi provvisori esclusi: VAL. VENDITA / PROVVIGIONE non identifica un prezzo o importo fattura univoco.');
        else {
          const headers=sheet.getRange(1,1,1,Math.min(sheet.getLastColumn(),49)).getDisplayValues()[0];
          invoiceIndex=headers.findIndex(function(v){return String(v||'').toUpperCase().replace(/[^A-Z]/g,'')==='IMPFATT';})-1;
          if(invoiceIndex<0||invoiceIndex>=13)assistantIssue_(source,'Colonna IMP. FATT. non individuata: importi non disponibili.');
        }
      }
      rows.forEach(function(row,index) {
        if (!row.some(function(v){return v!=='';})) return;
        // Ignore wholly empty/template rows; populated business rows must be auditable.
        if (!row[1] && !row[2] && !row[3] && !row[4]) return;
        const ref=assistantRef_(book,sheet,index+2,row), day=assistantDay_(row[0]);
        if (!day) { assistantIssue_(source,'Data esclusa: riga '+(index+2)); return; }
        if (!spec.projection && day.slice(0,4)!==spec.year) return;
        if (spec.projection && day.slice(0,7)!==month) { assistantIssue_(source,'Riga fuori mese corrente non spostata: '+(index+2)); return; }
        if (day<q.from || day>q.to || day>today || (!spec.projection && day.slice(0,7)>=month)) return;
        if (!row[1] || !row[4] || (!row[2]&&!row[3])) { assistantIssue_(source,'Record incompleto escluso: riga '+(index+2)); return; }
        const property=String(row[5]||'').trim().toUpperCase();
        let company=spec.company;
        if (spec.projection) {
          if (/^AD(?:\b|_)/.test(property)) company='AD Motor';
          else if (/CAR\s*ONE|^CAR$/.test(property)) company='Car One';
          else { assistantIssue_(source,'Società non riconosciuta: riga '+(index+2)); return; }
        }
        const seller=normalizeHistorySeller_(row[4]);
        const origin=(!spec.projection && spec.year==='2024' && spec.company==='Car One') ? '' : String(row[spec.projection?6:5]||'').trim();
        const vehicleIdentity=String(row[2]||'').trim().toUpperCase()+'|'+String(row[3]||'').trim().toUpperCase();
        const key=saleKey_(new Date(day+'T12:00:00Z'),row[1],vehicleIdentity,seller,company);
        let vehicleFields={};
        if(q.kind==='vehicle-sales'){
          vehicleFields.vehicle=String(row[2]||'').trim().slice(0,300);
          if(!vehicleFields.vehicle)assistantIssue_(source,'Modello assente: riga '+(index+2));
          if(!spec.projection&&invoiceIndex>=0&&invoiceIndex<13){
            const amount=assistantInvoiceAmount_(row[invoiceIndex]);
            if(amount===null)assistantIssue_(source,'Importo fattura assente o non valido: riga '+(index+2));
            else vehicleFields.invoiceAmount=amount;
          }
        }
        candidates.push(Object.assign(vehicleFields,{key:key,source:source,date:day,category:(spec.projection?'Registrazioni provvisorie · ':'Contratti registrati · ')+company,seller:seller,value:1,origin:origin,evidence:ref}));
      });
    } catch (_) { source.status='unavailable'; source.issues.push('Lettura non completata'); }
  });
  const counts={}; candidates.forEach(function(r){counts[r.key]=(counts[r.key]||0)+1;});
  candidates.forEach(function(r){
    if (r.source.status==='unavailable') return;
    if (counts[r.key]>1) { assistantIssue_(r.source,'Duplicato sospetto escluso: riga '+r.evidence.row); return; }
    if (q.kind==='lead-contracts') {
      if (!r.origin) { assistantIssue_(r.source,'Origine mancante esclusa dai contratti da lead: riga '+r.evidence.row); return; }
      if (!assistantOriginIsLead_(r.origin)) return;
    }
    delete r.key; delete r.source; result.rows.push(r);
  });
}
function assistantLeadQuality_(result) {
  const source=assistantSource_('STORICO_V2',result.generatedAt,'Osservazioni giorno-venditore presenti nel periodo; ricostruzioni separate');
  result.sources.push(source);
  try {
    const rows=readLeadDailyQuality_(); // validates schema, duplicate keys, counts and observation time
    const book=SpreadsheetApp.openById('19XAvwQY9gg1yCC-FSkfCwiqaS9bmNiHQhuhuaoB6rHA'),sheet=book.getSheetByName('STORICO_V2');
    const raw=sheet.getDataRange().getValues(), refs={};
    raw.slice(1).forEach(function(r,i){if(r[0])refs[assistantDay_(r[1])+'|'+String(r[2]).trim().toUpperCase()]=assistantRef_(book,sheet,i+2,r);});
    const seen={};
    rows.forEach(function(r){
      if(r.date<result.query.from || r.date>result.query.to)return;
      if(!assistantDay_(r.date)||!refs[r.date+'|'+r.seller])throw new Error('Data o riferimento non valido');
      if(r.measurement==='evening-observation')seen[r.date+'|'+r.seller]=true;
      result.rows.push({date:r.date,category:r.measurement==='evening-observation'?'Osservazione serale':'Ricostruzione esclusa dal tasso',seller:r.seller,value:r.rate===null?'n.d.':r.rate,due:r.due,managed:r.managedWithinDay,measurement:r.measurement,evidence:refs[r.date+'|'+r.seller]});
    });
    let missing=0;
    for(let day=new Date(result.query.from+'T12:00:00Z');day.toISOString().slice(0,10)<=result.query.to;day.setUTCDate(day.getUTCDate()+1)) {
      SELLERS.forEach(function(seller){if(!seen[day.toISOString().slice(0,10)+'|'+seller])missing++;});
    }
    if(missing)assistantIssue_(source,'Osservazioni giorno-venditore mancanti: '+missing+'. Nessuna deduzione sull’attività svolta.');
  } catch (_) { source.status='unavailable';source.issues.push('Storico non valido o non accessibile: nessuna percentuale calcolata');result.rows=[]; }
}
function assistantAgendaQuotes_(result,now) {
  const day=result.query.from;
  const start=Utilities.parseDate(day+' 00:00','Europe/Rome','yyyy-MM-dd HH:mm');
  const next=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const end=Utilities.parseDate(next+' 00:00','Europe/Rome','yyyy-MM-dd HH:mm'),seen={};
  CRM_REPORT_CALENDAR_IDS.forEach(function(id){
    const source=assistantSource_('Calendario '+id,result.generatedAt,day);result.sources.push(source);
    try {
      const calendar=CalendarApp.getCalendarById(id);if(!calendar)throw new Error('Calendario mancante');
      const items=[];
      calendar.getEvents(start,end).forEach(function(event){
        if(!/\bAPP\b/i.test(event.getTitle()))return;
        const date=event.getStartTime();if(assistantDay_(date)!==day)return;
        const key=event.getId()+'|'+date.toISOString();if(seen[key])return;seen[key]=true;
        const eid=Utilities.base64EncodeWebSafe(event.getId().replace(/@google.com$/,'')+' '+id).replace(/=+$/,'');
        items.push({date:day,category:'Appuntamenti',seller:sellerFromText_(event.getTitle()),value:Utilities.formatDate(date,'Europe/Rome','HH:mm')+' · '+appointmentStatus_(event.getTitle()),evidence:{locatorId:key,source:source.name,url:'https://calendar.google.com/calendar/u/0/r/eventedit/'+eid}});
      });
      result.rows=result.rows.concat(items);
    }catch(_){source.status='unavailable';source.issues.push('Calendario non accessibile');}
  });
  const source=assistantSource_('Preventivi operativi',result.generatedAt,'Situazione attuale, valutata al '+day);result.sources.push(source);
  if(day!==assistantDay_(now))assistantIssue_(source,'Lo stato attuale dei preventivi non consente di ricostruire i richiami storici o futuri. Selezionare oggi.');
  else try {
    const data=readOperationalQuotes_();
    if(data.warning)assistantIssue_(source,data.warning);
    const book=SpreadsheetApp.openById('19XAvwQY9gg1yCC-FSkfCwiqaS9bmNiHQhuhuaoB6rHA');
    const config=book.getSheetByName('CONFIGURAZIONE').getDataRange().getDisplayValues();
    const entry=config.filter(function(r){return r[0]==='preventivi_da_data';})[0];
    const cutoff=entry&&assistantDay_(entry[1]);if(!cutoff)throw new Error('Cutoff non valido');
    source.coverage+='; registrazioni dal '+cutoff;
    // Return current open records. Due-date rules are shared with the CRM on the server.
    result.quoteCalendar=data.calendar;
    result.operationalQuotes=data.items.map(function(r){
      if(!assistantDay_(r.date)||(r.lastFollowup&&!assistantDay_(r.lastFollowup))||(r.nextFollowup&&!assistantDay_(r.nextFollowup)))throw new Error('Data non valida');
      return r;
    });
  } catch(_){source.status='unavailable';source.issues.push('Preventivi non accessibili o configurazione non valida');}
}

// Manual acceptance check: reads only; logs totals and data-quality notices, never client data.
function verificaAssistenteCarOne() {
  const now=new Date();
  const contracts=assistantRead_({kind:'contracts',from:'2025-01-01',to:'2025-12-31'});
  const leadContracts=assistantRead_({kind:'lead-contracts',from:'2025-01-01',to:'2025-12-31'});
  function safeSummary(result){
    const totals={};result.rows.forEach(function(r){totals[r.category]=(totals[r.category]||0)+1;});
    return {query:result.query,totals:totals,total:result.rows.length,truncated:result.truncated,sources:result.sources.map(function(x){return {name:x.name,status:x.status,issues:x.issues.slice(0,6)};})};
  }
  const duplicateRows=SpreadsheetApp.openById(SALES_ID).getSheetByName('CAR 2025').getRange(232,2,2,13).getValues();
  console.log(JSON.stringify({check:'duplicate2025',sameFields:duplicateRows[0].map(function(v,i){return {column:i+2,same:String(v)===String(duplicateRows[1][i])};}),platesPresent:duplicateRows.map(function(r){return Boolean(r[3]);})}));
  const today=assistantDay_(now);const agenda=assistantRead_({kind:'agenda-quotes',from:today,to:today});
  const quality=assistantRead_({kind:'lead-quality',from:'2026-10-01',to:'2026-10-20'});
  console.log(JSON.stringify({check:'other-sources',agenda:safeSummary(agenda),quoteRecords:(agenda.operationalQuotes||[]).length,quality:safeSummary(quality),due:quality.rows.filter(function(r){return r.measurement==='evening-observation';}).reduce(function(n,r){return n+r.due;},0),managed:quality.rows.filter(function(r){return r.measurement==='evening-observation';}).reduce(function(n,r){return n+r.managed;},0)}));
  console.log(JSON.stringify({check:'assistant-v1',contracts2025:safeSummary(contracts),leadContracts2025:safeSummary(leadContracts),checkedAt:now.toISOString()}));
}

// Timestamp validation for acquisition sources; legacy dashboard parsers stay unchanged.
function assistantArrival_(value) {
  if (value instanceof Date) return isFinite(value.getTime()) ? {day:assistantDay_(value),instant:value.toISOString()} : null;
  const text=String(value==null?'':value).trim();
  const day=assistantDay_(text); if(day)return {day:day,instant:null};
  const iso=text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/);
  if(iso){
    if(!assistantDay_(iso[1])||+iso[2]>23||+iso[3]>59||+iso[4]>59)return null;
    if(iso[6]!=='Z'&&(+iso[6].slice(1,3)>14||+iso[6].slice(4)>59||(+iso[6].slice(1,3)===14&&+iso[6].slice(4)!==0)))return null;
    const date=new Date(text);return isFinite(date.getTime())?{day:assistantDay_(date),instant:date.toISOString()}:null;
  }
  const italian=text.match(/^(\d{1,2}\/\d{1,2}\/\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(italian&&assistantDay_(italian[1])&&+italian[2]<=23&&+italian[3]<=59&&+(italian[4]||0)<=59){
    // Preserve the local day. A local timestamp without UTC offset is not a certified instant.
    return {day:assistantDay_(italian[1]),instant:null};
  }
  return null;
}
function assistantOpenLeads_(result) {
  try{return SpreadsheetApp.openById(LEADS_ID);}
  catch(_){result.sources.push({name:'Make Leads',status:'unavailable',readAt:result.generatedAt,coverage:result.query.from+' / '+result.query.to,issues:['Fonte non accessibile']});return null;}
}
function assistantLeads_(result,now) {
  const book=assistantOpenLeads_(result);if(!book)return;
  const today=assistantDay_(now),month=today.slice(0,7),q=result.query;
  const specs=leadHistorySources_(book,now).concat([{name:'Maggio',year:2025,month:5}]);
  const required={};
  for(let cursor=new Date(q.from.slice(0,7)+'-01T12:00:00Z');cursor.toISOString().slice(0,10)<=q.to;cursor.setUTCMonth(cursor.getUTCMonth()+1)){
    const key=cursor.toISOString().slice(0,7);if(key<=month)required[key]=false;
  }
  const selected=[],names={};
  specs.forEach(function(spec){const key=spec.year+'-'+('0'+spec.month).slice(-2);if(key<month&&Object.prototype.hasOwnProperty.call(required,key)&&!names[spec.name]){selected.push({name:spec.name,month:key});names[spec.name]=true;if(book.getSheetByName(spec.name))required[key]=true;}});
  if(Object.prototype.hasOwnProperty.call(required,month)){
    selected.push({name:'Foglio1',month:month});required[month]=Boolean(book.getSheetByName('Foglio1'));
  }
  // Pagliara's sheet also retains earlier arrivals. Do not assume it is current-month only.
  selected.push({name:'giuseppe lead',month:null});
  Object.keys(required).forEach(function(key){if(!required[key])result.sources.push({name:'Archivio lead '+key,status:'unavailable',readAt:result.generatedAt,coverage:key,issues:['Copertura mensile non configurata o archivio mancante; non equivale a zero']});});
  if(q.to>today)result.sources.push({name:'Lead: date future',status:'partial',readAt:result.generatedAt,coverage:q.from+' / '+q.to,issues:['Arrivi futuri esclusi']});
  const candidates=[];
  selected.forEach(function(spec){
    const source=assistantSource_(spec.name,result.generatedAt,spec.month||'Lead Pagliara nelle date richieste');result.sources.push(source);
    try{
      const sheet=book.getSheetByName(spec.name);if(!sheet)throw new Error();
      if(sheet.getLastRow()<1)return;
      const values=sheet.getRange(1,1,sheet.getLastRow(),10).getValues();
      const first=assistantArrival_(values[0][0])?0:1;
      values.slice(first).forEach(function(row,index){
        if(!row.some(function(v){return v!==''&&v!==null;}))return;
        const arrival=assistantArrival_(row[0]);
        if(!arrival){assistantIssue_(source,'Data arrivo esclusa: riga '+(index+first+1));return;}
        if(arrival.day<q.from||arrival.day>q.to||arrival.day>today)return;
        if(spec.month&&arrival.day.slice(0,7)!==spec.month){assistantIssue_(source,'Data fuori archivio: riga '+(index+first+1));return;}
        if(!row[1]&&!row[2]&&!row[4]){assistantIssue_(source,'Riga senza riferimenti lead esclusa: '+(index+first+1));return;}
        const rawId=String(row[9]||'').trim();
        const id=/^(?:\d{10,30}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(rawId)?rawId:'';
        if(rawId&&!id)assistantIssue_(source,'Valore non riconosciuto come ID lead: riga '+(index+first+1));
        const identity=JSON.stringify([arrival.instant||arrival.day,String(row[2]||'').trim().toLowerCase(),String(row[4]||'').replace(/\D/g,''),String(row[1]||'').trim().toLowerCase()]);
        candidates.push({key:id?'id:'+id:'event:'+identity,identity:identity,source:source,date:arrival.day,arrivedAt:arrival.instant,category:'Lead ricevuti',metric:'lead',channel:normalizeSource_(row[5]),seller:'Tutta l’azienda',value:1,evidence:assistantRef_(book,sheet,index+first+1,row)});
      });
    }catch(_){source.status='unavailable';source.issues.push('Lettura lead non completata');}
  });
  const seen={},byId={},byIdentity={};
  candidates.forEach(function(row){
    if(row.source.status==='unavailable')return;
    if(!byIdentity[row.identity])byIdentity[row.identity]={};
    if(row.key.indexOf('id:')===0){
      byIdentity[row.identity][row.key]=true;
      if(!byId[row.key])byId[row.key]={};byId[row.key][row.identity]=true;
    }
  });
  // Prefer ID-bearing representatives of exact events; never merge distinct explicit IDs.
  candidates.sort(function(a,b){return (a.key.indexOf('id:')===0?0:1)-(b.key.indexOf('id:')===0?0:1);});
  candidates.forEach(function(row){
    if(row.source.status==='unavailable')return;
    const hasId=row.key.indexOf('id:')===0,ids=Object.keys(byIdentity[row.identity]||{});
    if(hasId&&Object.keys(byId[row.key]).length>1){assistantIssue_(row.source,'ID lead con eventi discordanti escluso: riga '+row.evidence.row);return;}
    if(!hasId&&ids.length>1){assistantIssue_(row.source,'Copia senza ID ambigua esclusa: riga '+row.evidence.row);return;}
    const key=hasId?row.key:ids[0]||row.key;
    if(seen[key]){assistantIssue_(row.source,'Copia dello stesso evento esclusa: riga '+row.evidence.row);return;}
    seen[key]=true;
    delete row.key;delete row.identity;delete row.source;result.rows.push(row);
  });
}
function assistantQuotes_(result,now) {
  const book=assistantOpenLeads_(result);if(!book)return;
  const source=assistantSource_('Preventivi',result.generatedAt,'Righe conservate nel tab Preventivi; completezza storica non certificata');
  result.sources.push(source);
  // There is no archive register asserting that missing months contain zero quotes.
  assistantIssue_(source,'Copertura storica del tab non certificata: conteggio delle righe valide presenti, non totale certo di tutti i preventivi emessi.');
  try{
    const sheet=book.getSheetByName('Preventivi');if(!sheet)throw new Error();if(sheet.getLastRow()<2)return;
    const rows=sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues(),seen={};
    rows.forEach(function(row,index){
      if(!row.some(function(v){return v!==''&&v!==null;}))return;
      const arrival=assistantArrival_(row[0]);if(!arrival){assistantIssue_(source,'Data preventivo esclusa: riga '+(index+2));return;}
      if(arrival.day<result.query.from||arrival.day>result.query.to||arrival.day>assistantDay_(now))return;
      const key=JSON.stringify(row);if(seen[key]){assistantIssue_(source,'Preventivo duplicato esatto escluso: riga '+(index+2));return;}seen[key]=true;
      result.rows.push({date:arrival.day,category:'Preventivi registrati',metric:'quote',seller:normalizeHistorySeller_(row[3]),channel:String(row[7]||'').trim()||'Non indicata',value:1,evidence:assistantRef_(book,sheet,index+2,row)});
    });
  }catch(_){source.status='unavailable';source.issues.push('Fonte preventivi non accessibile');result.rows=result.rows.filter(function(r){return r.metric!=='quote';});}
}
function assistantAppointments_(result) {
  const q=result.query,start=Utilities.parseDate(q.from+' 00:00','Europe/Rome','yyyy-MM-dd HH:mm');
  const next=new Date(Date.parse(q.to+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const end=Utilities.parseDate(next+' 00:00','Europe/Rome','yyyy-MM-dd HH:mm'),seen={};
  CRM_REPORT_CALENDAR_IDS.forEach(function(id){
    const source=assistantSource_('Calendario '+id,result.generatedAt,q.from+' / '+q.to);result.sources.push(source);
    try{
      const calendar=CalendarApp.getCalendarById(id);if(!calendar)throw new Error();
      const rows=[];
      calendar.getEvents(start,end).forEach(function(event){
        if(!/\bAPP\b/i.test(event.getTitle()))return;
        const date=event.getStartTime(),day=assistantDay_(date);if(day<q.from||day>q.to)return;
        const key=event.getId()+'|'+date.toISOString();if(seen[key])return;seen[key]=true;
        const eid=Utilities.base64EncodeWebSafe(event.getId().replace(/@google.com$/,'')+' '+id).replace(/=+$/,'');
        rows.push({date:day,category:'Appuntamenti',metric:'appointment',seller:sellerFromText_(event.getTitle()),status:appointmentStatus_(event.getTitle()),value:1,evidence:{locatorId:key,source:source.name,url:'https://calendar.google.com/calendar/u/0/r/eventedit/'+eid}});
      });
      result.rows=result.rows.concat(rows);
    }catch(_){source.status='unavailable';source.issues.push('Calendario non accessibile');}
  });
}
function assistantManagement_(result,now) {
  const books={},seen={};
  LEAD_MANAGEMENT_SOURCES.forEach(function(spec){
    const source=assistantSource_('Gestione '+spec.seller,result.generatedAt,'Stato feedback attuale per data di ingresso nei fogli venditori');result.sources.push(source);
    try{
      const book=books[spec.id]||(books[spec.id]=SpreadsheetApp.openById(spec.id)),sheet=book.getSheetByName(spec.sheet);if(!sheet)throw new Error();
      if(sheet.getLastRow()<2)return;
      const rows=sheet.getDataRange().getValues(),headers=rows[0].map(function(v){return String(v).trim().toLowerCase();});
      const dateIndex=headerIndex_(headers,['data']),feedbackIndex=headerIndex_(headers,['feedback']);if(dateIndex<0||feedbackIndex<0)throw new Error();
      const idIndex=headerIndex_(headers,['lead id','lead_id']);
      const items=[];
      rows.slice(1).forEach(function(row,index){
        if(!row.some(function(v){return v!==''&&v!==null;}))return;
        const arrival=assistantArrival_(row[dateIndex]);if(!arrival){assistantIssue_(source,'Data esclusa: riga '+(index+2));return;}
        if(arrival.day<result.query.from||arrival.day>result.query.to||arrival.day>assistantDay_(now))return;
        const id=idIndex>=0?String(row[idIndex]||'').trim():'';
        // Unique assignment records, not a company count of distinct people.
        const key=spec.seller+'|'+(id||JSON.stringify(row));
        if(seen[key]){assistantIssue_(source,'Assegnazione duplicata esclusa: riga '+(index+2));return;}seen[key]=true;
        items.push({date:arrival.day,category:'Assegnazioni lead',metric:'management',seller:spec.seller,feedback:String(row[feedbackIndex]==null?'':row[feedbackIndex]).trim()!=='',value:1,evidence:assistantRef_(book,sheet,index+2,row)});
      });
      result.rows=result.rows.concat(items);
    }catch(_){source.status='unavailable';source.issues.push('Foglio venditore non accessibile o schema non valido');}
  });
}

function assistantInvoiceAmount_(value){
  if(typeof value==='number')return isFinite(value)&&value>0&&value<=10000000?value:null;
  const text=String(value==null?'':value).trim().replace(/^€\s*|\s*€$/g,'').trim();
  let amount;
  if(/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(text))amount=Number(text.replace(/\./g,'').replace(',','.'));
  else if(/^\d+\.\d{1,2}$/.test(text))amount=Number(text);
  else return null;
  return isFinite(amount)&&amount>0&&amount<=10000000?amount:null;
}
