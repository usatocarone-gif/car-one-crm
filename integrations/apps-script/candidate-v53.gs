const LEADS_ID = '1VJwN567x7cqzZROQCLk6773YRguj3ThBBALL4vunod4';
const SALES_ID = '1FOHWsp19vGMRbFJqZUAdMKWEI6aI1RnBjOaJq9TBtno';
const CALENDAR_NAME = 'Car One Usato';
const CRM_REPORT_CALENDAR_IDS = ['usato.carone@gmail.com', '6d7427bff6d000ddecc4c6abc55025dd211ee63315525dc00d41bac546fabed6@group.calendar.google.com'];
const SELLERS = ['CAIRONI', 'GRANDOLINI', 'LIGUORI', 'MONACELLI', 'BORDINI', 'PAGLIARA'];
// Fonti lead operative. Entrambe contribuiscono ai KPI e allo storico.
const CURRENT_LEAD_SHEETS = ['Foglio1', 'giuseppe lead'];
// Fogli operativi assegnati ai venditori. Una riga con feedback valorizzato
// è considerata gestita; una riga con feedback vuoto resta da lavorare.
const LEAD_MANAGEMENT_SOURCES = [
  { id: '1lX4TLzofx9vlFrZJKdAKewlXmyK793wXxtrJqG5HZmo', sheet: 'Liguori', seller: 'LIGUORI' },
  { id: '1lX4TLzofx9vlFrZJKdAKewlXmyK793wXxtrJqG5HZmo', sheet: 'Bordini', seller: 'BORDINI' },
  { id: '1lX4TLzofx9vlFrZJKdAKewlXmyK793wXxtrJqG5HZmo', sheet: 'Grandolini', seller: 'GRANDOLINI' },
  { id: '1pwrE4v5Oe7Phn6N-Byz0v8shBk109WGbjcpgKt5ypac', sheet: 'Monacelli', seller: 'MONACELLI' },
  { id: '17K_WxvmzItjPRPkw1Dr3qK6Reeab3i-0QRWu3H5GOsw', sheet: 'caironi', seller: 'CAIRONI' },
  { id: LEADS_ID, sheet: 'giuseppe lead', seller: 'PAGLIARA' }
];
// Mesi chiusi: Foglio1 non va inserito qui, perché contiene sempre il mese corrente.
const LEAD_HISTORY_SHEETS = [
  { name: 'Giugno', year: 2025, month: 6 },
  { name: 'Luglio', year: 2025, month: 7 },
  { name: 'Agosto', year: 2025, month: 8 },
  { name: 'SETTEMBRE', year: 2025, month: 9 },
  { name: 'ottobre', year: 2025, month: 10 },
  { name: 'Novembre', year: 2025, month: 11 },
  { name: 'Dicembre 25', year: 2025, month: 12 },
  { name: 'gen26', year: 2026, month: 1 },
  { name: 'feb 26', year: 2026, month: 2 },
  { name: 'mar 26', year: 2026, month: 3 },
  { name: 'apr 26', year: 2026, month: 4 },
  { name: 'maggio 26', year: 2026, month: 5 },
  { name: 'Giugno 26', year: 2026, month: 6 },
  { name: 'Luglio 2026', year: 2026, month: 7 }
];

function doGet(e) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  const received = e && e.parameter ? e.parameter.token : '';
  if (!expected || received !== expected) return json_({ error: 'Non autorizzato' });
  try {
    if (e.parameter.action === 'assistant') return json_(assistantRead_(e.parameter));
    return json_(buildDashboard_());
  } catch (error) {
    return json_({ error: String(error && error.message ? error.message : error) });
  }
}

function buildDashboard_() {
  const now = new Date();
  const todayStart = startOfDay_(now);
  const tomorrow = addDays_(todayStart, 1);
  const weekStart = startOfWeek_(now);
  const weekEnd = addDays_(weekStart, 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const weeklyHistoryStart = addDays_(weekStart, -77);
  const upcomingEnd = addDays_(todayStart, 8);
  const calendarStart = new Date(2025, 5, 1);
  const calendarEnd = upcomingEnd > monthEnd ? upcomingEnd : monthEnd;

  const leadRows = readLeads_();
  const leadHistory = mergeCurrentLeadHistory_(readLeadHistory_(now), leadRows, now);
  const leadManagement = readLeadManagement_();
  let operationalQuotesResult, operationalQuotesError;
  try { operationalQuotesResult = readOperationalQuotes_(); }
  catch (error) { operationalQuotesError = 'Schede preventivi non disponibili: verificare accesso e configurazione.'; }
  let leadDailyQuality, leadDailyQualityError;
  try { leadDailyQuality = readLeadDailyQuality_(); }
  catch (error) { leadDailyQualityError = 'Storico del primo giorno non disponibile: verificare accesso al database commerciale.'; }
  const leadAppointments = readLeadAppointments_();
  const quotes = readQuotes_();
  const officialSales = readOfficialSales_();
  const projectionSales = readProjectionSales_(now);
  const actualProjectionSales = projectionSales.filter(function (sale) {
    return sale.date <= now;
  });
  const sales = officialSales.filter(function (sale) {
    return !inRange_(sale.date, monthStart, monthEnd);
  }).concat(actualProjectionSales.filter(function (sale) {
    return inRange_(sale.date, monthStart, monthEnd);
  }));
  const appointments = readAppointments_(calendarStart, calendarEnd);
  linkCalendarAppointmentsToLeadManagement_(leadManagement, appointments);
  const channelData = buildChannelAnalysis_(leadHistory, leadAppointments, quotes, sales, appointments);
  const channelAnalysis = channelData.analysis;
  const socialAppointments = channelData.socialAppointments;

  const today = buildPeriod_(leadRows, sales, appointments, quotes, todayStart, tomorrow, null, now);
  const week = buildPeriod_(leadRows, sales, appointments, quotes, weekStart, weekEnd, 12, now);
  const month = buildPeriod_(leadRows, sales, appointments, quotes, monthStart, monthEnd, 50, now);
  today.label = 'Oggi';
  today.subtitle = 'Giornata commerciale in corso';
  week.label = 'Settimana';
  week.subtitle = 'Settimana commerciale corrente';
  month.label = 'Mese & forecast';
  month.subtitle = 'Dati mensili aggiornati';

  const monthLeads = leadRows.filter(function (row) { return inRange_(row.date, monthStart, monthEnd); });
  const groupedSources = {};
  monthLeads.forEach(function (row) {
    const key = normalizeSource_(row.source);
    groupedSources[key] = (groupedSources[key] || 0) + 1;
  });
  const leadSources = Object.keys(groupedSources).map(function (name) {
    return { name: name, leads: groupedSources[name], appointments: null, contracts: null };
  }).sort(function (a, b) { return b.leads - a.leads; });

  const monthSales = sales.filter(function (sale) { return inRange_(sale.date, monthStart, monthEnd); });
  const sellerConversions = SELLERS.map(function (seller) {
    const sellerApps = appointments.filter(function (item) {
      return item.seller === seller && inRange_(item.start, monthStart, monthEnd);
    });
    return {
      name: titleCase_(seller),
      appointments: sellerApps.length,
      presented: sellerApps.filter(function (item) { return item.status === 'presented'; }).length,
      noShows: sellerApps.filter(function (item) { return item.status === 'no-show'; }).length,
      pending: sellerApps.filter(function (item) { return item.status === 'pending'; }).length,
      contracts: monthSales.filter(function (sale) { return sale.seller === seller; }).length
    };
  });

  const reportDailyHistory = buildDailyHistory_(leadHistory, appointments, quotes, sales);
  let monthlyMeetingReport;
  try {
    const meetingCoverage = meetingSourceCoverage_(now);
    const lastSaturday = addDays_(startOfWeek_(now), -2);
    const deliveries = readMonthlyPlannedDeliveries_(lastSaturday);
    monthlyMeetingReport = buildCrmMonthlyMeetingReport_(leadHistory, appointments, quotes, sales, now, meetingCoverage, deliveries);
    monthlyMeetingReport.history = [];
    // Original historical slide values through September 2026 remain in the template adapter.
    // Subsequent closed months use complete month totals from the same CRM source.
    for (let y = 2026; y <= lastSaturday.getFullYear(); y++) {
      for (let m = (y === 2026 ? 9 : 0); m < 12; m++) {
        const last = new Date(y, m + 1, 0);
        if (last >= new Date(lastSaturday.getFullYear(), lastSaturday.getMonth(), 1)) continue;
        const history = buildCrmMonthlyMeetingReport_(leadHistory, appointments, quotes, sales, now, {issues:[]}, {items:[],issues:[]}, last);
        monthlyMeetingReport.history.push({month:history.period.month,total:history.total});
      }
    }
  } catch (error) {
    monthlyMeetingReport = {schemaVersion:'2',status:'review_required',sendAllowed:false,issues:['Report mensile o planning consegne non disponibile: '+String(error.message||error)]};
  }

  let reportingCoverage;
  try { reportingCoverage = weeklySourceCoverage_(now); }
  catch (error) { reportingCoverage = { complete: false, calendarIds: CRM_REPORT_CALENDAR_IDS.slice(), issues: ['Verifica fonti settimanali non disponibile.'] }; }

  return {
    source: 'google-live',
    apiVersion: '2026-10-21-five-slide-report-v2',
    lastUpdated: now.toISOString(),
    contractData: {
      currentPeriodSource: "PROIEZ. REDDITIVITA'",
      projectionRowsRead: projectionSales.length,
      projectionContractsThisMonth: actualProjectionSales.filter(function (sale) {
        return inRange_(sale.date, monthStart, monthEnd);
      }).length
    },
    periods: { today: today, week: week, month: month },
    todayAgenda: appointments.filter(function (item) {
      return inRange_(item.start, todayStart, tomorrow);
    }).map(agendaItem_),
    upcomingAgenda: appointments.filter(function (item) {
      return item.start > now && item.start < upcomingEnd;
    }).sort(function (a, b) { return a.start - b.start; }).map(function (item) {
      const agenda = agendaItem_(item);
      agenda.date = titleCaseWords_(Utilities.formatDate(item.start, 'Europe/Rome', 'EEE d MMM'));
      return agenda;
    }),
    quoteHistory: quotes.map(function (quote) {
      return {
        date: quote.date.toISOString(),
        year: quote.date.getFullYear(),
        month: quote.date.getMonth() + 1,
        client: quote.client,
        seller: titleCaseWords_(quote.seller),
        vehicle: quote.vehicle,
        feedback: quote.feedback,
        outcome: quote.outcome,
        source: normalizeDirectSource_(quote.source)
      };
    }),
    weeklyHistory: buildWeeklyHistory_(appointments, quotes, sales, weeklyHistoryStart, 12),
    dailyHistory: reportDailyHistory,
    reportingCoverage: reportingCoverage,
    monthlyMeetingReport: monthlyMeetingReport,
    weeklyReport: buildCrmWeeklyReport_(reportDailyHistory, now, reportingCoverage),
    socialAppointmentHistory: socialAppointments.map(function (item) {
      return {
        id: item.id,
        date: Utilities.formatDate(item.start, 'Europe/Rome', 'yyyy-MM-dd'),
        year: item.start.getFullYear(),
        month: item.start.getMonth() + 1,
        week: weekOfMonth_(item.start),
        seller: titleCaseWords_(item.seller),
        channel: item.channel,
        status: item.status
      };
    }),
    leadSources: leadSources,
    leadHistory: aggregateLeadHistory_(leadHistory),
    leadManagement: aggregateLeadManagement_(leadManagement),
    operationalQuotes: operationalQuotesResult ? operationalQuotesResult.items : undefined,
    operationalQuotesUpdatedAt: operationalQuotesResult ? operationalQuotesResult.updatedAt : undefined,
    operationalQuotesError: operationalQuotesError || (operationalQuotesResult && operationalQuotesResult.warning) || undefined,
    quoteCalendar: operationalQuotesResult ? operationalQuotesResult.calendar : undefined,
    leadDailyQuality: leadDailyQuality,
    leadDailyQualityError: leadDailyQualityError,
    leadItems: serializeLeadItems_(leadManagement),
    channelAnalysis: channelAnalysis,
    sellerConversions: sellerConversions,
    contractHistory: sales.filter(function (sale) {
      return sale.date >= new Date(2024, 0, 1) && sale.date <= now;
    }).map(function (sale) {
      return {
        date: Utilities.formatDate(sale.date, 'Europe/Rome', 'yyyy-MM-dd'),
        year: sale.date.getFullYear(),
        month: sale.date.getMonth() + 1,
        seller: titleCaseWords_(sale.seller),
        company: sale.company,
        origin: sale.origin,
        client: sale.client,
        revenue: sale.revenue || 0
      };
    })
  };
}

function agendaItem_(item) {
  return {
    id: item.id,
    time: Utilities.formatDate(item.start, 'Europe/Rome', 'HH:mm'),
    seller: titleCase_(item.seller),
    status: item.status
  };
}

function readLeads_() {
  const spreadsheet = SpreadsheetApp.openById(LEADS_ID);
  const seen = {};
  const result = [];
  CURRENT_LEAD_SHEETS.forEach(function (sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
    values.forEach(function (row) {
      const date = parseDate_(row[0]);
      if (!date) return;
      const source = String(row[5] || '');
      const lead = {
        date: date,
        source: source,
        channel: normalizeSource_(source),
        city: cleanLeadCity_(row[6]),
        client: String(row[1] || '').trim(),
        email: String(row[2] || '').trim().toLowerCase(),
        phone: normalizePhone_(row[4]),
        leadId: String(row[9] || '').trim(),
        sourceSheet: sheetName
      };
      // Deduplica solo lo stesso evento/riga. Se la stessa persona invia una
      // nuova richiesta in un altro momento, il nuovo lead resta conteggiato.
      const key = leadIdentityKey_(lead);
      if (seen[key]) return;
      seen[key] = true;
      result.push(lead);
    });
  });
  return result;
}

function readLeadManagement_() {
  const spreadsheets = {};
  const result = [];
  LEAD_MANAGEMENT_SOURCES.forEach(function (source) {
    const spreadsheet = spreadsheets[source.id] || SpreadsheetApp.openById(source.id);
    spreadsheets[source.id] = spreadsheet;
    const sheet = spreadsheet.getSheetByName(source.sheet);
    if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function (value) {
      return String(value || '').trim().toLowerCase();
    });
    const dateIndex = headerIndex_(headers, ['data']);
    const clientIndex = headerIndex_(headers, ['nome', 'cliente']);
    const phoneIndex = headerIndex_(headers, ['telefono', 'cellulare', 'phone']);
    const sourceIndex = headerIndex_(headers, ['origine', 'canale']);
    const cityIndex = headerIndex_(headers, ['città-', 'città', 'citta-', 'citta', 'zona']);
    const interestIndex = headerIndex_(headers, ['auto', 'veicolo', 'interesse']);
    const leadIdIndex = headerIndex_(headers, ['lead id', 'lead_id']);
    const feedbackIndex = headerIndex_(headers, ['feedback']);
    const quoteIndex = headerIndex_(headers, ['preventivo', 'prev']);
    const contractIndex = headerIndex_(headers, ['contratto']);
    if (dateIndex < 0 || feedbackIndex < 0) return;

    const relevantIndexes = [dateIndex, clientIndex, phoneIndex, sourceIndex, cityIndex, interestIndex, leadIdIndex, feedbackIndex, quoteIndex, contractIndex].filter(function (index) { return index >= 0; });
    const width = Math.max.apply(null, relevantIndexes) + 1;
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
    rows.forEach(function (row, rowIndex) {
      const date = parseDate_(row[dateIndex]);
      if (!date) return;
      const feedback = row[feedbackIndex];
      result.push({
        id: [source.seller, leadIdIndex >= 0 && row[leadIdIndex] ? String(row[leadIdIndex]).trim() : [source.sheet, rowIndex + 2].join('-')].join('-'),
        date: date,
        seller: source.seller,
        channel: sourceIndex >= 0 ? normalizeSource_(row[sourceIndex]) : 'Non indicata',
        client: clientIndex >= 0 ? String(row[clientIndex] || '').trim() : '',
        phone: phoneIndex >= 0 ? normalizePhone_(row[phoneIndex]) : '',
        city: cityIndex >= 0 ? cleanLeadCity_(row[cityIndex]) : '',
        interest: interestIndex >= 0 ? String(row[interestIndex] || '').trim() : '',
        managed: feedback !== null && feedback !== '' && String(feedback).trim() !== '',
        quote: quoteIndex >= 0 ? sheetBoolean_(row[quoteIndex]) : false,
        contract: contractIndex >= 0 ? sheetBoolean_(row[contractIndex]) : false
      });
    });
  });
  return result;
}

function headerIndex_(headers, aliases) {
  for (let i = 0; i < aliases.length; i += 1) {
    const index = headers.indexOf(aliases[i]);
    if (index >= 0) return index;
  }
  return -1;
}

function sheetBoolean_(value) {
  if (value === true) return true;
  const normalized = String(value || '').trim().toLowerCase();
  return ['true', '1', 'si', 'sì', 'yes', 'x'].indexOf(normalized) >= 0;
}

function linkCalendarAppointmentsToLeadManagement_(leads, appointments) {
  const leadByPhone = {};
  const leadByName = {};
  leads.forEach(function (lead) {
    addContactIndex_(leadByPhone, lead.phone, lead);
    addContactIndex_(leadByName, contactNameKey_(lead.client), lead);
  });

  appointments.forEach(function (appointment) {
    const matchedLead = findContactBefore_(leadByPhone, leadByName, appointment.phone, appointment.client, appointment.start);
    if (!matchedLead) return;
    matchedLead.calendarAppointment = true;
    matchedLead.calendarAppointmentCount = (matchedLead.calendarAppointmentCount || 0) + 1;
    if (appointment.status === 'presented') matchedLead.calendarShow = true;
    if (!matchedLead.calendarAppointmentDate || appointment.start > matchedLead.calendarAppointmentDate) {
      matchedLead.calendarAppointmentDate = appointment.start;
      matchedLead.calendarAppointmentStatus = appointment.status;
    }
  });
}

function aggregateLeadManagement_(rows) {
  const grouped = {};
  rows.forEach(function (row) {
    const year = row.date.getFullYear();
    const month = row.date.getMonth() + 1;
    const week = weekOfMonth_(row.date);
    const key = [year, month, week, row.seller, row.channel].join('|');
    if (!grouped[key]) {
      grouped[key] = {
        year: year,
        month: month,
        week: week,
        seller: titleCaseWords_(row.seller),
        channel: row.channel,
        total: 0,
        managed: 0,
        unmanaged: 0
      };
    }
    grouped[key].total += 1;
    if (row.managed) grouped[key].managed += 1;
    else grouped[key].unmanaged += 1;
  });
  return Object.keys(grouped).map(function (key) { return grouped[key]; }).sort(function (a, b) {
    return a.year - b.year || a.month - b.month || a.week - b.week || a.seller.localeCompare(b.seller) || a.channel.localeCompare(b.channel);
  });
}

function serializeLeadItems_(rows) {
  return rows.map(function (row) {
    const item = {
      id: row.id,
      date: row.date.toISOString(),
      year: row.date.getFullYear(),
      month: row.date.getMonth() + 1,
      week: weekOfMonth_(row.date),
      client: row.client,
      interest: row.interest,
      city: row.city,
      province: 'Da classificare',
      region: 'Da classificare',
      channel: row.channel,
      seller: titleCaseWords_(row.seller),
      managed: row.managed,
      appointment: row.calendarAppointment === true,
      appointmentCount: row.calendarAppointmentCount || 0,
      show: row.calendarShow === true,
      quote: row.quote,
      contract: row.contract
    };
    if (row.calendarAppointmentDate) item.appointmentDate = row.calendarAppointmentDate.toISOString();
    if (row.calendarAppointmentStatus) item.appointmentStatus = row.calendarAppointmentStatus;
    return item;
  }).sort(function (a, b) {
    return b.date.localeCompare(a.date) || a.seller.localeCompare(b.seller);
  });
}

function mergeCurrentLeadHistory_(history, currentRows, referenceDate) {
  const seen = {};
  const result = [];
  history.concat(currentRows).forEach(function (row) {
    if (!row.date) return;
    const key = leadIdentityKey_(row);
    if (seen[key]) return;
    seen[key] = true;
    result.push({
      date: row.date,
      channel: row.channel,
      city: row.city,
      client: row.client,
      email: String(row.email || '').trim().toLowerCase(),
      phone: row.phone
    });
  });
  return result;
}

function leadIdentityKey_(row) {
  return [
    Utilities.formatDate(row.date, 'Europe/Rome', 'yyyy-MM-dd HH:mm:ss'),
    String(row.email || '').trim().toLowerCase(),
    String(row.phone || '').replace(/\D/g, ''),
    contactNameKey_(row.client || '')
  ].join('|');
}

function readQuotes_() {
  const sheet = SpreadsheetApp.openById(LEADS_ID).getSheetByName('Preventivi');
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues().map(function (row) {
    return {
      date: parseDate_(row[0]),
      client: String(row[1] || '').trim(),
      phone: normalizePhone_(row[2]),
      seller: normalizeHistorySeller_(row[3]),
      vehicle: String(row[4] || '').trim(),
      feedback: String(row[5] || '').trim(),
      outcome: String(row[6] || '').trim(),
      source: String(row[7] || '').trim() || 'Walk-in'
    };
  }).filter(function (quote) { return quote.date !== null; });
}

function readLeadHistory_(referenceDate) {
  const spreadsheet = SpreadsheetApp.openById(LEADS_ID);
  const seen = {};
  const result = [];
  const currentDate = referenceDate || new Date();
  const sources = leadHistorySources_(spreadsheet, currentDate);
  sources.forEach(function (source) {
    const sheet = spreadsheet.getSheetByName(source.name);
    if (!sheet || sheet.getLastRow() < 1) return;
    const rows = sheet.getRange(1, 1, sheet.getLastRow(), 7).getValues();
    rows.forEach(function (row) {
      const date = parseLeadDate_(row[0], source.year);
      if (!date || date.getFullYear() !== source.year || date.getMonth() + 1 !== source.month) return;
      const channel = normalizeSource_(row[5]);
      const city = cleanLeadCity_(row[6]);
      const client = String(row[1] || '').trim();
      const email = String(row[2] || '').trim().toLowerCase();
      const phone = normalizePhone_(row[4]);
      const key = [
        Utilities.formatDate(date, 'Europe/Rome', 'yyyy-MM-dd HH:mm:ss'),
        String(row[2] || '').trim().toLowerCase(),
        String(row[4] || '').replace(/\D/g, '')
      ].join('|');
      if (seen[key]) return;
      seen[key] = true;
      result.push({ date: date, channel: channel, city: city, client: client, email: email, phone: phone });
    });
  });
  return result;
}

function leadHistorySources_(spreadsheet, currentDate) {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const sources = LEAD_HISTORY_SHEETS.slice();
  const seen = {};
  sources.forEach(function (source) {
    seen[[source.name, source.year, source.month].join('|')] = true;
  });

  // Riconosce automaticamente i futuri archivi, per esempio "Agosto 2026".
  spreadsheet.getSheets().forEach(function (sheet) {
    const parsed = parseLeadArchiveName_(sheet.getName());
    if (!parsed) return;
    if (parsed.year === currentYear && parsed.month === currentMonth) return;
    const key = [sheet.getName(), parsed.year, parsed.month].join('|');
    if (seen[key]) return;
    seen[key] = true;
    sources.push({ name: sheet.getName(), year: parsed.year, month: parsed.month });
  });

  // Foglio1 viene letto separatamente come fonte diretta del mese corrente.
  return sources;
}

function parseLeadArchiveName_(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
  const match = normalized.match(/^(gen(?:naio)?|feb(?:braio)?|mar(?:zo)?|apr(?:ile)?|mag(?:gio)?|giu(?:gno)?|lug(?:lio)?|ago(?:sto)?|set(?:tembre)?|ott(?:obre)?|nov(?:embre)?|dic(?:embre)?)\s*(\d{2}|\d{4})$/);
  if (!match) return null;
  const months = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };
  const month = months[match[1].slice(0, 3)];
  const rawYear = Number(match[2]);
  return { year: rawYear < 100 ? 2000 + rawYear : rawYear, month: month };
}

function readLeadAppointments_() {
  const sheet = SpreadsheetApp.openById(LEADS_ID).getSheetByName('Appuntamenti');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  const seen = {};
  const result = [];
  rows.forEach(function (row) {
    const date = parseDate_(row[0]);
    if (!date) return;
    const client = String(row[1] || '').trim();
    const phone = normalizePhone_(row[4]);
    const channel = normalizeSource_(row[5]);
    const leadId = String(row[9] || '').trim();
    const key = leadId || [
      Utilities.formatDate(date, 'Europe/Rome', 'yyyy-MM-dd HH:mm:ss'),
      contactNameKey_(client),
      phone
    ].join('|');
    if (seen[key]) return;
    seen[key] = true;
    result.push({ date: date, channel: channel, client: client, phone: phone });
  });
  return result;
}

function aggregateLeadHistory_(rows) {
  const grouped = {};
  rows.forEach(function (row) {
    const year = row.date.getFullYear();
    const month = row.date.getMonth() + 1;
    const key = [year, month, row.channel, row.city].join('|');
    if (!grouped[key]) {
      grouped[key] = {
        year: year,
        month: month,
        channel: row.channel,
        city: row.city,
        province: 'Da classificare',
        region: 'Da classificare',
        leads: 0
      };
    }
    grouped[key].leads += 1;
  });
  return Object.keys(grouped).map(function (key) { return grouped[key]; });
}

function buildChannelAnalysis_(leadHistory, leadAppointments, quotes, sales, calendarAppointments) {
  const leadBuckets = {};
  const directBuckets = {};
  const leadByPhone = {};
  const leadByName = {};
  const appointmentByPhone = {};
  const appointmentByName = {};
  const quoteByName = {};
  let unattributedQuotes = 0;
  let unattributedContracts = 0;

  leadHistory.forEach(function (lead) {
    addToChannelBucket_(leadBuckets, lead.date, lead.channel, 'entries', 1);
    addContactIndex_(leadByPhone, lead.phone, lead);
    addContactIndex_(leadByName, contactNameKey_(lead.client), lead);
  });

  leadAppointments.forEach(function (item) {
    addContactIndex_(appointmentByPhone, item.phone, item);
    addContactIndex_(appointmentByName, contactNameKey_(item.client), item);
  });

  const socialAppointments = [];
  calendarAppointments.forEach(function (appointment) {
    const matchedAppointment = findClosestContact_(appointmentByPhone, appointmentByName, appointment.phone, appointment.client, appointment.start, 45);
    const matchedLead = findContactBefore_(leadByPhone, leadByName, appointment.phone, appointment.client, appointment.start);
    const explicitChannel = normalizeSocialSource_(appointment.source);
    const cohort = matchedLead || matchedAppointment;
    if (!cohort && !explicitChannel) return;
    appointment.channel = cohort ? cohort.channel : explicitChannel;
    appointment.cohortDate = matchedLead ? matchedLead.date : (matchedAppointment ? matchedAppointment.date : appointment.start);
    socialAppointments.push(appointment);
    addToChannelBucket_(leadBuckets, appointment.start, appointment.channel, 'appointments', 1, appointment.seller);
  });

  quotes.forEach(function (quote) {
    const matchedLead = findContactBefore_(leadByPhone, leadByName, quote.phone, quote.client, quote.date);
    if (matchedLead) {
      quote.channelAssignment = { kind: 'lead', date: quote.date, channel: matchedLead.channel };
      addToChannelBucket_(leadBuckets, quote.date, matchedLead.channel, 'quotes', 1, quote.seller);
    } else {
      const directSource = normalizeDirectSource_(quote.source);
      quote.channelAssignment = { kind: 'direct', date: quote.date, channel: directSource };
      addToChannelBucket_(directBuckets, quote.date, directSource, 'entries', 1, quote.seller);
      addToChannelBucket_(directBuckets, quote.date, directSource, 'quotes', 1, quote.seller);
      if (directSource === 'Non attribuiti') unattributedQuotes += 1;
    }
    addContactIndex_(quoteByName, contactNameKey_(quote.client), quote);
  });

  sales.forEach(function (sale) {
    const matchingQuote = findLatestBefore_(quoteByName[contactNameKey_(sale.client)] || [], sale.date);
    const saleIsLead = isLeadOrigin_(sale.origin);
    if (matchingQuote && matchingQuote.channelAssignment) {
      const assignment = matchingQuote.channelAssignment;
      const target = assignment.kind === 'lead' ? leadBuckets : directBuckets;
      addToChannelBucket_(target, sale.date, assignment.channel, 'contracts', 1, sale.seller);
      return;
    }
    const matchedLead = findContactBefore_({}, leadByName, '', sale.client, sale.date);
    if (matchedLead || saleIsLead) {
      const cohortChannel = matchedLead ? matchedLead.channel : normalizeSocialSource_(sale.origin) || 'Facebook';
      addToChannelBucket_(leadBuckets, sale.date, cohortChannel, 'reconstructedQuotes', 1);
      addToChannelBucket_(leadBuckets, sale.date, cohortChannel, 'contracts', 1, sale.seller);
      return;
    }
    const directSource = normalizeDirectSource_(sale.origin);
    addToChannelBucket_(directBuckets, sale.date, directSource, 'entries', 1, sale.seller);
    addToChannelBucket_(directBuckets, sale.date, directSource, 'reconstructedQuotes', 1);
    addToChannelBucket_(directBuckets, sale.date, directSource, 'contracts', 1, sale.seller);
    if (!sale.origin) unattributedContracts += 1;
  });

  return {
    socialAppointments: socialAppointments,
    analysis: {
      leadCohorts: channelBucketsToArray_(leadBuckets),
      directCohorts: channelBucketsToArray_(directBuckets),
      showRateHistory: buildShowRateHistory_(socialAppointments),
      unattributedQuotes: unattributedQuotes,
      unattributedContracts: unattributedContracts
    }
  };
}

function addToChannelBucket_(buckets, date, channel, field, amount, seller) {
  if (!date) return;
  const normalizedChannel = channel || 'Non attribuiti';
  const week = weekOfMonth_(date);
  const key = [date.getFullYear(), date.getMonth() + 1, week, normalizedChannel].join('|');
  if (!buckets[key]) {
    buckets[key] = { year: date.getFullYear(), month: date.getMonth() + 1, week: week, channel: normalizedChannel, entries: 0, appointments: 0, quotes: 0, reconstructedQuotes: 0, contracts: 0, sellers: [] };
  }
  buckets[key][field] += amount;
  if (seller && seller !== 'NON ASSEGNATO') {
    let sellerRow = buckets[key].sellers.filter(function (item) { return item.name === titleCaseWords_(seller); })[0];
    if (!sellerRow) {
      sellerRow = { name: titleCaseWords_(seller), entries: 0, appointments: 0, quotes: 0, contracts: 0 };
      buckets[key].sellers.push(sellerRow);
    }
    sellerRow[field] += amount;
  }
}

function channelBucketsToArray_(buckets) {
  return Object.keys(buckets).map(function (key) { return buckets[key]; }).sort(function (a, b) {
    return a.year - b.year || a.month - b.month || a.channel.localeCompare(b.channel);
  });
}

function buildShowRateHistory_(appointments) {
  const grouped = {};
  appointments.forEach(function (item) {
    const week = weekOfMonth_(item.start);
    const key = [item.start.getFullYear(), item.start.getMonth() + 1, week].join('|');
    if (!grouped[key]) grouped[key] = { year: item.start.getFullYear(), month: item.start.getMonth() + 1, week: week, appointments: 0, presented: 0, noShows: 0, pending: 0, sellers: [] };
    grouped[key].appointments += 1;
    if (item.status === 'presented') grouped[key].presented += 1;
    else if (item.status === 'no-show') grouped[key].noShows += 1;
    else grouped[key].pending += 1;
    if (item.seller !== 'NON ASSEGNATO') {
      let seller = grouped[key].sellers.filter(function (row) { return row.name === titleCaseWords_(item.seller); })[0];
      if (!seller) {
        seller = { name: titleCaseWords_(item.seller), appointments: 0, presented: 0, noShows: 0, pending: 0, leadAppointments: 0, leadPresented: 0, leadNoShows: 0, leadPending: 0 };
        grouped[key].sellers.push(seller);
      }
      seller.appointments += 1;
      seller.leadAppointments += 1;
      if (item.status === 'presented') { seller.presented += 1; seller.leadPresented += 1; }
      else if (item.status === 'no-show') { seller.noShows += 1; seller.leadNoShows += 1; }
      else { seller.pending += 1; seller.leadPending += 1; }
    }
  });
  return Object.keys(grouped).map(function (key) { return grouped[key]; }).sort(function (a, b) {
    return a.year - b.year || a.month - b.month || a.week - b.week;
  });
}

function addContactIndex_(index, key, item) {
  if (!key) return;
  if (!index[key]) index[key] = [];
  index[key].push(item);
}

function findContactBefore_(phoneIndex, nameIndex, phone, client, date) {
  const normalizedPhone = normalizePhone_(phone);
  const byPhone = normalizedPhone ? (phoneIndex[normalizedPhone] || []) : [];
  const phoneMatch = findLatestBefore_(byPhone, date);
  if (phoneMatch) return phoneMatch;
  return findLatestBefore_(nameIndex[contactNameKey_(client)] || [], date);
}

function findLatestBefore_(items, date) {
  let match = null;
  items.forEach(function (item) {
    if (item.date <= date && (!match || item.date > match.date)) match = item;
  });
  return match;
}

function findClosestContact_(phoneIndex, nameIndex, phone, client, date, maxDays) {
  const normalizedPhone = normalizePhone_(phone);
  const candidates = normalizedPhone && phoneIndex[normalizedPhone] ? phoneIndex[normalizedPhone] : (nameIndex[contactNameKey_(client)] || []);
  let match = null;
  let distance = Infinity;
  candidates.forEach(function (item) {
    const currentDistance = Math.abs(item.date.getTime() - date.getTime()) / 86400000;
    if (currentDistance <= maxDays && currentDistance < distance) {
      distance = currentDistance;
      match = item;
    }
  });
  return match;
}

function normalizePhone_(value) {
  const text = String(value || '');
  const candidates = text.match(/\+?\d(?:[\s().-]*\d){6,14}/g) || [];
  const selected = candidates.length ? candidates.sort(function (a, b) {
    return b.replace(/\D/g, '').length - a.replace(/\D/g, '').length;
  })[0] : text;
  const digits = selected.replace(/\D/g, '');
  if (digits.length < 7) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function contactNameKey_(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\([^)]*\)/g, ' ').replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(function (token) {
    return token.length > 1 && ['SIG', 'SIGRA', 'SIGNORE', 'SIGNORA'].indexOf(token) < 0;
  }).sort().join(' ');
}

function normalizeDirectSource_(value) {
  const source = String(value || '').trim().toLowerCase().replace(/[-_]+/g, ' ');
  if (!source) return 'Walk-in';
  if (source.indexOf('walk') >= 0 && source.indexOf('social') >= 0) return 'Walk-in social';
  if (source.indexOf('walk') >= 0 || source === 'wi') return 'Walk-in';
  if (source.indexOf('loyal') >= 0 || source.indexOf('gia cliente') >= 0) return 'Loyalty';
  if (source.indexOf('conosc') >= 0 || source.indexOf('passaparola') >= 0) return 'Conoscenza';
  return normalizeSource_(value);
}

function normalizeSocialSource_(value) {
  const source = normalizeSource_(value);
  const digital = ['Facebook', 'Instagram', 'TikTok', 'Sito', 'WhatsApp', 'Google Ads', 'AutoScout24'];
  if (String(value || '').toUpperCase().indexOf('SOCIAL') >= 0 || String(value || '').toUpperCase().indexOf('LEAD') >= 0) return 'Facebook';
  return digital.indexOf(source) >= 0 ? source : '';
}

function isLeadOrigin_(value) {
  const normalized = String(value || '').toUpperCase();
  return normalized.indexOf('LEAD') >= 0 || Boolean(normalizeSocialSource_(value));
}

function readOfficialSales_() {
  const spreadsheet = SpreadsheetApp.openById(SALES_ID);
  const sources = [
    { names: ['CAR 2024'], company: 'Car One', hasOrigin: false },
    { names: ['CAR 2025'], company: 'Car One', hasOrigin: true },
    { names: ['CAR 2026'], company: 'Car One', hasOrigin: true },
    { names: ['AD MOTOR 24/25', 'AD MOTOR'], company: 'AD Motor', hasOrigin: true },
    { names: ['AD MOTOR 2026'], company: 'AD Motor', hasOrigin: true }
  ];
  const seen = {};
  const result = [];
  sources.forEach(function (source) {
    readSalesSheet_(findSheetByNames_(spreadsheet, source.names), source.company, source.hasOrigin).forEach(function (sale) {
      if (seen[sale.key]) return;
      seen[sale.key] = true;
      result.push(sale);
    });
  });
  return result;
}

function findSheetByNames_(spreadsheet, names) {
  for (let i = 0; i < names.length; i += 1) {
    const exact = spreadsheet.getSheetByName(names[i]);
    if (exact) return exact;
  }
  const normalizedNames = names.map(function (name) {
    return String(name || '').trim().toUpperCase();
  });
  const sheets = spreadsheet.getSheets();
  for (let i = 0; i < sheets.length; i += 1) {
    const normalizedTitle = String(sheets[i].getName() || '').trim().toUpperCase();
    if (normalizedNames.indexOf(normalizedTitle) >= 0) return sheets[i];
  }
  return null;
}

function readSalesSheet_(sheet, company, hasOrigin) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 2, lastRow - 1, 13).getValues().map(function (row) {
    const date = parseDate_(row[0]);
    const seller = normalizeHistorySeller_(row[4]);
    return {
      date: date,
      client: String(row[1] || '').trim(),
      seller: seller,
      company: company,
      origin: hasOrigin ? normalizeContractOrigin_(row[5]) : 'Non disponibile',
      revenue: parseAmount_(company === 'AD Motor' ? row[12] : row[10]),
      key: saleKey_(date, row[1], row[2], seller, company)
    };
  }).filter(function (sale) { return sale.date !== null; });
}

function readProjectionSales_(referenceDate) {
  const sheet = SpreadsheetApp.openById(SALES_ID).getSheetByName("PROIEZ. REDDITIVITA'");
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 2, sheet.getLastRow() - 1, 10).getValues();
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const result = [];
  let currentBlockStarted = false;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rawSeller = String(row[4] || '').trim();
    const vehicle = String(row[2] || '').trim();
    const plate = String(row[3] || '').trim();
    const hasContractData = Boolean(rawSeller && (vehicle || plate));
    let date = parseDate_(row[0]);
    if (!date) {
      // Una data scritta male non deve troncare tutto il mese. Interrompiamo
      // soltanto quando, dopo il blocco corrente, troviamo una vera riga vuota.
      if (currentBlockStarted && !hasContractData) break;
      if (currentBlockStarted && hasContractData && row[0]) {
        date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
      } else {
        continue;
      }
    }
    if (!currentBlockStarted) {
      if (!inRange_(date, monthStart, monthEnd)) continue;
      currentBlockStarted = true;
    }
    if (!hasContractData) {
      continue;
    }
    const normalizedSeller = normalizeHistorySeller_(rawSeller);
    const seller = SELLERS.indexOf(normalizedSeller) >= 0 ? normalizedSeller : 'ALTRI';
    const effectiveDate = inRange_(date, monthStart, monthEnd)
      ? date
      : new Date(referenceDate.getFullYear(), referenceDate.getMonth(), Math.min(date.getDate(), 28));
    const property = String(row[5] || '').trim().toUpperCase();
    const company = property.indexOf('AD') >= 0 ? 'AD Motor' : 'Car One';
    result.push({
      date: effectiveDate,
      client: String(row[1] || '').trim(),
      seller: seller,
      company: company,
      origin: normalizeContractOrigin_(row[6]),
      revenue: parseAmount_(row[9]),
      key: saleKey_(effectiveDate, row[1], vehicle || plate, seller, company)
    });
  }
  return result;
}

function readAppointments_(start, end) {
  return readReportCalendars_(start, end);
}

function buildPeriod_(leads, sales, apps, quotes, start, end, target, now) {
  const periodSales = sales.filter(function (sale) { return inRange_(sale.date, start, end); });
  const periodApps = apps.filter(function (item) { return inRange_(item.start, start, end); });
  const contracts = periodSales.length;
  const totalDays = sellingDays_(start, end);
  const elapsedEnd = now < end ? addDays_(startOfDay_(now), 1) : end;
  const elapsedDays = Math.max(1, sellingDays_(start, elapsedEnd));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const counts = {};
  periodApps.forEach(function (item) { counts[item.seller] = (counts[item.seller] || 0) + 1; });

  const sellerNames = {};
  periodSales.forEach(function (sale) { if (sale.seller !== 'NON ASSEGNATO') sellerNames[sale.seller] = true; });
  const sellers = Object.keys(sellerNames).map(function (seller) {
    const sellerSales = periodSales.filter(function (sale) { return sale.seller === seller; });
    return {
      name: titleCase_(seller),
      contracts: sellerSales.length,
      carOne: sellerSales.filter(function (sale) { return sale.company === 'Car One'; }).length,
      adMotor: sellerSales.filter(function (sale) { return sale.company === 'AD Motor'; }).length,
      appointments: counts[seller] || 0
    };
  }).sort(function (a, b) { return b.contracts - a.contracts; });

  const upcomingAppointments = periodApps.filter(function (item) { return item.start > now; }).length;
  const overdueAppointments = periodApps.filter(function (item) {
    return item.start <= now && item.status === 'pending';
  }).length;

  return {
    label: '',
    subtitle: '',
    leads: leads.filter(function (row) { return inRange_(row.date, start, end); }).length,
    appointments: periodApps.length,
    presented: periodApps.filter(function (item) { return item.status === 'presented'; }).length,
    noShows: periodApps.filter(function (item) { return item.status === 'no-show'; }).length,
    pendingAppointments: periodApps.filter(function (item) { return item.status === 'pending'; }).length,
    upcomingAppointments: upcomingAppointments,
    overdueAppointments: overdueAppointments,
    quotes: quotes.filter(function (quote) { return inRange_(quote.date, start, end); }).length,
    contracts: contracts,
    revenue: periodSales.reduce(function (sum, sale) { return sum + (sale.revenue || 0); }, 0),
    carOneContracts: periodSales.filter(function (sale) { return sale.company === 'Car One'; }).length,
    adMotorContracts: periodSales.filter(function (sale) { return sale.company === 'AD Motor'; }).length,
    target: target,
    forecast: target ? Math.round((contracts / elapsedDays) * totalDays) : null,
    expectedToDate: target ? Math.round((target * elapsedDays) / totalDays) : null,
    remainingToTarget: target ? Math.max(0, target - contracts) : null,
    requiredPerDay: target && remainingDays ? Math.max(0, target - contracts) / remainingDays : null,
    sellers: sellers
  };
}

function buildDailyHistory_(leads, appointments, quotes, sales) {
  const grouped = {};
  function day_(date) {
    const key = Utilities.formatDate(date, 'Europe/Rome', 'yyyy-MM-dd');
    if (!grouped[key]) grouped[key] = { date: key, leads: 0, appointments: 0, presented: 0, noShows: 0, pending: 0, quotes: 0, contracts: 0, revenue: 0 };
    return grouped[key];
  }
  leads.forEach(function (item) { day_(item.date).leads += 1; });
  appointments.forEach(function (item) {
    const row = day_(item.start);
    row.appointments += 1;
    if (item.status === 'presented') row.presented += 1;
    else if (item.status === 'no-show') row.noShows += 1;
    else row.pending += 1;
  });
  quotes.forEach(function (item) { day_(item.date).quotes += 1; });
  sales.forEach(function (item) {
    const row = day_(item.date);
    row.contracts += 1;
    row.revenue += item.revenue || 0;
  });
  return Object.keys(grouped).sort().map(function (key) { return grouped[key]; });
}

function buildWeeklyHistory_(apps, quotes, sales, firstWeekStart, weeks) {
  const result = [];
  for (let index = 0; index < weeks; index += 1) {
    const start = addDays_(firstWeekStart, index * 7);
    const end = addDays_(start, 7);
    result.push({
      weekStart: Utilities.formatDate(start, 'Europe/Rome', 'yyyy-MM-dd'),
      label: Utilities.formatDate(start, 'Europe/Rome', 'dd/MM'),
      appointments: apps.filter(function (item) { return inRange_(item.start, start, end); }).length,
      quotes: quotes.filter(function (item) { return inRange_(item.date, start, end); }).length,
      contracts: sales.filter(function (item) { return inRange_(item.date, start, end); }).length
    });
  }
  return result;
}

function parseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (match) {
    const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0));
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  // Corregge refusi come 11/082026 (slash mancante prima dell'anno).
  const compactMatch = String(value).trim().match(/^(\d{1,2})\/(\d{2})(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (compactMatch) {
    const parsed = new Date(Number(compactMatch[3]), Number(compactMatch[2]) - 1, Number(compactMatch[1]), Number(compactMatch[4] || 0), Number(compactMatch[5] || 0));
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const iso = new Date(String(value));
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function parseLeadDate_(value, fallbackYear) {
  const parsed = parseDate_(value);
  if (parsed) return parsed;
  const parts = String(value || '').trim().split('/');
  if (parts.length === 2) {
    const date = new Date(fallbackYear, Number(parts[1]) - 1, Number(parts[0]));
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function startOfDay_(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays_(date, amount) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount); }
function startOfWeek_(date) {
  const result = startOfDay_(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}
function weekOfMonth_(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.min(5, Math.floor((date.getDate() + ((first.getDay() + 6) % 7) - 1) / 7) + 1);
}
function inRange_(date, start, end) { return date && date >= start && date < end; }
function sellingDays_(start, end) {
  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    if (cursor.getDay() !== 0) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
function sellerFromText_(text) {
  const upper = text.toUpperCase();
  for (let i = 0; i < SELLERS.length; i += 1) if (upper.indexOf(SELLERS[i]) >= 0) return SELLERS[i];
  return 'NON ASSEGNATO';
}
function appointmentStatus_(title) {
  const normalized = title.toUpperCase().replace(/\s+/g, ' ');
  if (/(^|[\s+\-])SI([\s+\-]|$)/.test(normalized)) return 'presented';
  if (/(^|[\s+\-])NO([\s+\-]|$)/.test(normalized)) return 'no-show';
  return 'pending';
}
function calendarClient_(value) {
  let text = String(value || '').split(/\r?\n/)[0].split(/[|:]/)[0].split(/\s-\s|-/)[0].toUpperCase();
  text = text.replace(/\bAPP(?:UNTAMENTO)?\b/g, ' ').replace(/\b(SI|NO)\b/g, ' ');
  SELLERS.forEach(function (seller) { text = text.replace(new RegExp('\\b' + seller + '\\b', 'g'), ' '); });
  text = text.replace(/\b(FACEBOOK|INSTAGRAM|TIKTOK|WHATSAPP|AUTOSCOUT24|AUTOSCOUT|A24|GOOGLE ADS|SITO)\b/g, ' ');
  text = text.replace(/\+?\d[\d\s().-]{6,}\d/g, ' ').replace(/[^A-ZÀ-Ù0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return text;
}
function sourceFromText_(value) {
  const upper = String(value || '').toUpperCase();
  if (upper.indexOf('FACEBOOK') >= 0 || /(^|\W)FB(\W|$)/.test(upper)) return 'Facebook';
  if (upper.indexOf('INSTAGRAM') >= 0 || /(^|\W)(IG|INST|ISTA)(\W|$)/.test(upper)) return 'Instagram';
  if (upper.indexOf('TIKTOK') >= 0 || upper.indexOf('TIK TOK') >= 0) return 'TikTok';
  if (upper.indexOf('AUTOSCOUT') >= 0 || /(^|\W)A24(\W|$)/.test(upper)) return 'AutoScout24';
  if (upper.indexOf('WHATSAPP') >= 0 || /(^|\W)WHAT(\W|$)/.test(upper)) return 'WhatsApp';
  if (upper.indexOf('GOOGLE ADS') >= 0) return 'Google Ads';
  if (upper.indexOf('SITO') >= 0) return 'Sito';
  return '';
}
function normalizeSource_(value) {
  const source = String(value || '').trim().toLowerCase().replace(/[-_]+/g, ' ');
  if (source === 'fb' || source === 'facebook') return 'Facebook';
  if (source === 'ig' || source === 'instagram') return 'Instagram';
  if (source === 'tiktok' || source === 'tik tok') return 'TikTok';
  if (source === 'a24' || source.indexOf('autoscout') >= 0) return 'AutoScout24';
  if (source.indexOf('sito') >= 0 || source.indexOf('website') >= 0) return 'Sito';
  if (source.indexOf('whatsapp') >= 0) return 'WhatsApp';
  if (source.indexOf('google') >= 0 && source.indexOf('ads') >= 0) return 'Google Ads';
  if (source.indexOf('chiamat') >= 0 || source.indexOf('telefon') >= 0) return 'Chiamata';
  return source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Non indicata';
}
function parseAmount_(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  const text = String(value || '').trim();
  if (!text) return 0;
  const normalized = text.replace(/[€\s]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const amount = Number(normalized);
  return isFinite(amount) ? amount : 0;
}
function cleanLeadCity_(value) {
  const city = String(value || '').trim().replace(/\s+/g, ' ');
  return city || 'Non indicata';
}
function titleCase_(value) {
  const text = String(value || '').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function titleCaseWords_(value) {
  return String(value || '').toLowerCase().replace(/(^|\s)\S/g, function (letter) { return letter.toUpperCase(); });
}
function normalizeHistorySeller_(value) {
  const seller = String(value || '').trim().toUpperCase();
  if (!seller) return 'NON ASSEGNATO';
  for (let i = 0; i < SELLERS.length; i += 1) {
    if (seller.indexOf(SELLERS[i]) >= 0) return SELLERS[i];
  }
  return seller;
}
function normalizeContractOrigin_(value) {
  const origin = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!origin) return 'Non indicata';
  if (origin.indexOf('LEAD') >= 0) return 'Lead';
  if (origin.indexOf('WALK') >= 0) return 'Walk-in';
  if (origin.indexOf('LOYAL') >= 0 || origin.indexOf("GIA' CLIENTE") >= 0) return 'Loyalty';
  if (origin.indexOf('AMIC') >= 0 || origin.indexOf('CONOSC') >= 0) return 'Passaparola';
  if (origin.indexOf('AUTOSCOUT') >= 0) return 'AutoScout';
  if (origin.indexOf('SITO') >= 0) return 'Sito web';
  if (origin.indexOf('FACEBOOK') >= 0 || origin.indexOf('SOCIAL') >= 0) return 'Social';
  return origin.charAt(0) + origin.slice(1).toLowerCase();
}
function saleKey_(date, client, model, seller, company) {
  if (!date) return '';
  return [
    Utilities.formatDate(date, 'Europe/Rome', 'yyyy-MM-dd'),
    String(client || '').trim().toUpperCase(),
    String(model || '').trim().toUpperCase(),
    seller,
    company
  ].join('|');
}
function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

// Aggiungere questo file al progetto Apps Script della dashboard.
// Nel risultato di buildDashboard_() aggiungere:
// leadDailyQuality: readLeadDailyQuality_(),
// Lo script legge soltanto lo storico; non modifica fogli o permessi.
function readLeadDailyQuality_() {
  const id = '19XAvwQY9gg1yCC-FSkfCwiqaS9bmNiHQhuhuaoB6rHA';
  const sheet = SpreadsheetApp.openById(id).getSheetByName('STORICO_V2');
  if (!sheet) throw new Error('STORICO_V2 non disponibile');
  const values = sheet.getDataRange().getValues();
  const expected = ['Chiave giorno-venditore','Data','Venditore','Lead in scadenza','Feedback al controllo','Senza feedback al controllo','Percentuale lavorazione','Recuperati osservati','Arretrati aperti','Controllo UTC','Qualità misurazione','Settimana','Mese'];
  if (values[0].join('|') !== expected.join('|')) throw new Error('Schema STORICO_V2 non valido');
  const names = {CAIRONI:'Francesco Caironi',MONACELLI:'Marcello Monacelli',LIGUORI:'Giuseppe Liguori',BORDINI:'Cristiano Bordini',GRANDOLINI:'Paolo Grandolini',PAGLIARA:'Giuseppe Pagliara'};
  const seen = {};
  const today = Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd');
  return values.slice(1).filter(function(r){return String(r[0]).trim();}).map(function(r){
    const day = r[1] instanceof Date ? Utilities.formatDate(r[1],'Europe/Rome','yyyy-MM-dd') : String(r[1]);
    const seller = String(r[2]).trim().toUpperCase();
    const key = day+'|'+seller;
    if (seen[key]) throw new Error('Duplicato storico: '+key);
    seen[key] = true;
    const due = Number(r[3]), managed = Number(r[4]), missing = Number(r[5]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !names[seller] || ![due,managed,missing].every(function(n){return Number.isInteger(n)&&n>=0;}) || managed+missing!==due) throw new Error('Consuntivo non valido: '+key);
    const note = String(r[10]||'');
    const reconstructed = /ricostru/i.test(note);
    const observed = r[9] instanceof Date ? r[9] : new Date(r[9]);
    if (!reconstructed && (!r[9] || !Number.isFinite(observed.getTime()) || Utilities.formatDate(observed,'Europe/Rome','yyyy-MM-dd')!==day || Utilities.formatDate(observed,'Europe/Rome','HH:mm')<'19:05')) throw new Error('Controllo serale non valido: '+key);
    return {date:day,seller:seller,name:names[seller],due:due,managedWithinDay:managed,missingAtDeadline:missing,rate:due?managed/due*100:null,recovered:Number(r[7]||0),backlog:Number(r[8]||0),measurement:reconstructed?'reconstructed':'evening-observation',note:note};
  }).filter(function(r){return r.date<=today;}).sort(function(a,b){return a.date.localeCompare(b.date)||a.seller.localeCompare(b.seller);});
}

// Per la vista giornaliera o per un periodo (date ISO incluse).
// Le ricostruzioni sono separate: non entrano nel KPI osservato.
function summarizeLeadDailyQuality_(rows, from, to) {
  const grouped = {};
  rows.filter(function(r){return (!from||r.date>=from)&&(!to||r.date<=to);}).forEach(function(r){
    const bucket = r.seller+'|'+r.measurement;
    if (!grouped[bucket]) grouped[bucket] = {seller:r.seller,name:r.name,measurement:r.measurement,days:0,due:0,managedWithinDay:0,missingAtDeadline:0};
    const g=grouped[bucket];g.days++;g.due+=r.due;g.managedWithinDay+=r.managedWithinDay;g.missingAtDeadline+=r.missingAtDeadline;
  });
  return Object.keys(grouped).map(function(key){const g=grouped[key];g.rate=g.due?g.managedWithinDay/g.due*100:null;return g;}).sort(function(a,b){return (a.rate===null?Infinity:a.rate)-(b.rate===null?Infinity:b.rate);});
}

function verificaGestionePrimoGiorno() {
 const rows=readLeadDailyQuality_();
 const days={};
 rows.filter(function(r){return r.measurement==='evening-observation';}).forEach(function(r){if(!days[r.date])days[r.date]={venditori:0,inScadenza:0,gestiti:0};days[r.date].venditori++;days[r.date].inScadenza+=r.due;days[r.date].gestiti+=r.managedWithinDay;});
 console.log(JSON.stringify({righe:rows.length,giornate:days}));
}

// Sola lettura: i feedback provengono esclusivamente dalle schede personali.
function readOperationalQuotes_() {
  const book = SpreadsheetApp.openById('19XAvwQY9gg1yCC-FSkfCwiqaS9bmNiHQhuhuaoB6rHA');
  const configSheet = book.getSheetByName('CONFIGURAZIONE');
  if (!configSheet) throw new Error('Configurazione preventivi assente');
  const config = configSheet.getRange(1,1,Math.max(1,configSheet.getLastRow()),2).getDisplayValues();
  const cutoffRow = config.filter(function(r){ return r[0] === 'preventivi_da_data'; })[0];
  const cutoff = cutoffRow && cutoffRow[1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff || '')) throw new Error('Data inizio preventivi non valida');
  const calendar = {}, exceptions = book.getSheetByName('CALENDARIO_ECCEZIONI');
  if (!exceptions) throw new Error('Calendario preventivi assente');
  exceptions.getDataRange().getDisplayValues().slice(1).forEach(function(r){
    if (!r[0]) return;
    const date = operationalQuoteDate_(r[0]);
    if (!date || !/^(true|false|vero|falso|si|sì|no|1|0)$/i.test(r[1])) throw new Error('Eccezione calendario non valida');
    calendar[date] = /^(true|vero|si|sì|1)$/i.test(r[1]);
  });
  const tabs = [['Caironi','PREV_Caironi'],['Monacelli','PREV_Monacelli'],['Liguori','PREV_Liguori'],['Bordini','PREV_Bordini'],['Grandolini','PREV_Grandolini'],['Pagliara','PREV_Rossi']];
  const items = [], ids = {}, warnings = [];
  tabs.forEach(function(pair){
    const sheet = book.getSheetByName(pair[1]);
    if (!sheet) { warnings.push(pair[0] + ': scheda non disponibile'); return; }
    const rows = sheet.getRange(1,1,Math.max(1,sheet.getLastRow()),8).getDisplayValues();
    const expected = ['ID preventivo','Data','Cliente','Veicolo','Stato','Ultimo richiamo','Prossimo richiamo','Nota'];
    if (expected.some(function(h,i){ return String(rows[0][i] || '').trim() !== h; })) { warnings.push(pair[0] + ': colonne non riconosciute'); return; }
    rows.slice(1).forEach(function(r,index){
      if (!r.some(function(v){return v !== '';})) return;
      const date = operationalQuoteDate_(r[1]), id = String(r[0] || '').trim();
      if (!date || !id) { warnings.push(pair[0] + ': record senza ID o data valida'); return; }
      if (date < cutoff) return;
      if (ids[id]) { warnings.push('ID preventivo duplicato: record escluso'); ids[id].duplicate = true; return; }
      const last = operationalQuoteDate_(r[5]), next = operationalQuoteDate_(r[6]);
      if ((r[5] && !last) || (r[6] && !next)) { warnings.push(pair[0] + ': data richiamo non valida, record escluso'); return; }
      const item = {id:id,date:date,seller:pair[0],client:r[2],vehicle:r[3],status:String(r[4] || '').trim().toUpperCase(),lastFollowup:last,nextFollowup:next,note:r[7],url:book.getUrl()+'#gid='+sheet.getSheetId()+'&range=B'+(index+2)+':H'+(index+2)};
      ids[id] = item; items.push(item);
    });
  });
  return {items:items.filter(function(item){ return !item.duplicate; }),calendar:calendar,updatedAt:new Date().toISOString(),warning:Array.from(new Set(warnings)).join('; ')};
}
function operationalQuoteDate_(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|T|$)/);
  const it = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (!iso && !it) return null;
  const y = +(iso ? iso[1] : it[3]), m = +(iso ? iso[2] : it[2]), d = +(iso ? iso[3] : it[1]);
  const date = new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d ? y+'-'+('0'+m).slice(-2)+'-'+('0'+d).slice(-2) : null;
}
function verificaPreventiviOperativi() {
  const result = readOperationalQuotes_(), sellers = {};
  result.items.forEach(function(item){ sellers[item.seller] = (sellers[item.seller] || 0) + 1; });
  console.log(JSON.stringify({total:result.items.length,sellers:sellers,warning:result.warning,updatedAt:result.updatedAt}));
}


// Additive module for the existing, token-protected Car One Apps Script web app.
// Default: disabled. No raw XML, phone, email, identity or financial data is stored.
const IW3_BOOK = '19XAvwQY9gg1yCC-FSkfCwiqaS9bmNiHQhuhuaoB6rHA';
const IW3_TEAM = {
  '36606': ['Bordini','PREV_Bordini'], '38475': ['Caironi','PREV_Caironi'],
  '29832': ['Liguori','PREV_Liguori'], '14749': ['Monacelli','PREV_Monacelli'],
  '14712': ['Grandolini','PREV_Grandolini'], '14721': ['Rossi Massimo','PREV_Rossi'],
  'Cristiano Bordini': ['Bordini','PREV_Bordini'],
  'Marcello Monacelli': ['Monacelli','PREV_Monacelli'],
  'Rossi Massimo': ['Rossi Massimo','PREV_Rossi']
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
    record.dealership=field(identity,'sede');
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
    if(record.dealership && record.dealership!=='Car One S.r.l.')state='SEDE_DA_VERIFICARE';
    else if(record.date<cutoff)state='FUORI_PERIODO';
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
  if(records.some(function(record){return record.dealership!=='Car One S.r.l.';}))throw Error('Sede non confermata');
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


// The recap consumes exactly the daily history shown by the CRM.
function buildCrmWeeklyReport_(dailyHistory, now, coverage) {
  const monday = startOfWeek_(now);
  const start = addDays_(monday, -7);
  const previous = addDays_(monday, -14);
  const day = function (value) { return Utilities.formatDate(value, 'Europe/Rome', 'yyyy-MM-dd'); };
  const period = { start: day(start), endExclusive: day(monday), previousStart: day(previous), timezone: 'Europe/Rome' };
  const keys = ['leads', 'appointments', 'presented', 'noShows', 'pending', 'quotes', 'contracts', 'revenue'];
  const issues = coverage.issues.slice();
  const rows = dailyHistory.filter(function (row) { return row.date >= period.previousStart && row.date < period.endExclusive; });
  const seen = {};
  rows.forEach(function (row) {
    if (seen[row.date] || keys.some(function (key) {
      return typeof row[key] !== 'number' || !isFinite(row[key]) ||
        (key !== 'revenue' && (row[key] < 0 || Math.floor(row[key]) !== row[key]));
    }) || row.appointments !== row.presented + row.noShows + row.pending) {
      issues.push('Storico giornaliero incoerente: ' + row.date);
    }
    seen[row.date] = true;
  });
  function sum(from, to) {
    const result = {};
    keys.forEach(function (key) { result[key] = 0; });
    rows.forEach(function (row) {
      if (row.date >= from && row.date < to) keys.forEach(function (key) { result[key] += row[key]; });
    });
    return result;
  }
  const current = sum(period.start, period.endExclusive);
  const prior = sum(period.previousStart, period.start);
  const comparison = {};
  keys.forEach(function (key) {
    comparison[key] = { change: current[key] - prior[key], percent: prior[key] === 0 ? null : (current[key] - prior[key]) / prior[key] * 100 };
  });
  const result = {
    schemaVersion: '1', status: issues.length ? 'review_required' : 'ready',
    sendAllowed: issues.length === 0, period: period, source: 'crm.dailyHistory',
    sourceUpdatedAt: now.toISOString(), generatedAt: new Date().toISOString(), issues: issues,
    definitions: {
      appointments: 'Eventi APP dei due calendari, deduplicati per ID evento e inizio.',
      pending: 'Esito non classificato: non equivale ad assenza.',
      quotes: 'Tab Preventivi di Make Leads, secondo le regole della dashboard.',
      contracts: 'Regole CRM: proiezione nel mese corrente, venduto ufficiale nei mesi chiusi.',
      revenue: 'Valore del campo revenue del CRM, non incassi bancari.'
    }
  };
  result[issues.length ? 'candidateMetrics' : 'metrics'] = { current: current, previous: prior, comparison: comparison };
  return result;
}

function weeklySourceCoverage_(now) {
  const end = startOfWeek_(now);
  const start = addDays_(end, -14);
  const issues = [];
  const leadsBook = SpreadsheetApp.openById(LEADS_ID);
  const salesBook = SpreadsheetApp.openById(SALES_ID);
  const archiveSources = leadHistorySources_(leadsBook, now);
  const currentMonth = now.getFullYear() + '-' + now.getMonth();
  const requiredMonths = {};
  for (let date = start; date < end; date = addDays_(date, 1)) {
    requiredMonths[date.getFullYear() + '-' + date.getMonth()] = { year: date.getFullYear(), month: date.getMonth() + 1 };
  }
  function requireSheet(book, name) {
    const sheet = book.getSheetByName(name);
    if (!sheet) issues.push('Fonte mancante: ' + name);
    return sheet;
  }
  CURRENT_LEAD_SHEETS.concat(['Preventivi']).forEach(function (name) {
    const sheet = requireSheet(leadsBook, name);
    if (!sheet || sheet.getLastRow() < 2) return;
    // A populated date that cannot be interpreted must not silently become zero.
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    values.forEach(function (row, index) {
      if (row[0] && row[1] && !parseDate_(row[0])) issues.push('Data non valida: ' + name + ', riga ' + (index + 2));
    });
  });
  Object.keys(requiredMonths).forEach(function (key) {
    const month = requiredMonths[key];
    if (key === currentMonth) {
      requireSheet(salesBook, "PROIEZ. REDDITIVITA'");
    } else {
      const archives = archiveSources.filter(function (source) {
        return source.year === month.year && source.month === month.month && leadsBook.getSheetByName(source.name);
      });
      if (!archives.length) issues.push('Archivio lead non disponibile per ' + month.year + '-' + month.month);
      // readOfficialSales_ currently supports these years explicitly.
      if (month.year !== 2025 && month.year !== 2026) issues.push('Anno venduto non supportato dal CRM: ' + month.year);
      requireSheet(salesBook, 'CAR ' + month.year);
      requireSheet(salesBook, month.year === 2026 ? 'AD MOTOR 2026' : 'AD MOTOR');
    }
  });
  const projection = salesBook.getSheetByName("PROIEZ. REDDITIVITA'");
  if (requiredMonths[currentMonth] && projection && projection.getLastRow() >= 2) {
    const rows = projection.getRange(2, 2, projection.getLastRow() - 1, 10).getValues();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    let started = false;
    rows.some(function (row, index) {
      const hasData = Boolean(String(row[4] || '').trim() && (row[2] || row[3]));
      const date = parseDate_(row[0]);
      if (!date) {
        if (started && !hasData) return true;
        if (started && hasData && row[0]) issues.push('Data contratto sostituita dal CRM: riga ' + (index + 2));
        return false;
      }
      if (!started) {
        if (!inRange_(date, monthStart, monthEnd)) return false;
        started = true;
      }
      if (hasData && !inRange_(date, monthStart, monthEnd)) issues.push('Data contratto spostata di mese dal CRM: riga ' + (index + 2));
      return false;
    });
  }
  return {
    start: Utilities.formatDate(start, 'Europe/Rome', 'yyyy-MM-dd'),
    endExclusive: Utilities.formatDate(end, 'Europe/Rome', 'yyyy-MM-dd'),
    complete: issues.length === 0, calendarIds: CRM_REPORT_CALENDAR_IDS.slice(), issues: issues
  };
}

function readReportCalendars_(start, end) {
  const seen = {};
  const result = [];
  CRM_REPORT_CALENDAR_IDS.forEach(function (id) {
    const calendar = CalendarApp.getCalendarById(id);
    if (!calendar) throw new Error('Calendario CRM non accessibile');
    calendar.getEvents(start, end, { search: 'APP' }).forEach(function (event) {
      const beginning = event.getStartTime();
      const key = event.getId() + '|' + beginning.toISOString();
      if (seen[key]) return;
      seen[key] = true;
      const title = event.getTitle() || '';
      const description = event.getDescription() || '';
      result.push({
        id: event.getId(), start: beginning, seller: sellerFromText_(title),
        status: appointmentStatus_(title), client: calendarClient_(description),
        phone: normalizePhone_(description), source: sourceFromText_(description)
      });
    });
  });
  return result;
}

function verificaReportSettimanale() { const dashboard = buildDashboard_(); console.log(JSON.stringify({apiVersion:dashboard.apiVersion, reportingCoverage:dashboard.reportingCoverage, weeklyReport:dashboard.weeklyReport})); }

function meetingSourceCoverage_(now) {
  const end = startOfWeek_(now);
  const reference = addDays_(end, -2);
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const issues = [];
  const leadsBook = SpreadsheetApp.openById(LEADS_ID);
  const salesBook = SpreadsheetApp.openById(SALES_ID);
  const archiveSources = leadHistorySources_(leadsBook, now);
  const currentMonth = now.getFullYear() + '-' + now.getMonth();
  const requiredMonths = {};
  for (let date = start; date < end; date = addDays_(date, 1)) {
    requiredMonths[date.getFullYear() + '-' + date.getMonth()] = { year: date.getFullYear(), month: date.getMonth() + 1 };
  }
  function requireSheet(book, name) {
    const sheet = book.getSheetByName(name);
    if (!sheet) issues.push('Fonte mancante: ' + name);
    return sheet;
  }
  CURRENT_LEAD_SHEETS.concat(['Preventivi']).forEach(function (name) {
    const sheet = requireSheet(leadsBook, name);
    if (!sheet || sheet.getLastRow() < 2) return;
    // A populated date that cannot be interpreted must not silently become zero.
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    values.forEach(function (row, index) {
      if (row[0] && row[1] && !parseDate_(row[0])) issues.push('Data non valida: ' + name + ', riga ' + (index + 2));
    });
  });
  Object.keys(requiredMonths).forEach(function (key) {
    const month = requiredMonths[key];
    if (key === currentMonth) {
      requireSheet(salesBook, "PROIEZ. REDDITIVITA'");
    } else {
      const archives = archiveSources.filter(function (source) {
        return source.year === month.year && source.month === month.month && leadsBook.getSheetByName(source.name);
      });
      if (!archives.length) issues.push('Archivio lead non disponibile per ' + month.year + '-' + month.month);
      // readOfficialSales_ currently supports these years explicitly.
      if (month.year !== 2025 && month.year !== 2026) issues.push('Anno venduto non supportato dal CRM: ' + month.year);
      requireSheet(salesBook, 'CAR ' + month.year);
      requireSheet(salesBook, month.year === 2026 ? 'AD MOTOR 2026' : 'AD MOTOR');
    }
  });
  const projection = salesBook.getSheetByName("PROIEZ. REDDITIVITA'");
  if (requiredMonths[currentMonth] && projection && projection.getLastRow() >= 2) {
    const rows = projection.getRange(2, 2, projection.getLastRow() - 1, 10).getValues();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    let started = false;
    rows.some(function (row, index) {
      const hasData = Boolean(String(row[4] || '').trim() && (row[2] || row[3]));
      const date = parseDate_(row[0]);
      if (!date) {
        if (started && !hasData) return true;
        if (started && hasData && row[0]) issues.push('Data contratto sostituita dal CRM: riga ' + (index + 2));
        return false;
      }
      if (!started) {
        if (!inRange_(date, monthStart, monthEnd)) return false;
        started = true;
      }
      if (hasData && !inRange_(date, monthStart, monthEnd)) issues.push('Data contratto spostata di mese dal CRM: riga ' + (index + 2));
      return false;
    });
  }
  return {
    start: Utilities.formatDate(start, 'Europe/Rome', 'yyyy-MM-dd'),
    endExclusive: Utilities.formatDate(end, 'Europe/Rome', 'yyyy-MM-dd'),
    complete: issues.length === 0, calendarIds: CRM_REPORT_CALENDAR_IDS.slice(), issues: issues
  };
}

// Additive reporting only. Does not change dashboard KPIs or source sheets.
// Additive reporting only. Does not change dashboard KPIs or source sheets.
// Additive reporting only. Does not change dashboard KPIs or source sheets.
function buildCrmMonthlyMeetingReport_(leads, appointments, quotes, sales, now, coverage, deliveries, historicalEnd) {
  const day = function (d) { return Utilities.formatDate(d, 'Europe/Rome', 'yyyy-MM-dd'); };
  const monday = startOfWeek_(now);
  const cutoffDate = historicalEnd || addDays_(monday, -2);
  const cutoff = day(cutoffDate);
  const monthStart = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth(), 1);
  const nextMonth = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth() + 1, 1);
  const leadEnd = historicalEnd || addDays_(monday, -1);
  const leadCutoff = day(leadEnd < nextMonth ? leadEnd : addDays_(nextMonth,-1));
  const names = ['LIGUORI','BORDINI','GRANDOLINI','CAIRONI','MONACELLI','PAGLIARA','ALTRI'];
  const issues = (coverage.issues || []).slice();
  const deliveriesAvailable = deliveries.available !== false && !(deliveries.issues || []).length;
  const warnings = deliveriesAvailable ? [] : ['Planning consegne non disponibile per il mese: consegne indicate come n.d. Il resto del report è completo.'];
  function empty() {
    const out = { leads:0, appointments:0, presented:0, noShows:0, pending:0, quotes:0, leadQuotes:0, contracts:0, leadContracts:0, plannedDeliveries:0, workdays:0, sellers:{} };
    names.forEach(function(n) { out.sellers[n]={appointments:0,quotes:0,contracts:0,leadContracts:0}; });
    return out;
  }
  const weeks=[];
  let cursor=monthStart;
  while(cursor<nextMonth) {
    const start=cursor;
    do { cursor=addDays_(cursor,1); } while(cursor<nextMonth && cursor.getDay()!==1);
    const end=addDays_(cursor,-1);
    weeks.push({start:day(start),end:day(end),completed:day(end)<=leadCutoff,metrics:empty()});
  }
  const total=empty();
  function targets(date,field) {
    if(!date || isNaN(date.getTime())) return [];
    const key=day(date);
    if(key<day(monthStart) || key>(field==='leads'?leadCutoff:cutoff) || (field!=='leads' && date.getDay()===0)) return [];
    const week=weeks.filter(function(w){return key>=w.start && key<=w.end;})[0];
    return week ? [total,week.metrics] : [];
  }
  function add(date,field,seller) {
    targets(date,field).forEach(function(t){
      t[field]++;
      if(seller && Object.prototype.hasOwnProperty.call(t.sellers.ALTRI,field)) {
        const name=names.indexOf(seller)>=0?seller:'ALTRI'; t.sellers[name][field]++;
      }
    });
  }
  for(let d=monthStart;day(d)<=cutoff;d=addDays_(d,1)) add(d,'workdays');
  leads.forEach(function(x){add(x.date,'leads');});
  appointments.forEach(function(x){
    add(x.start,'appointments',x.seller);
    add(x.start,x.status==='presented'?'presented':x.status==='no-show'?'noShows':'pending');
  });
  quotes.forEach(function(x){
    add(x.date,'quotes',x.seller);
    if(x.channelAssignment && x.channelAssignment.kind==='lead') add(x.date,'leadQuotes');
  });
  // Same attribution as buildChannelAnalysis_: a matched quote wins, then lead/origin.
  const leadByName={},quoteByName={};
  leads.forEach(function(x){addContactIndex_(leadByName,contactNameKey_(x.client),x);});
  quotes.forEach(function(x){addContactIndex_(quoteByName,contactNameKey_(x.client),x);});
  sales.forEach(function(x){
    add(x.date,'contracts',x.seller);
    const quote=findLatestBefore_(quoteByName[contactNameKey_(x.client)]||[],x.date);
    const attributed=quote&&quote.channelAssignment ? quote.channelAssignment.kind==='lead'
      : Boolean(findLatestBefore_(leadByName[contactNameKey_(x.client)]||[],x.date))||isLeadOrigin_(x.origin);
    if(attributed) add(x.date,'leadContracts',x.seller);
  });
  if (deliveriesAvailable) (deliveries.items||[]).forEach(function(x){add(x.date,'plannedDeliveries');});
  else [total].concat(weeks.map(function(w){return w.metrics;})).forEach(function(m){m.plannedDeliveries=null;});
  function ratios(m) {
    const ratio=function(n,d){return d>0?n/d*100:null;};
    m.ratios={leadToAppointment:ratio(m.appointments,m.leads),quoteToContract:ratio(m.contracts,m.quotes),
      leadQuoteToLeadContract:ratio(m.leadContracts,m.leadQuotes),leadToContract:ratio(m.leadContracts,m.leads),
      appointmentToContract:ratio(m.contracts,m.appointments)};
    names.forEach(function(n){const s=m.sellers[n]; s.quoteToContract=ratio(s.contracts,s.quotes);s.appointmentToContract=ratio(s.contracts,s.appointments);});
  }
  [total].concat(weeks.map(function(w){return w.metrics;})).forEach(ratios);
  if(total.appointments!==total.presented+total.noShows+total.pending) issues.push('Esiti appuntamenti incoerenti');
  return {schemaVersion:'2',status:issues.length?'review_required':'ready',sendAllowed:issues.length===0,issues:issues,warnings:warnings,deliveriesAvailable:deliveriesAvailable,
    period:{month:cutoff.slice(0,7),start:day(monthStart),cutoff:cutoff,leadCutoff:leadCutoff,meetingMonday:day(monday),timezone:'Europe/Rome'},
    weekKey:'crm-monthly-v2-'+cutoff,weeks:weeks,total:total,sourceUpdatedAt:now.toISOString(),
    definitions:{deliveries:'Celle compilate nel planning: consegne pianificate, non esiti effettivi.',
      appointments:'Tutti gli appuntamenti APP dei due calendari, deduplicati.',
      leads:'Richieste ricevute tutti i giorni, domeniche incluse, fino alla domenica precedente e solo nel mese del report. Medie per giorno lavorativo lunedì–sabato.',
      ratios:'Rapporti tra conteggi del periodo, non conversioni della stessa coorte. Domeniche incluse solo nei lead.'}};
}

function readMonthlyPlannedDeliveries_(referenceSaturday) {
  try { return readMonthlyPlannedDeliveriesSource_(referenceSaturday); }
  catch (error) { return {available:false,items:[],issues:['Planning consegne non accessibile']}; }
}

function readMonthlyPlannedDeliveriesSource_(referenceSaturday) {
  const book=SpreadsheetApp.openById('15WcrscC8OtX-6-kYYyU_1GEsBTbOu_vcKyLDChyBmVQ');
  const month=Utilities.formatDate(referenceSaturday,'Europe/Rome','yyyy-MM');
  const candidates=[];
  // Select by actual date headers, never assume that an old October tab is current.
  book.getSheets().filter(function(s){return /^planning/i.test(s.getName());}).forEach(function(sheet){
    const width=Math.min(sheet.getLastColumn(),32);
    if(width<2) return;
    const header=sheet.getRange(1,1,1,width).getValues()[0];
    const cols=[];
    header.forEach(function(v,i){const d=parseDate_(v);if(i>0&&d&&Utilities.formatDate(d,'Europe/Rome','yyyy-MM')===month)cols.push({index:i,date:d});});
    if(cols.length) candidates.push({sheet:sheet,cols:cols,width:width});
  });
  if(candidates.length!==1) return {items:[],issues:['Planning consegne del mese assente o ambiguo: '+month]};
  const source=candidates[0];
  const height=Math.max(source.sheet.getLastRow()-2,0);
  const values=height?source.sheet.getRange(3,1,height,source.width).getDisplayValues():[];
  const items=[];
  values.forEach(function(row){
    // Only rows labelled as time slots; notes and totals are not appointments.
    if(!/^\s*\d{1,2}[:.]\d{2}\s*[/–-]\s*\d{1,2}[:.]\d{2}/.test(row[0]||''))return;
    source.cols.forEach(function(c){if(String(row[c.index]||'').trim())items.push({date:c.date});});
  });
  return {items:items,issues:[],sheet:source.sheet.getName()};
}

function verificaReportCinqueSlide() {
  const dashboard=buildDashboard_();
  console.log(JSON.stringify({source:dashboard.source,lastUpdated:dashboard.lastUpdated,monthlyMeetingReport:dashboard.monthlyMeetingReport}));
}

function assistantOriginIsLead_(origin) { const value=String(origin||'').toLowerCase(); return ["lead","social","facebook","instagram","tiktok","sito","autoscout","a24","bdc"].some(function(keyword){return value.indexOf(keyword)>=0;}); }
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
