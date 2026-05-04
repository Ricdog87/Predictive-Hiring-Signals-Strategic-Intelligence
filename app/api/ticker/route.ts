import { getSignals } from '../../../lib/mockData';
import { resolveCompany } from '../../../src/companyMaster/match';
import { fetchDEUnemployment } from '../../../lib/macro';
import type { HiringSignalType } from '../../../lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SIGNAL_LABEL: Record<HiringSignalType, string> = {
  mna_buy: 'M&A · Acquirer',
  mna_sell: 'M&A · Target',
  gf_change: 'Leadership Δ',
  patent_filing: 'Patent',
  location_expansion: 'Expansion',
  funding_grant: 'Funding',
  press_release: 'Press',
  restructuring: 'Restructuring',
  insolvency: 'Insolvency',
  job_spike: 'Hiring spike',
  employee_growth: 'Headcount Δ',
  product_launch: 'Launch',
  new_business_unit: 'New BU',
};

const POSITIVE_TYPES = new Set<HiringSignalType>([
  'job_spike',
  'employee_growth',
  'funding_grant',
  'location_expansion',
  'new_business_unit',
  'product_launch',
  'patent_filing',
  'mna_buy',
]);

const NEGATIVE_TYPES = new Set<HiringSignalType>([
  'insolvency',
  'restructuring',
  'mna_sell',
]);

export interface TickerItem {
  kind: 'signal' | 'macro';
  /** Compact label like `APEX DYNAMICS · Funding` */
  primary: string;
  /** Numeric badge, e.g. `+22%`, `-16%`, `6.0%` */
  delta: string;
  /** Visual sentiment hint */
  tone: 'up' | 'down' | 'flat';
  /** Detail line · used as tooltip in the UI if needed */
  detail?: string;
  /** Source string, useful for filtering */
  source?: string;
}

function formatDelta(impact: number): string {
  if (impact === 0) return '±0';
  const sign = impact > 0 ? '+' : '−';
  return `${sign}${Math.abs(impact)}%`;
}

function uppercase(name: string): string {
  return name.toUpperCase();
}

export async function GET() {
  const [signals, unemployment] = await Promise.all([
    getSignals(),
    fetchDEUnemployment(),
  ]);

  // Sort by recency × |impact| × confidence — newest, strongest first.
  const ranked = signals
    .map((s) => {
      const ageDays = Math.max(
        0,
        (Date.now() - new Date(s.observedAt).getTime()) / 86_400_000
      );
      const recency = ageDays <= 7 ? 1.0 : ageDays <= 30 ? 0.7 : 0.4;
      return {
        signal: s,
        score: Math.abs(s.impact) * s.confidence * recency,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const seenCompanies = new Set<string>();
  const items: TickerItem[] = [];

  // Lead with macro pills so the first frame of the marquee always
  // carries a real-economy data point.
  if (unemployment.ok) {
    items.push({
      kind: 'macro',
      primary: '🇩🇪 ARBEITSLOSENQUOTE',
      delta: `${unemployment.data.rate.toFixed(1)}%`,
      tone: 'flat',
      detail: `Eurostat · ${unemployment.data.period}`,
      source: 'eurostat',
    });
  }

  for (const { signal } of ranked) {
    // De-dup per (company × signalType) so the marquee doesn't repeat
    // the same news 5x in a row.
    const rawName =
      typeof signal.meta?.companyName === 'string'
        ? (signal.meta.companyName as string)
        : signal.companyId;
    const resolved = resolveCompany(rawName);
    const dedupKey = `${resolved.companyId}:${signal.signalType}`;
    if (seenCompanies.has(dedupKey)) continue;
    seenCompanies.add(dedupKey);

    const tone: TickerItem['tone'] =
      signal.impact > 0 || POSITIVE_TYPES.has(signal.signalType)
        ? 'up'
        : signal.impact < 0 || NEGATIVE_TYPES.has(signal.signalType)
        ? 'down'
        : 'flat';

    items.push({
      kind: 'signal',
      primary: `${uppercase(resolved.companyName)} · ${SIGNAL_LABEL[signal.signalType]}`,
      delta: formatDelta(signal.impact),
      tone,
      detail:
        typeof signal.meta?.title === 'string'
          ? (signal.meta.title as string)
          : undefined,
      source: signal.provider,
    });

    if (items.length >= 24) break;
  }

  return Response.json({
    ok: true,
    items,
    count: items.length,
    macro: unemployment.ok
      ? { deUnemployment: unemployment.data }
      : { deUnemployment: null, error: unemployment.reason },
    generatedAt: new Date().toISOString(),
  });
}
