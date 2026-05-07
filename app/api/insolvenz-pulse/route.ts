import { NextRequest } from 'next/server';
import { getCompanies, getSignals } from '../../../lib/mockData';
import { resolveBundesland } from '../../../lib/germanRegions';
import { discoverInsolvenzAnthropic } from '../../../lib/anthropicDiscovery';
import type { CompanySignal, CompanyProfile, HiringSignalType } from '../../../lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TARGET_TYPES: HiringSignalType[] = ['insolvency', 'restructuring'];
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 90;
const MAX_WINDOW_DAYS = 365;

interface InsolvenzItem {
  signalId: string;
  companyId: string;
  companyName: string;
  industry: string;
  bundeslandCode: string | null;
  bundeslandName: string | null;
  signalType: 'insolvency' | 'restructuring';
  observedAt: string;
  daysAgo: number;
  impact: number;
  confidence: number;
  title?: string;
  source?: string;
  url?: string;
}

interface InsolvenzResp {
  ok: true;
  count: number;
  windowDays: number;
  generatedAt: string;
  summary: {
    insolvencies: number;
    restructurings: number;
    byBundesland: Array<{ code: string; name: string; count: number }>;
    sources: { classifier: number; discovery: number };
  };
  data: InsolvenzItem[];
}

function canonicalKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, (ch) =>
      ch === 'ä' ? 'ae' : ch === 'ö' ? 'oe' : ch === 'ü' ? 'ue' : 'ss'
    )
    .replace(/\b(ag|gmbh|se|kgaa|kg|ohg|ug|holding|group|gruppe|inc|corp|ltd|plc)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function metaString(
  meta: CompanySignal['meta'] | undefined,
  ...keys: string[]
): string | undefined {
  if (!meta) return undefined;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return undefined;
}

function resolveLand(
  signal: CompanySignal,
  company: CompanyProfile | undefined
): { code: string | null; name: string | null } {
  const fromMetaCode = metaString(signal.meta, 'bundesland');
  if (fromMetaCode) {
    const code = fromMetaCode.toUpperCase().trim();
    const land = resolveBundesland(code);
    if (land) return { code: land.code, name: land.name };
  }
  const fromMetaHQ = metaString(signal.meta, 'headquarters');
  if (fromMetaHQ) {
    const land = resolveBundesland(fromMetaHQ);
    if (land) return { code: land.code, name: land.name };
  }
  if (company?.headquarters) {
    const land = resolveBundesland(company.headquarters);
    if (land) return { code: land.code, name: land.name };
  }
  if (company?.name) {
    const land = resolveBundesland(company.name);
    if (land) return { code: land.code, name: land.name };
  }
  return { code: null, name: null };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawWindow = Number(url.searchParams.get('window'));
  const windowDays =
    Number.isFinite(rawWindow) && rawWindow > 0
      ? Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.floor(rawWindow)))
      : DEFAULT_WINDOW_DAYS;
  const [companies, signals, discoverySignals] = await Promise.all([
    getCompanies(),
    getSignals(),
    discoverInsolvenzAnthropic().catch(() => [] as CompanySignal[]),
  ]);
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const cutoff = Date.now() - windowDays * DAY_MS;

  // Merge classifier-derived + discovery-derived signals. Dedupe rule:
  // same canonical company key + same signalType + within 7 days of
  // each other → treat as one event, prefer the classifier hit (it has
  // a known companyId / canonical metadata). Keep both sources counted
  // so the summary can attribute coverage.
  let classifierCount = 0;
  let discoveryCount = 0;
  const seen = new Map<string, number>();
  const items: InsolvenzItem[] = [];

  const ingest = (s: CompanySignal, origin: 'classifier' | 'discovery') => {
    if (!TARGET_TYPES.includes(s.signalType)) return;
    const observed = Date.parse(s.observedAt);
    if (Number.isNaN(observed) || observed < cutoff) return;

    const company = companyById.get(s.companyId);
    const land = resolveLand(s, company);
    const name =
      company?.name ?? metaString(s.meta, 'companyName') ?? s.companyId;
    const dedupKey = `${canonicalKey(name)}|${s.signalType}`;
    const prevTs = seen.get(dedupKey);
    if (prevTs !== undefined && Math.abs(prevTs - observed) <= 7 * DAY_MS) {
      return;
    }
    seen.set(dedupKey, observed);

    if (origin === 'classifier') classifierCount++;
    else discoveryCount++;

    items.push({
      signalId: s.id,
      companyId: s.companyId,
      companyName: name,
      industry: company?.industry ?? metaString(s.meta, 'industry') ?? '—',
      bundeslandCode: land.code,
      bundeslandName: land.name,
      signalType: s.signalType as 'insolvency' | 'restructuring',
      observedAt: s.observedAt,
      daysAgo: Math.max(0, Math.floor((Date.now() - observed) / DAY_MS)),
      impact: s.impact,
      confidence: s.confidence,
      title: metaString(s.meta, 'title', 'headline'),
      source: metaString(s.meta, 'source', 'provider'),
      url: metaString(s.meta, 'url', 'link'),
    });
  };

  // Classifier first — it's the higher-trust source (RSS-grounded).
  for (const s of signals) ingest(s, 'classifier');
  for (const s of discoverySignals) ingest(s, 'discovery');

  items.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));

  const insolvencies = items.filter((i) => i.signalType === 'insolvency').length;
  const restructurings = items.length - insolvencies;

  const counts = new Map<string, { name: string; count: number }>();
  for (const it of items) {
    if (!it.bundeslandCode || !it.bundeslandName) continue;
    const cur = counts.get(it.bundeslandCode);
    if (cur) cur.count += 1;
    else counts.set(it.bundeslandCode, { name: it.bundeslandName, count: 1 });
  }
  const byBundesland = Array.from(counts.entries())
    .map(([code, v]) => ({ code, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count);

  const body: InsolvenzResp = {
    ok: true,
    count: items.length,
    windowDays,
    generatedAt: new Date().toISOString(),
    summary: {
      insolvencies,
      restructurings,
      byBundesland,
      sources: { classifier: classifierCount, discovery: discoveryCount },
    },
    data: items,
  };
  return Response.json(body);
}
