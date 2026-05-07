/**
 * Data composition layer · v4 (live + discovery).
 *
 * Four sources of CompanySignal, in priority order:
 *
 *   1. `fetchAllNews()` + `classifyNewsBatch()` — RSS-classified DACH
 *      business news. Real but limited to what flows through fixed feeds.
 *
 *   2. `getDiscoveredSignals()` — NEW. Calls Hermes
 *      `/discover-dach-signals` which uses OpenRouter live tier
 *      (gpt-4o-mini:online) to actively scan the web for current
 *      DACH hiring signals. Returns 10–30 fresh structured signals
 *      per call. Cached in-process for ~10 min.
 *
 *   3. `listIngest()` — n8n / manual `/api/ingest` POSTs.
 *
 *   4. `runIngestionPipeline()` — adapter-driven seed (mock companies).
 *      Demo data ONLY — auto-suppressed when liveCount >= 5.
 *
 * Mode controlled by `RSG_DATA_MODE` env var:
 *   - 'auto' (default)   → all live sources + adapter as fallback
 *   - 'live_only'        → news + discovery + ingest. Never adapter.
 *   - 'with_adapter'     → always include adapter (legacy / debug).
 *
 * Discovery is gated by `RSG_DISCOVERY_ENABLED` (default 'true').
 * Set 'false' to skip the Hermes call entirely (e.g. if budget caps).
 */

import { runIngestionPipeline } from '../src/pipeline/runIngestion';
import { enrichCompany, getMasterRecordById, resolveCompany } from '../src/companyMaster/match';
import { CompanyAggregate, CompanyProfile, CompanySignal } from './types';
import { computeHiringScore, predictHiring } from './scoring';
import { ingestRecordToSignal, listIngest } from './ingestStore';
import { fetchAllNews } from './newsFetcher';
import { classifyNewsBatch, type ClassifiedNewsItem } from './newsClassifier';
import { isVerifierConfigured, verifyDiscoveryBatch } from './openaiVerifier';

export type DataMode = 'auto' | 'live_only' | 'with_adapter';

const ADAPTER_SUPPRESS_THRESHOLD = Number(
  process.env.RSG_ADAPTER_SUPPRESS_THRESHOLD ?? 5
);

const DISCOVERY_ENABLED =
  (process.env.RSG_DISCOVERY_ENABLED ?? 'true').toLowerCase() !== 'false';
const DISCOVERY_MAX_SIGNALS = Number(process.env.RSG_DISCOVERY_MAX ?? 25);
const DISCOVERY_CACHE_MS = Number(process.env.RSG_DISCOVERY_CACHE_MS ?? 600_000); // 10 min
const DISCOVERY_TIMEOUT_MS = Number(
  process.env.RSG_DISCOVERY_TIMEOUT_MS ?? 60_000
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
// Hermes Live-Discovery → CompanySignal
// -----------------------------------------------------------------------------

interface DiscoveredSignal {
  companyName: string;
  sector: string;
  headquarters: string;
  region: string;
  bundesland?: string;
  signalType: CompanySignal['signalType'];
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  impact: number;
  confidence: number;
  publishedAt: string;
}

interface DiscoveryEnvelope {
  ok: boolean;
  signals?: DiscoveredSignal[];
  rawCount?: number;
  validatedCount?: number;
  generatedAt?: string;
  error?: string;
}

interface CacheEntry {
  data: CompanySignal[];
  expiresAt: number;
  fetchedAt: number;
}

const globalForDiscovery = globalThis as unknown as {
  __rsgDiscoveryCache?: CacheEntry;
};

function discoverySignalId(s: DiscoveredSignal): string {
  const base = `${s.companyName}|${s.signalType}|${s.publishedAt || ''}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  }
  return `disc_${Math.abs(hash).toString(36)}`;
}

function discoveryToSignal(s: DiscoveredSignal): CompanySignal {
  const resolved = resolveCompany(s.companyName);
  const observedAt =
    s.publishedAt && !Number.isNaN(Date.parse(s.publishedAt))
      ? new Date(s.publishedAt).toISOString()
      : new Date().toISOString();
  return {
    id: discoverySignalId(s),
    companyId: resolved.companyId,
    provider: 'discovery_dach',
    signalType: s.signalType,
    impact: s.impact,
    confidence: s.confidence,
    observedAt,
    meta: {
      companyName: resolved.companyName,
      title: s.title || '',
      description: (s.description || '').slice(0, 240),
      source: s.source || '',
      link: s.sourceUrl || '',
      industry: s.sector || '',
      region: s.region || '',
      bundesland: s.bundesland ?? '',
      headquarters: s.headquarters || '',
    },
  };
}

async function callHermesDiscovery(): Promise<CompanySignal[]> {
  const baseUrl = process.env.HERMES_BASE_URL?.trim();
  const apiKey = process.env.HERMES_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return [];
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/discover-dach-signals`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          market: 'DACH',
          maxSignals: DISCOVERY_MAX_SIGNALS,
        }),
        cache: 'no-store',
      }
    );
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[mockData] discovery HTTP ${res.status}: ${(await res
          .text()
          .catch(() => ''))
          .slice(0, 200)}`
      );
      return [];
    }
    const body = (await res.json()) as DiscoveryEnvelope;
    if (!body.ok || !Array.isArray(body.signals)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[mockData] discovery ok=false: ${body.error ?? 'unknown'}`
      );
      return [];
    }
    return body.signals.map(discoveryToSignal);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[mockData] discovery call failed',
      (err as Error).message
    );
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function getDiscoveredSignals(): Promise<CompanySignal[]> {
  if (!DISCOVERY_ENABLED) return [];
  const now = Date.now();
  const cached = globalForDiscovery.__rsgDiscoveryCache;
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const fresh = await callHermesDiscovery();
  // Cross-verify high-confidence signals through OpenAI as an
  // independent second opinion. No-op when OPENAI_VERIFIER_ENABLED!=true.
  // Failures inside the verifier are non-fatal — discovery results pass
  // through unchanged if anything goes wrong.
  const verified = isVerifierConfigured()
    ? await verifyDiscoveryBatch(fresh).catch(() => fresh)
    : fresh;
  globalForDiscovery.__rsgDiscoveryCache = {
    data: verified,
    expiresAt: now + DISCOVERY_CACHE_MS,
    fetchedAt: now,
  };
  return verified;
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

  // Live sources run in parallel.
  const [newsSignals, discoverySignals, ingestSignals] = await Promise.all([
    getNewsSignals(),
    getDiscoveredSignals(),
    getIngestSignals(),
  ]);
  const liveCount =
    newsSignals.length + discoverySignals.length + ingestSignals.length;

  let adapterSignals: CompanySignal[] = [];
  const includeAdapter =
    mode === 'with_adapter' ||
    (mode === 'auto' && liveCount < ADAPTER_SUPPRESS_THRESHOLD);
  if (includeAdapter) {
    adapterSignals = await getAdapterSignals();
  }

  const seen = new Set<string>();
  const merged: CompanySignal[] = [];
  // Priority: news > discovery > ingest > adapter
  for (const sig of [
    ...newsSignals,
    ...discoverySignals,
    ...ingestSignals,
    ...adapterSignals,
  ]) {
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
  discovery: number;
  ingest: number;
  adapter: number;
  effectivePath: string;
  discoveryEnabled: boolean;
  discoveryCacheAgeSec: number | null;
}> {
  const mode = resolveDataMode();
  const [newsSignals, discoverySignals, ingestSignals] = await Promise.all([
    getNewsSignals(),
    getDiscoveredSignals(),
    getIngestSignals(),
  ]);
  const liveCount =
    newsSignals.length + discoverySignals.length + ingestSignals.length;
  const includeAdapter =
    mode === 'with_adapter' ||
    (mode === 'auto' && liveCount < ADAPTER_SUPPRESS_THRESHOLD);
  const adapterCount = includeAdapter ? (await getAdapterSignals()).length : 0;

  const cache = globalForDiscovery.__rsgDiscoveryCache;
  const cacheAge = cache ? Math.round((Date.now() - cache.fetchedAt) / 1000) : null;

  return {
    mode,
    news: newsSignals.length,
    discovery: discoverySignals.length,
    ingest: ingestSignals.length,
    adapter: adapterCount,
    effectivePath: includeAdapter
      ? `news=${newsSignals.length} discovery=${discoverySignals.length} ingest=${ingestSignals.length} adapter=${adapterCount}`
      : `news=${newsSignals.length} discovery=${discoverySignals.length} ingest=${ingestSignals.length} (adapter suppressed, live=${liveCount})`,
    discoveryEnabled: DISCOVERY_ENABLED,
    discoveryCacheAgeSec: cacheAge,
  };
}
