import { getCompanies, getSignals } from '../../../lib/mockData';
import { resolveBundesland } from '../../../lib/germanRegions';
import type { CompanySignal, CompanyProfile, HiringSignalType } from '../../../lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TARGET_TYPES: HiringSignalType[] = ['insolvency', 'restructuring'];
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

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
  generatedAt: string;
  summary: {
    insolvencies: number;
    restructurings: number;
    byBundesland: Array<{ code: string; name: string; count: number }>;
  };
  data: InsolvenzItem[];
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

export async function GET() {
  const [companies, signals] = await Promise.all([
    getCompanies(),
    getSignals(),
  ]);
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const cutoff = Date.now() - WINDOW_MS;

  const items: InsolvenzItem[] = [];
  for (const s of signals) {
    if (!TARGET_TYPES.includes(s.signalType)) continue;
    const observed = Date.parse(s.observedAt);
    if (Number.isNaN(observed) || observed < cutoff) continue;

    const company = companyById.get(s.companyId);
    const land = resolveLand(s, company);

    items.push({
      signalId: s.id,
      companyId: s.companyId,
      companyName: company?.name ?? metaString(s.meta, 'companyName') ?? s.companyId,
      industry: company?.industry ?? metaString(s.meta, 'industry') ?? '—',
      bundeslandCode: land.code,
      bundeslandName: land.name,
      signalType: s.signalType as 'insolvency' | 'restructuring',
      observedAt: s.observedAt,
      daysAgo: Math.max(0, Math.floor((Date.now() - observed) / (24 * 60 * 60 * 1000))),
      impact: s.impact,
      confidence: s.confidence,
      title: metaString(s.meta, 'title', 'headline'),
      source: metaString(s.meta, 'source', 'provider'),
      url: metaString(s.meta, 'url', 'link'),
    });
  }

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
    generatedAt: new Date().toISOString(),
    summary: { insolvencies, restructurings, byBundesland },
    data: items,
  };
  return Response.json(body);
}
