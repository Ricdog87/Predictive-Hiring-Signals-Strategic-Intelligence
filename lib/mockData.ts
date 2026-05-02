import { runIngestionPipeline } from '../src/pipeline/runIngestion';
import { CompanyAggregate, CompanyProfile, CompanySignal } from './types';
import { computeHiringScore, predictHiring } from './scoring';

export async function getSignals(): Promise<CompanySignal[]> {
  const ingested = await runIngestionPipeline();
  return ingested.map((s) => ({
    id: String(s.metadata.externalId ?? `${s.source}_${s.companyId}`),
    companyId: s.companyId,
    provider: s.source,
    signalType: s.signalType,
    impact: s.impact,
    confidence: s.confidence,
    observedAt: s.detectedAt,
    meta: { companyName: s.companyName, title: s.title, description: s.description, ...s.metadata },
  }));
}

export async function getCompanies(): Promise<CompanyProfile[]> {
  const signals = await getSignals();
  const now = new Date().toISOString();
  const map = new Map<string, CompanyProfile>();
  for (const s of signals) {
    if (!map.has(s.companyId)) {
      map.set(s.companyId, {
        id: s.companyId,
        name: String(s.meta?.companyName ?? s.companyId),
        industry: 'unknown',
        headquarters: 'unknown',
        employeeCount: 0,
        updatedAt: now,
      });
    }
  }
  return [...map.values()];
}

export async function getAggregates(): Promise<CompanyAggregate[]> {
  const [companies, signals] = await Promise.all([getCompanies(), getSignals()]);
  return companies.map((company) => {
    const companySignals = signals.filter((x) => x.companyId === company.id);
    return {
      company,
      signals: companySignals,
      latestScore: computeHiringScore(company.id, companySignals),
      latestPrediction: predictHiring(company.id, companySignals),
    };
  });
}
