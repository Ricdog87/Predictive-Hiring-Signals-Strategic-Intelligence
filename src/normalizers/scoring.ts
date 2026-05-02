export const SOURCE_QUALITY: Record<string, number> = {
  bundesanzeiger: 0.95,
  handelsregister: 0.94,
  pressebox: 0.78,
  company_newsroom: 0.72,
  linkedin_company: 0.68,
  job_posting_trend: 0.75,
  patent_signals: 0.9,
  funding_signals: 0.88,
};

export function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

export function confidenceScore(signalStrength: number, source: string): number {
  const sourceQuality = SOURCE_QUALITY[source] ?? 0.6;
  return clamp(signalStrength * 0.65 + sourceQuality * 0.35);
}
