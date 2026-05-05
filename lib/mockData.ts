/**
 * Data composition layer · v3 (live-news-first).
 *
 * Three sources of CompanySignal, in priority order:
 *
 *   1. `fetchAllNews()` + `classifyNewsBatch()` — live RSS-classified
 *      DACH business news (Tagesschau, Spiegel, manager-magazin, …).
 *      Real companies, real signals, fresh from the wire.
 *
 *   2. `listIngest()` — ingest_store records (n8n pipeline / manual
 *      `/api/ingest` POSTs). Supabase-backed when configured, in-memory
 *      otherwise.
 *
 *   3. `runIngestionPipeline()` — adapter-driven seed (Adzuna /
 *      Bundesanzeiger / etc. scaffolds). Demo data ONLY — used as
 *      fallback when the live pipelines are sparse.
 *
 * Mode controlled by `RSG_DATA_MODE` env var (set in Vercel Project
 * Settings → Environment Variables):
 *
 *   - 'auto' (default)   → live + adapter, but adapter is auto-
 *                          suppressed when liveCount >= 5. Production-clean.
 *   - 'live_only'        → live news + ingest only. Never adapter mocks.
 *   - 'with_adapter'     → always include adapter (legacy / debugging).
 *
 * The scoring engine downstream (`scoring.ts`) is signal-source-agnostic:
 * it computes the same hiring-score regardless of where the signal came
 * from. So switching to live-only flips the dashboard KPIs (TOTAL
 * SIGNALS, HIGH-PROB COMPANIES, AVG HIRING SCORE, POSITIVE GROWTH /
 * NEGATIVE RISK counts) onto real DACH companies automatically.
 */

import { runIngestionPipeline } from '../src/pipeline/runIngestion';
import { enrichCompany, getMasterRecordById, resolveCompany } from '../src/companyMaster/match';
import { CompanyAggregate, CompanyProfile, CompanySignal } from './types';
import { computeHiringScore, predictHiring } from './scoring';
import { ingestRecordToSignal, listIngest } from './ingestStore';
import { fetchAllNews } from './newsFetcher';
import { classifyNewsBatch, type ClassifiedNewsItem } from './newsClassifier';

export type DataMode = 'auto' | 'live_only' | 'with_adapter';

const ADAPTER_SUPPRESS_THRESHOLD = Number(
  process.env.RSG_ADAPTER_SUPPRESS_THRESHOLD ?? 5
);

function resolveDataMode(): DataMode {
  const raw = (process.env.RSG_DATA_MODE ?? '').toLowerCase().trim();
  if (raw === 'live_only') return 'live_only';
  if (raw === 'with_adapter') return 'with_adapter';
  return 'auto';
}

// -----------------------------------------------------------------------------
// News → CompanySignal
// -----------------------------------------------------------------------------

/** Stable id for a news-derived signal — survives re-classification. */
function newsSignalId(item: ClassifiedNewsItem): string {
  const base = `${item.link || item.title}|${item.signalType}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  }
  return `news_${Math.abs(hash).toString(36)}`;
}

function newsItemToSignal(item: ClassifiedNewsItem): CompanySignal {
  const resolved = resolveCompany(item.entity.canonical);
  return {
    id: newsSignalId(item),
    companyId: resolved.companyId,
    provider: `news_${item.source}`,
    signalType: item.signalType,
    impact: item.impact,
    confidence: item.confidence,
    observedAt: item.publishedAt,
    meta: {
      companyName: resolved.companyName,
      title: item.title,
      description: item.description.slice(0, 240),
      source: item.sourceLabel,
      link: item.link,
      industry: item.entity.sector ?? '',
      region: item.entity.region ?? '',
      breaking: item.breaking,
      ageHours: Math.round(item.ageHours * 10) / 10,
      trust: item.trust,
    },
  };
}

async function getNewsSignals(): Promise<CompanySignal[]> {
  try {
    const batch = await fetchAllNews();
    const classified = classifyNewsBatch(batch.items);
    return classified.map(newsItemToSignal);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mockData] news pipeline failed', err);
    return [];
  }
}

// -----------------------------------------------------------------------------
// Ingest store → CompanySignal
// -----------------------------------------------------------------------------

async function getIngestSignals(): Promise<CompanySignal[]> {
  try {
    const records = await listIngest(1000);
    return records.map((rec) => {
      const resolved = resolveCompany(rec.companyName);
      return ingestRecordToSignal(rec, resolved.companyId);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mockData] ingest store read failed', err);
    return [];
  }
}

// -----------------------------------------------------------------------------
// Adapter pipeline → CompanySignal (legacy / fallback)
// -----------------------------------------------------------------------------

async function getAdapterSignals(): Promise<CompanySignal[]> {
  try {
    const adapterBatch = await runIngestionPipeline();
    return adapterBatch.map((s) => ({
      id: String(s.metadata.externalId ?? `${s.source}_${s.companyId}`),
      companyId: s.companyId,
      provider: s.source,
      signalType: s.signalType,
      impact: s.impact,
      confidence: s.confidence,
      observedAt: s.detectedAt,
      meta: {
        companyName: s.companyName,
        title: s.title,
        description: s.description,
        ...s.metadata,
      },
    }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mockData] adapter pipeline failed', err);
    return [];
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function getSignals(): Promise<CompanySignal[]> {
  const mode = resolveDataMode();

  // Live sources always run.
  const [newsSignals, ingestSignals] = await Promise.all([
    getNewsSignals(),
    getIngestSignals(),
  ]);
  const liveCount = newsSignals.length + ingestSignals.length;

  // Adapter inclusion logic.
  let adapterSignals: CompanySignal[] = [];
  const includeAdapter =
    mode === 'with_adapter' ||
    (mode === 'auto' && liveCount < ADAPTER_SUPPRESS_THRESHOLD);
  if (includeAdapter) {
    adapterSignals = await getAdapterSignals();
  }

  // De-dup by id; live signals win.
  const seen = new Set<string>();
  const merged: CompanySignal[] = [];
  for (const sig of [...newsSignals, ...ingestSignals, ...adapterSignals]) {
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

/**
 * Diagnostics for /api/health. Returns the number of signals from each
 * source so an operator can see at a glance which path is hot.
 */
export async function describeDataPath(): Promise<{
  mode: DataMode;
  news: number;
  ingest: number;
  adapter: number;
  effectivePath: string;
}> {
  const mode = resolveDataMode();
  const [newsSignals, ingestSignals] = await Promise.all([
    getNewsSignals(),
    getIngestSignals(),
  ]);
  const liveCount = newsSignals.length + ingestSignals.length;
  const includeAdapter =
    mode === 'with_adapter' ||
    (mode === 'auto' && liveCount < ADAPTER_SUPPRESS_THRESHOLD);
  const adapterCount = includeAdapter ? (await getAdapterSignals()).length : 0;
  return {
    mode,
    news: newsSignals.length,
    ingest: ingestSignals.length,
    adapter: adapterCount,
    effectivePath: includeAdapter
      ? `live + adapter (live=${liveCount}, adapter=${adapterCount})`
      : `live only (n=${liveCount}, adapter suppressed)`,
  };
}
