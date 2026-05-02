export type IngestionSignalType =
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

export interface RawSignal {
  source: string;
  externalId: string;
  companyName: string;
  publishedAt: string;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
}

export interface NormalizedCompanySignal {
  companyId: string;
  companyName: string;
  signalType: IngestionSignalType;
  source: string;
  title: string;
  description: string;
  detectedAt: string;
  impact: number;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface SourceAdapter {
  source: string;
  fetch(): Promise<RawSignal[]>;
}
