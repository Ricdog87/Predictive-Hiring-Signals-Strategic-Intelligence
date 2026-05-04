import { getSignals } from '../../../lib/mockData';
import { resolveCompany } from '../../../src/companyMaster/match';
import { fetchDEUnemployment } from '../../../lib/macro';
import { fetchAllNews } from '../../../lib/newsFetcher';
import { classifyNewsBatch } from '../../../lib/newsClassifier';
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
  kind: 'signal' | 'macro' | 'news';
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
  /** Optional URL the user can open. */
  href?: string;
  /** True for breaking-news items (red dot + EILMELDUNG label). */
  breaking?: boolean;
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
  const [signals, unemployment, newsBatch] = await Promise.all([
    getSignals(),
    fetchDEUnemployment(),
    fetchAllNews(),
  ]);

  const news = classifyNewsBatch(newsBatch.items);

  const items: TickerItem[] = [];

  // 1) Lead with macro — a real-economy data point in the first frame.
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

  // 2) Breaking-news items next — these are the "Eilmeldung" surface.
  const seenNewsKeys = new Set<string>();
  for (const n of news) {
    const key = `${n.entity.canonical}:${n.signalType}`;
    if (seenNewsKeys.has(key)) continue;
    seenNewsKeys.add(key);

    const tone: TickerItem['tone'] =
      n.impact > 0 || POSITIVE_TYPES.has(n.signalType)
        ? 'up'
        : n.impact < 0 || NEGATIVE_TYPES.has(n.signalType)
        ? 'down'
        : 'flat';

    const prefix = n.breaking ? '🔴 EILMELDUNG · ' : '';
    items.push({
      kind: 'news',
      primary: `${prefix}${uppercase(n.entity.canonical)} · ${SIGNAL_LABEL[n.signalType]}`,
      delta: formatDelta(n.impact),
      tone,
      detail: n.title,
      source: n.sourceLabel,
      href: n.link,
      breaking: n.breaking,
    });
    if (items.length >= 18) break;
  }

  // 3) Internal radar signals (live ingest + adapter pipeline) fill
  //    the remaining slots, dedup against news so we don't double up.
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

  for (const { signal } of ranked) {
    const rawName =
      typeof signal.meta?.companyName === 'string'
        ? (signal.meta.companyName as string)
        : signal.companyId;
    const resolved = resolveCompany(rawName);
    const key = `${resolved.companyName}:${signal.signalType}`;
    if (seenNewsKeys.has(key)) continue;
    seenNewsKeys.add(key);

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
    if (items.length >= 28) break;
  }

  return Response.json({
    ok: true,
    items,
    count: items.length,
    macro: unemployment.ok
      ? { deUnemployment: unemployment.data }
      : { deUnemployment: null, error: unemployment.reason },
    news: {
      classified: news.length,
      breaking: news.filter((n) => n.breaking).length,
      feeds: newsBatch.feeds,
    },
    generatedAt: new Date().toISOString(),
  });
}
