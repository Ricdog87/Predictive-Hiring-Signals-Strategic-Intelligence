import { NormalizedCompanySignal, RawSignal } from '../ingestion/types';
import { matchCompany } from '../normalizers/entityMatching';
import { confidenceScore } from '../normalizers/scoring';

function detectType(raw: RawSignal): NormalizedCompanySignal['signalType'] {
  const text = `${raw.title} ${raw.description}`.toLowerCase();
  if (text.includes('patent')) return 'patent_filing';
  if (text.includes('förder') || text.includes('funding')) return 'funding_grant';
  if (text.includes('job spike') || text.includes('offene stellen')) return 'job_spike';
  if (text.includes('produkt') || text.includes('launch')) return 'product_launch';
  if (text.includes('geschäftsbereich')) return 'new_business_unit';
  if (text.includes('reorganisation') || text.includes('restruktur')) return 'restructuring';
  if (text.includes('expansion') || text.includes('niederlassung')) return 'location_expansion';
  return 'press_release';
}

function baseImpact(signalType: NormalizedCompanySignal['signalType']): number {
  const map: Record<NormalizedCompanySignal['signalType'], number> = {
    mna_buy: 18, mna_sell: -16, gf_change: 8, patent_filing: 14, location_expansion: 16,
    funding_grant: 15, press_release: 5, restructuring: -10, insolvency: -30,
    job_spike: 20, employee_growth: 17, product_launch: 12, new_business_unit: 13,
  };
  return map[signalType];
}

export function normalizeRawSignal(raw: RawSignal): NormalizedCompanySignal {
  const { companyId, companyName } = matchCompany(raw.companyName);
  const signalType = detectType(raw);
  const strength = Math.min(1, Math.max(0.3, Math.abs(baseImpact(signalType)) / 30));
  return {
    companyId,
    companyName,
    signalType,
    source: raw.source,
    title: raw.title,
    description: raw.description,
    detectedAt: raw.publishedAt,
    impact: baseImpact(signalType),
    confidence: confidenceScore(strength, raw.source),
    metadata: { externalId: raw.externalId, payload: raw.payload ?? {} },
  };
}
