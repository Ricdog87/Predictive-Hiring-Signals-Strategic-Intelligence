export type ProviderName = 'hermes' | 'n8n' | 'mirofish' | 'internal';

export interface CandidateSignal {
  id: string;
  candidateId: string;
  provider: ProviderName;
  signalType: 'experience' | 'skills' | 'education' | 'engagement' | 'culture';
  value: number;
  confidence: number;
  observedAt: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface CandidateProfile {
  id: string;
  fullName: string;
  role: string;
  location: string;
  yearsExperience: number;
  skills: string[];
  updatedAt: string;
}

export interface ScoringWeights {
  experience: number;
  skills: number;
  education: number;
  engagement: number;
  culture: number;
}

export interface ScoreBreakdown {
  signalType: CandidateSignal['signalType'];
  rawAverage: number;
  weighted: number;
  confidenceAdjusted: number;
}

export interface ScoreResult {
  candidateId: string;
  score: number;
  modelVersion: string;
  computedAt: string;
  reasons: string[];
  breakdown: ScoreBreakdown[];
}

export interface ScoringConfig {
  modelVersion: string;
  clampMin?: number;
  clampMax?: number;
  weights: ScoringWeights;
}

export interface CandidateAggregate {
  profile: CandidateProfile;
  signals: CandidateSignal[];
  latestScore?: ScoreResult;
}

export interface ApiResponse<T> {
  data: T;
  traceId: string;
  generatedAt: string;
}

export interface CandidatePatchInput {
  role?: string;
  location?: string;
  skills?: string[];
}
