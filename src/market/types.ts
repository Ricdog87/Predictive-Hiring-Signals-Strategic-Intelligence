import { CompanyAggregate, CompanyProfile, CompanySignal } from '../../lib/types';

export interface MarketOverview {
  totalSignals: number;
  highProbabilityCompanies: number;
  averageHiringScore: number;
  averageHiringWindowDays: number;
  newSignals24h: number;
  hottestSectors: string[];
  hottestRegions: string[];
  negativeRiskSignals: number;
  positiveGrowthSignals: number;
}

export interface SectorTrend {
  sector: string;
  companyCount: number;
  signalVolume: number;
  averageScore: number;
  strongestSignalTypes: string[];
  trendDirection: 'up' | 'down' | 'flat';
  confidence: number;
  momentum: number;
}

export interface RegionTrend {
  region: string;
  companyCount: number;
  signalVolume: number;
  averageScore: number;
  hottestSectors: string[];
  trendDirection: 'up' | 'down' | 'flat';
  confidence: number;
}

export interface MarketCluster {
  sector: string;
  region: string;
  companyCount: number;
  averageHiringScore: number;
  dominantSignals: string[];
  momentum: number;
  riskLevel: number;
  opportunityLevel: number;
}

export type MarketInput = {
  companies: CompanyProfile[];
  signals: CompanySignal[];
  aggregates: CompanyAggregate[];
};
