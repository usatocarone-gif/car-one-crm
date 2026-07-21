export type PeriodKey = "today" | "week" | "month";

export type SellerResult = {
  name: string;
  contracts: number;
  carOne: number;
  adMotor: number;
  appointments: number | null;
};

export type AppointmentItem = {
  id: string;
  time: string;
  seller: string;
  status: "presented" | "no-show" | "pending";
};

export type DashboardPeriod = {
  label: string;
  subtitle: string;
  leads: number;
  appointments: number;
  presented: number;
  noShows: number;
  pendingAppointments: number;
  upcomingAppointments?: number;
  overdueAppointments?: number;
  quotes?: number;
  contracts: number;
  carOneContracts: number;
  adMotorContracts: number;
  target: number | null;
  forecast: number | null;
  expectedToDate: number | null;
  remainingToTarget: number | null;
  requiredPerDay: number | null;
  sellers: SellerResult[];
};

export type DashboardPayload = {
  source: "snapshot" | "google-live";
  lastUpdated: string;
  periods: Record<PeriodKey, DashboardPeriod>;
  todayAgenda: AppointmentItem[];
  upcomingAgenda?: Array<AppointmentItem & { date: string }>;
  quoteHistory?: QuoteHistoryItem[];
  weeklyHistory?: WeeklyCommercialItem[];
  leadSources: Array<{
    name: string;
    leads: number;
    appointments: number | null;
    contracts: number | null;
  }>;
  sellerConversions: Array<{
    name: string;
    appointments: number;
    presented: number;
    noShows: number;
    pending: number;
    contracts: number;
  }>;
  leadHistory: LeadHistoryItem[];
  contractHistory: ContractHistoryItem[];
  channelAnalysis?: ChannelAnalysis;
};

export type ChannelCohortItem = {
  year: number;
  month: number;
  week: number;
  channel: string;
  entries: number;
  appointments: number;
  quotes: number;
  contracts: number;
  sellers: ChannelSellerItem[];
};

export type ChannelSellerItem = {
  name: string;
  entries: number;
  appointments: number;
  quotes: number;
  contracts: number;
};

export type ShowRateHistoryItem = {
  year: number;
  month: number;
  week: number;
  appointments: number;
  presented: number;
  noShows: number;
  pending: number;
};

export type ChannelAnalysis = {
  leadCohorts: ChannelCohortItem[];
  directCohorts: ChannelCohortItem[];
  showRateHistory: ShowRateHistoryItem[];
  unattributedQuotes: number;
  unattributedContracts: number;
};

export type QuoteHistoryItem = {
  date: string;
  year: number;
  month: number;
  client: string;
  seller: string;
  vehicle: string;
  feedback: string;
  outcome: string;
  source: string;
};

export type LeadHistoryItem = {
  year: number;
  month: number;
  channel: string;
  city: string;
  province: string;
  region: string;
  leads: number;
};

export type ContractHistoryItem = {
  date: string;
  year: number;
  month: number;
  seller: string;
  company: "Car One" | "AD Motor";
  origin: string;
  client?: string;
};

export type WeeklyCommercialItem = {
  weekStart: string;
  label: string;
  appointments: number;
  quotes: number;
  contracts: number;
};
