import { CandidateAggregate, CandidateProfile, CandidateSignal, ProviderName } from './types';

const now = new Date().toISOString();

export const profiles: CandidateProfile[] = [
  {
    id: 'cand_001',
    fullName: 'Alex Morgan',
    role: 'Senior Data Analyst',
    location: 'Berlin',
    yearsExperience: 8,
    skills: ['SQL', 'Python', 'dbt', 'Looker'],
    updatedAt: now,
  },
  {
    id: 'cand_002',
    fullName: 'Priya Sharma',
    role: 'ML Engineer',
    location: 'Munich',
    yearsExperience: 6,
    skills: ['PyTorch', 'MLOps', 'Kubernetes', 'TypeScript'],
    updatedAt: now,
  },
];

function signal(id: string, candidateId: string, provider: ProviderName, signalType: CandidateSignal['signalType'], value: number, confidence: number): CandidateSignal {
  return {
    id,
    candidateId,
    provider,
    signalType,
    value,
    confidence,
    observedAt: now,
    meta: {
      source: provider,
      batch: 'seed-v2',
    },
  };
}

export const signals: CandidateSignal[] = [
  signal('sig_001', 'cand_001', 'hermes', 'experience', 85, 0.95),
  signal('sig_002', 'cand_001', 'n8n', 'skills', 88, 0.92),
  signal('sig_003', 'cand_001', 'mirofish', 'engagement', 76, 0.8),
  signal('sig_004', 'cand_001', 'internal', 'culture', 70, 0.75),
  signal('sig_005', 'cand_001', 'hermes', 'education', 82, 0.9),
  signal('sig_006', 'cand_002', 'hermes', 'experience', 78, 0.93),
  signal('sig_007', 'cand_002', 'n8n', 'skills', 91, 0.89),
  signal('sig_008', 'cand_002', 'mirofish', 'engagement', 80, 0.81),
  signal('sig_009', 'cand_002', 'internal', 'culture', 84, 0.86),
  signal('sig_010', 'cand_002', 'hermes', 'education', 88, 0.9),
];

export const aggregates: CandidateAggregate[] = profiles.map((profile) => ({
  profile,
  signals: signals.filter((item) => item.candidateId === profile.id),
}));
