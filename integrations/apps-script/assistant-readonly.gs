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
  if (['contracts','lead-contracts','agenda-quotes','lead-quality'].indexOf(q.kind) < 0 || assistantDay_(q.from) !== q.from || assistantDay_(q.to) !== q.to || q.from > q.to) throw new Error('Parametri assistente non validi');
  if ((Date.parse(q.to) - Date.parse(q.from)) / 86400000 > 366 || (q.kind === 'agenda-quotes' && q.from !== q.to)) throw new Error('Periodo assistente non valido');
  const now = new Date(), readAt = now.toISOString();
  const result = {schemaVersion:'assistant-v1',query:q,generatedAt:readAt,sources:[],rows:[],truncated:false};
  if (q.kind === 'contracts' || q.kind === 'lead-contracts') assistantContracts_(result,now);
  if (q.kind === 'agenda-quotes') assistantAgendaQuotes_(result,now);
  if (q.kind === 'lead-quality') assistantLeadQuality_(result);
  if (result.rows.length > 10000) { result.truncated = true; result.rows = []; }
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
        const key=saleKey_(new Date(day+'T12:00:00Z'),row[1],row[2],seller,company);
        candidates.push({key:key,source:source,date:day,category:(spec.projection?'Registrazioni provvisorie · ':'Contratti registrati · ')+company,seller:seller,value:1,origin:origin,evidence:ref});
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
