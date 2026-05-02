export type SignalCategory =
  | "hiring_velocity"
  | "leadership_change"
  | "funding_round"
  | "tech_stack_shift"
  | "office_expansion"
  | "layoff_pivot";

export type Industry =
  | "SaaS"
  | "Fintech"
  | "Healthtech"
  | "AI/ML"
  | "Logistics"
  | "Cybersecurity"
  | "E-Commerce"
  | "Climate Tech";

export type Region =
  | "DACH"
  | "Nordics"
  | "UK & Ireland"
  | "BeNeLux"
  | "Iberia"
  | "North America";

export type SignalStrength = "weak" | "moderate" | "strong" | "critical";

export interface HiringSignal {
  id: string;
  category: SignalCategory;
  title: string;
  detectedAt: string; // ISO date
  source: string;
  confidence: number; // 0-1
  delta: number; // momentum delta
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry: Industry;
  region: Region;
  headquarters: string;
  employees: number;
  employeeGrowth90d: number; // percent
  openRoles: number;
  rolesGrowth30d: number; // percent
  fundingStage: "Seed" | "Series A" | "Series B" | "Series C" | "Series D+" | "Public" | "Bootstrapped";
  lastFundingAmountM: number; // in million USD
  lastFundingMonthsAgo: number;
  techStackShifts: number;
  leadershipChanges90d: number;
  signals: HiringSignal[];
  description: string;
  predictedHiringWindowDays: number;
  predictedRolesNext90d: number;
}

export interface ScoredCompany extends Company {
  score: number; // 0-100
  strength: SignalStrength;
  topDrivers: { label: string; weight: number }[];
}

export interface FilterState {
  search: string;
  industries: Industry[];
  regions: Region[];
  minScore: number;
  category: SignalCategory | "all";
}
