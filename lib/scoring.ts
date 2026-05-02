import { CompanySignal, HiringPrediction, HiringScoreResult, ScoreBreakdown } from './types';

const MODEL_VERSION = 'company-intelligence-v2.1.0';

const WEIGHTS: Record<CompanySignal['signalType'], number> = {
  mna_buy: 1.25,
  mna_sell: -1.1,
  gf_change: 0.7,
  patent_filing: 0.8,
  location_expansion: 1.2,
  funding_grant: 1.1,
  press_release: 0.4,
  restructuring: -0.8,
  insolvency: -1.5,
  job_spike: 1.35,
  employee_growth: 1.15,
  product_launch: 0.9,
  new_business_unit: 1.0,
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

function recencyFactor(observedAt: string): number {
  const days = Math.max(0, (Date.now() - new Date(observedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 30) return 1;
  if (days <= 90) return 0.85;
  if (days <= 180) return 0.65;
  return 0.45;
}

export function computeHiringScore(companyId: string, signals: CompanySignal[]): HiringScoreResult {
  if (!companyId) throw new Error('companyId is required');

  const byType = new Map<CompanySignal['signalType'], CompanySignal[]>();
  for (const signal of signals) {
    const list = byType.get(signal.signalType) ?? [];
    list.push(signal);
    byType.set(signal.signalType, list);
  }

  const breakdown: ScoreBreakdown[] = Array.from(byType.entries()).map(([signalType, list]) => {
    const avgImpact = list.reduce((s, x) => s + x.impact * recencyFactor(x.observedAt), 0) / list.length;
    const avgConfidence = list.reduce((s, x) => s + clamp(x.confidence, 0, 1), 0) / list.length;
    const weighted = avgImpact * WEIGHTS[signalType];
    const confidenceAdjusted = weighted * avgConfidence;
    return {
      signalType,
      rawAverage: round2(avgImpact),
      weighted: round2(weighted),
      confidenceAdjusted: round2(confidenceAdjusted),
    };
  });

  const netImpact = breakdown.reduce((s, x) => s + x.confidenceAdjusted, 0);
  const stackingMultiplier = signals.length >= 8 ? 1.15 : signals.length >= 5 ? 1.08 : 1;
  const hiringScore = round2(clamp(50 + netImpact * stackingMultiplier, 0, 100));

  const confidenceScore = round2(
    clamp(signals.length * 8, 0, 40) +
      clamp((signals.reduce((s, x) => s + x.confidence, 0) / Math.max(signals.length, 1)) * 60, 0, 60),
  );

  const reasons = breakdown
    .sort((a, b) => Math.abs(b.confidenceAdjusted) - Math.abs(a.confidenceAdjusted))
    .slice(0, 3)
    .map((x) => `${x.signalType}: ${x.confidenceAdjusted}`);

  return { companyId, hiringScore, confidenceScore, modelVersion: MODEL_VERSION, computedAt: new Date().toISOString(), reasons, breakdown };
}

export function predictHiring(companyId: string, signals: CompanySignal[]): HiringPrediction {
  const score = computeHiringScore(companyId, signals);
  const expectedRoleClusters = signals.some((s) => s.signalType === 'patent_filing' || s.signalType === 'product_launch')
    ? ['engineering', 'product', 'data']
    : ['sales', 'operations'];
  const expectedHiringWindowDays = score.hiringScore >= 70 ? 45 : score.hiringScore >= 55 ? 75 : 120;
  return {
    companyId,
    hiringProbability: round2(score.hiringScore / 100),
    expectedRoleClusters,
    expectedHiringWindowDays,
    computedAt: new Date().toISOString(),
  };
}
