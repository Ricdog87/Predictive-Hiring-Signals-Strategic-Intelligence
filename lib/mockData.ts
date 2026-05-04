import { runIngestionPipeline } from '../src/pipeline/runIngestion';
import { enrichCompany, getMasterRecordById, resolveCompany } from '../src/companyMaster/match';
import { CompanyAggregate, CompanyProfile, CompanySignal } from './types';
import { computeHiringScore, predictHiring } from './scoring';
import { ingestRecordToSignal, listIngest } from './ingestStore';

async function getLiveSignals(): Promise<CompanySignal[]> {
  try {
    const records = await listIngest(1000);
    return records.map((rec) => {
      const resolved = resolveCompany(rec.companyName);
      return ingestRecordToSignal(rec, resolved.companyId);
    });
  } catch (err) {
    console.error('[mockData] failed to read live ingest store', err);
    return [];
  }
}

export async function getSignals(): Promise<CompanySignal[]> {
  const [adapterBatch, liveSignals] = await Promise.all([
    runIngestionPipeline(),
    getLiveSignals(),
  ]);
  const adapterSignals: CompanySignal[] = adapterBatch.map((s) => ({
    id: String(s.metadata.externalId ?? `${s.source}_${s.companyId}`),
    companyId: s.companyId,
    provider: s.source,
    signalType: s.signalType,
    impact: s.impact,
    confidence: s.confidence,
    observedAt: s.detectedAt,
    meta: { companyName: s.companyName, title: s.title, description: s.description, ...s.metadata },
  }));

  // De-duplicate by id; live ingested signals win when ids collide
  const seen = new Set<string>();
  const merged: CompanySignal[] = [];
  for (const sig of [...liveSignals, ...adapterSignals]) {
    if (seen.has(sig.id)) continue;
    seen.add(sig.id);
    merged.push(sig);
  }
  return merged;
}

export async function getCompanies(): Promise<CompanyProfile[]> {
  const signals = await getSignals();
  const now = new Date().toISOString();
  const map = new Map<string, CompanyProfile>();
  for (const s of signals) {
    if (map.has(s.companyId)) continue;
    const rawName = String(s.meta?.companyName ?? s.companyId);
    const record = getMasterRecordById(s.companyId) ?? resolveCompany(rawName).record;
    const enrichment = enrichCompany(record);
    const metaIndustry =
      typeof s.meta?.industry === 'string' ? (s.meta.industry as string).trim() : '';
    const metaRegion =
      typeof s.meta?.region === 'string' ? (s.meta.region as string).trim() : '';
    map.set(s.companyId, {
      id: s.companyId,
      name: record?.name ?? rawName,
      industry: enrichment.matched ? enrichment.sector : metaIndustry || enrichment.sector,
      headquarters: enrichment.matched ? enrichment.region : metaRegion || enrichment.region,
      employeeCount: enrichment.employeeCount,
      updatedAt: now,
    });
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
