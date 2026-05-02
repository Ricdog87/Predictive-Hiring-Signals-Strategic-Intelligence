import { CandidateSignal, ScoreBreakdown, ScoreResult, ScoringConfig, ScoringWeights } from './types';

const DEFAULT_CONFIG: ScoringConfig = {
  modelVersion: 'v2.0.0',
  clampMin: 0,
  clampMax: 100,
  weights: {
    experience: 0.3,
    skills: 0.3,
    education: 0.15,
    engagement: 0.15,
    culture: 0.1,
  },
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeWeights(weights: ScoringWeights): ScoringWeights {
  const total = Object.values(weights).reduce((sum, current) => sum + current, 0);
  if (total <= 0) {
    throw new Error('Invalid scoring weights: total must be > 0');
  }

  return {
    experience: weights.experience / total,
    skills: weights.skills / total,
    education: weights.education / total,
    engagement: weights.engagement / total,
    culture: weights.culture / total,
  };
}

function computeSignalStats(signals: CandidateSignal[], signalType: CandidateSignal['signalType']) {
  const subset = signals.filter((signal) => signal.signalType === signalType);
  if (!subset.length) {
    return { rawAverage: 0, confidenceAverage: 0 };
  }

  const rawAverage = subset.reduce((sum, signal) => sum + signal.value, 0) / subset.length;
  const confidenceAverage = subset.reduce((sum, signal) => sum + signal.confidence, 0) / subset.length;

  return { rawAverage, confidenceAverage };
}

export function computeCandidateScore(
  candidateId: string,
  signals: CandidateSignal[],
  overrideConfig?: Partial<ScoringConfig>,
): ScoreResult {
  if (!candidateId) {
    throw new Error('candidateId is required');
  }

  const config: ScoringConfig = {
    ...DEFAULT_CONFIG,
    ...overrideConfig,
    weights: normalizeWeights({ ...DEFAULT_CONFIG.weights, ...overrideConfig?.weights }),
  };

  const categories: CandidateSignal['signalType'][] = ['experience', 'skills', 'education', 'engagement', 'culture'];

  const breakdown: ScoreBreakdown[] = categories.map((signalType) => {
    const { rawAverage, confidenceAverage } = computeSignalStats(signals, signalType);
    const weighted = rawAverage * config.weights[signalType];
    const confidenceAdjusted = weighted * clamp(confidenceAverage, 0, 1);
    return {
      signalType,
      rawAverage: round2(rawAverage),
      weighted: round2(weighted),
      confidenceAdjusted: round2(confidenceAdjusted),
    };
  });

  const preClamp = breakdown.reduce((sum, item) => sum + item.confidenceAdjusted, 0);
  const score = round2(clamp(preClamp, config.clampMin, config.clampMax));

  const reasons = breakdown
    .filter((item) => item.confidenceAdjusted > 0)
    .sort((a, b) => b.confidenceAdjusted - a.confidenceAdjusted)
    .slice(0, 3)
    .map((item) => `${item.signalType}: ${item.confidenceAdjusted}`);

  return {
    candidateId,
    score,
    modelVersion: config.modelVersion,
    computedAt: new Date().toISOString(),
    reasons,
    breakdown,
  };
}
