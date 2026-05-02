export type ProviderName = string;

export type HiringSignalType =
  | 'mna_buy'
  | 'mna_sell'
  | 'gf_change'
  | 'patent_filing'
  | 'location_expansion'
  | 'funding_grant'
  | 'press_release'
  | 'restructuring'
  | 'insolvency'
  | 'job_spike'
  | 'employee_growth'
  | 'product_launch'
  | 'new_business_unit';

export interface CompanyProfile {
  id: string;
  name: string;
  industry: string;
  headquarters: string;
  employeeCount: number;
  updatedAt: string;
}

export interface CompanySignal {
  id: string;
  companyId: string;
  provider: ProviderName;
  signalType: HiringSignalType;
  impact: number; // -100..100
  confidence: number; // 0..1
  observedAt: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface ScoreBreakdown {
  signalType: HiringSignalType;
  rawAverage: number;
  weighted: number;
  confidenceAdjusted: number;
}

export interface HiringScoreResult {
  companyId: string;
  hiringScore: number; // 0..100
  confidenceScore: number; // 0..100
  modelVersion: string;
  computedAt: string;
  reasons: string[];
  breakdown: ScoreBreakdown[];
}

export interface HiringPrediction {
  companyId: string;
  hiringProbability: number; // 0..1
  expectedRoleClusters: string[];
  expectedHiringWindowDays: number;
  computedAt: string;
}

export interface CompanyAggregate {
  company: CompanyProfile;
  signals: CompanySignal[];
  latestScore?: HiringScoreResult;
  latestPrediction?: HiringPrediction;
}
