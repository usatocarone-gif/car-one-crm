import { google } from "googleapis";
import type { AppointmentItem, DashboardPayload, DashboardPeriod, SellerResult } from "./types";

const SELLERS = ["CAIRONI", "GRANDOLINI", "LIGUORI", "MONACELLI", "BORDINI"];

function auth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Credenziali Google non configurate");
  return new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  });
}

function parseItalianDate(value: unknown) {
  const [day, month, year] = String(value ?? "").split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date: Date) {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 7);
  return result;
}

function sellerFromText(value: string) {
  return SELLERS.find((seller) => value.toUpperCase().includes(seller)) ?? "Non assegnato";
}

function appointmentStatus(summary: string): AppointmentItem["status"] {
  const normalized = summary.toUpperCase().trim();
  if (/(?:^|[-\s])SI\s*$/.test(normalized)) return "presented";
  if (/(?:^|[-\s])NO\s*$/.test(normalized)) return "no-show";
  return "pending";
}

function sellingDays(start: Date, endExclusive: Date) {
  let count = 0;
  const cursor = new Date(start);
  while (cursor < endExclusive) {
    if (cursor.getDay() !== 0) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

type Sale = { date: Date; seller: string; company: "Car One" | "AD Motor" };

function sellerResults(sales: Sale[], appointmentCounts?: Map<string, number>) {
  const names = Array.from(new Set(sales.map((sale) => sale.seller))).filter((name) => name !== "Non assegnato");
  return names.map<SellerResult>((name) => ({
    name: name[0] + name.slice(1).toLowerCase(),
    contracts: sales.filter((sale) => sale.seller === name).length,
    carOne: sales.filter((sale) => sale.seller === name && sale.company === "Car One").length,
    adMotor: sales.filter((sale) => sale.seller === name && sale.company === "AD Motor").length,
    appointments: appointmentCounts?.get(name) ?? null,
  })).sort((a, b) => b.contracts - a.contracts || a.name.localeCompare(b.name));
}

export function googleIsConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_LEADS_SPREADSHEET_ID &&
    process.env.GOOGLE_SALES_SPREADSHEET_ID &&
    process.env.GOOGLE_CALENDAR_ID
  );
}

export async function loadGoogleDashboard(now = new Date()): Promise<DashboardPayload> {
  const client = auth();
  const sheets = google.sheets({ version: "v4", auth: client });
  const calendar = google.calendar({ version: "v3", auth: client });
  const leadsId = process.env.GOOGLE_LEADS_SPREADSHEET_ID!;
  const salesId = process.env.GOOGLE_SALES_SPREADSHEET_ID!;
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const [leadResponse, carResponse, adResponse, calendarResponse] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: leadsId, range: "Foglio1!A:A" }),
    sheets.spreadsheets.values.get({ spreadsheetId: salesId, range: "'CAR 2026'!B:F" }),
    sheets.spreadsheets.values.get({ spreadsheetId: salesId, range: "'AD MOTOR 2026'!B:F" }),
    calendar.events.list({
      calendarId,
      q: "APP",
      timeMin: monthStart.toISOString(),
      timeMax: monthEnd.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
    }),
  ]);

  const leadDates = (leadResponse.data.values ?? []).map((row) => new Date(String(row[0]))).filter((date) => !Number.isNaN(date.valueOf()));
  const parseSales = (rows: unknown[][], company: Sale["company"]) => rows.flatMap<Sale>((row) => {
    const date = parseItalianDate(row[0]);
    if (!date) return [];
    return [{ date, seller: sellerFromText(String(row[4] ?? "")), company }];
  });
  const sales = [
    ...parseSales((carResponse.data.values ?? []) as unknown[][], "Car One"),
    ...parseSales((adResponse.data.values ?? []) as unknown[][], "AD Motor"),
  ];

  const appointments = (calendarResponse.data.items ?? []).map((event) => {
    const start = new Date(event.start?.dateTime ?? event.start?.date ?? "");
    const summary = event.summary ?? "";
    return { id: event.id ?? crypto.randomUUID(), start, seller: sellerFromText(summary), status: appointmentStatus(summary) };
  }).filter((event) => !Number.isNaN(event.start.valueOf()));

  const build = (start: Date, end: Date, target: number | null): DashboardPeriod => {
    const inRange = (date: Date) => date >= start && date < end;
    const periodSales = sales.filter((sale) => inRange(sale.date));
    const periodApps = appointments.filter((event) => inRange(event.start));
    const presented = periodApps.filter((event) => event.status === "presented").length;
    const noShows = periodApps.filter((event) => event.status === "no-show").length;
    const pendingAppointments = periodApps.filter((event) => event.status === "pending").length;
    const counts = new Map<string, number>();
    periodApps.forEach((event) => counts.set(event.seller, (counts.get(event.seller) ?? 0) + 1));
    const totalDays = sellingDays(start, end);
    const elapsedEnd = now < end ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : end;
    const elapsedDays = Math.max(1, sellingDays(start, elapsedEnd));
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    const contracts = periodSales.length;
    return {
      label: "",
      subtitle: "",
      leads: leadDates.filter(inRange).length,
      appointments: periodApps.length,
      presented,
      noShows,
      pendingAppointments,
      contracts,
      carOneContracts: periodSales.filter((sale) => sale.company === "Car One").length,
      adMotorContracts: periodSales.filter((sale) => sale.company === "AD Motor").length,
      target,
      forecast: target ? Math.round((contracts / elapsedDays) * totalDays) : null,
      expectedToDate: target ? Math.round((target * elapsedDays) / totalDays) : null,
      remainingToTarget: target ? Math.max(0, target - contracts) : null,
      requiredPerDay: target && remainingDays ? Math.max(0, target - contracts) / remainingDays : null,
      sellers: sellerResults(periodSales, counts),
    };
  };

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const monthlyTarget = Number(process.env.MONTHLY_CONTRACT_TARGET ?? 50);
  const weeklyTarget = Number(process.env.WEEKLY_CONTRACT_TARGET ?? 12);
  const today = build(todayStart, tomorrow, null);
  const week = build(weekStart, weekEnd, weeklyTarget);
  const month = build(monthStart, monthEnd, monthlyTarget);
  today.label = "Oggi"; today.subtitle = "Giornata commerciale in corso";
  week.label = "Settimana"; week.subtitle = "Settimana commerciale corrente";
  month.label = "Mese & forecast"; month.subtitle = "Andamento mensile e previsione";

  return {
    source: "google-live",
    lastUpdated: now.toISOString(),
    periods: { today, week, month },
    todayAgenda: appointments.filter((event) => sameDay(event.start, now)).map((event) => ({
      id: event.id,
      time: new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(event.start),
      seller: event.seller[0] + event.seller.slice(1).toLowerCase(),
      status: event.status,
    })),
  };
}
