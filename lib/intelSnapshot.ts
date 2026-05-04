/**
 * Unified intelligence snapshot · v1.
 *
 * One function builds the entire dashboard's-worth of data — macro,
 * regional, sectoral, opportunities, breaking news — into a single
 * consumable JSON document. Used by `/api/intel/snapshot` (the
 * SaaS-grade aggregator) and indirectly by the n8n daily digest hook.
 *
 * Every individual fetch is wrapped in `Promise.allSettled` so a
 * single source going dark never blocks the whole snapshot. Each
 * subsection carries its own `ok` flag plus a `reason` hint when
 * upstream is offline — clients can show partial data confidently.
 */

import { getAggregates } from './mockData';
import { aggregateRegional } from './regionalAggregation';
import {
  fetchDEUnemployment,
  fetchDERegionalUnemployment,
} from './macro';
import {
  fetchECBRate,
  fetchDEInflation,
  fetchDEJobVacancyRate,
  fetchDEEmploymentRate,
  fetchDECompositeLeadingIndicator,
} from './macroSources';
import { fetchAllNews } from './newsFetcher';
import { classifyNewsBatch } from './newsClassifier';
import { fetchAdzunaPulse } from './jobMarketSources';
import { computeOpportunities } from './opportunityEngine';
import { listIngest } from './ingestStore';
import { computeMarketOverview, computeSectorTrends } from '../src/market/engine';

export interface IntelSnapshot {
  generatedAt: string;
  /** Free-form version tag — bump when the schema changes. */
  schemaVersion: '1.0';
  market: {
    totalSignals: number;
    averageHiringScore: number;
    highProbabilityCompanies: number;
    newSignals24h: number;
    positiveGrowthSignals: number;
    negativeRiskSignals: number;
  };
  macro: {
    deUnemployment: { ok: boolean; rate?: number; period?: string; reason?: string };
    deInflation: { ok: boolean; rate?: number; period?: string; reason?: string };
    ecbRate: { ok: boolean; rate?: number; period?: string; reason?: string };
    deJobVacancyRate: { ok: boolean; rate?: number; period?: string; reason?: string };
    deEmploymentRate: { ok: boolean; rate?: number; period?: string; reason?: string };
    deCompositeLeadingIndicator: {
      ok: boolean;
      value?: number;
      period?: string;
      trend?: 'expanding' | 'slowing' | 'contracting' | 'recovering' | 'flat';
      reason?: string;
    };
  };
  regions: {
    quadrants: Array<{
      id: string;
      label: string;
      hiringRate: number;
      momentum30d: number;
      companyCount: number;
      signalCount: number;
      averageHiringScore: number;
    }>;
    topBundeslaender: Array<{
      code: string;
      name: string;
      quadrant: string;
      hiringRate: number;
      companyCount: number;
      signalCount: number;
      unemploymentRate: number | null;
    }>;
  };
  sectors: Array<{
    sector: string;
    companyCount: number;
    signalVolume: number;
    averageScore: number;
    momentum: number;
    trendDirection: 'up' | 'down' | 'flat';
  }>;
  opportunities: Array<{
    companyId: string;
    companyName: string;
    industry: string;
    region: string;
    opportunityScore: number;
    confidence: number;
    topSignals: string[];
    recommendedTiming: string;
    whyNow: string;
  }>;
  breakingNews: Array<{
    company: string;
    signalType: string;
    title: string;
    source: string;
    link: string;
    publishedAt: string;
    breaking: boolean;
  }>;
  jobMarket: {
    ok: boolean;
    totalPostings?: number;
    byCategory?: Array<{ category: string; postings: number; meanSalary: number | null }>;
    topCompaniesAcross?: Array<{ name: string; postings: number }>;
    reason?: string;
  };
}

function settledOk<T>(
  v: PromiseSettledResult<{ ok: true; data: T } | { ok: false; reason?: string; detail?: string }>
):
  | { ok: true; data: T }
  | { ok: false; reason: string } {
  if (v.status === 'rejected') {
    return { ok: false, reason: 'rejected' };
  }
  if (v.value.ok) return { ok: true, data: v.value.data };
  return { ok: false, reason: v.value.reason ?? 'unknown' };
}

export interface SnapshotOptions {
  /** Limit on how many opportunities to include. Default 10. */
  topN?: number;
  /** Limit on how many breaking-news items to include. Default 8. */
  newsLimit?: number;
  /** Skip the live web fetches (for cheap repeated calls). Default false. */
  skipNetworkFetches?: boolean;
}

export async function buildIntelSnapshot(
  opts: SnapshotOptions = {}
): Promise<IntelSnapshot> {
  const topN = opts.topN ?? 10;
  const newsLimit = opts.newsLimit ?? 8;

  const [
    aggregates,
    liveRecords,
  ] = await Promise.all([getAggregates(), listIngest(2000)]);

  const signals = aggregates.flatMap((a) => a.signals);
  const companies = aggregates.map((a) => a.company);

  const market = computeMarketOverview(companies, signals, aggregates);
  const sectorTrends = computeSectorTrends(companies, signals, aggregates);
  const regional = aggregateRegional({ aggregates });
  const opps = computeOpportunities(
    { aggregates, liveRecords },
    { limit: topN }
  );

  // Wrap fetchAllNews so it conforms to the `{ok,data}` shape the
  // settledOk helper expects.
  const newsAdapter = async () => {
    try {
      return { ok: true as const, data: await fetchAllNews() };
    } catch (err) {
      return { ok: false as const, reason: 'network', detail: (err as Error).message };
    }
  };

  const empty: PromiseSettledResult<unknown> = {
    status: 'fulfilled',
    value: { ok: false, reason: 'skipped' },
  } as PromiseSettledResult<unknown>;

  const settled = opts.skipNetworkFetches
    ? [empty, empty, empty, empty, empty, empty, empty, empty, empty]
    : await Promise.allSettled([
        fetchDEUnemployment(),
        fetchDEInflation(),
        fetchECBRate(),
        fetchDEJobVacancyRate(),
        fetchDEEmploymentRate(),
        fetchDECompositeLeadingIndicator(),
        fetchDERegionalUnemployment(),
        newsAdapter(),
        fetchAdzunaPulse(),
      ]);
  const [une, inf, ecb, vac, emp, cli, regUne, newsBatch, adzuna] = settled;

  // Macro section
  const macroFor = <T extends { rate?: number; value?: number; period?: string; trend?: string }>(
    s: PromiseSettledResult<unknown>,
    pickValue: (d: T) => Partial<{ rate: number; value: number; period: string; trend: string }>
  ) => {
    const r = settledOk<T>(s as PromiseSettledResult<{ ok: true; data: T } | { ok: false; reason?: string }>);
    if (!r.ok) return { ok: false as const, reason: r.reason };
    return { ok: true as const, ...pickValue(r.data) };
  };

  const macro: IntelSnapshot['macro'] = {
    deUnemployment: macroFor(une, (d) => ({ rate: d.rate, period: d.period })),
    deInflation: macroFor(inf, (d) => ({ rate: d.rate, period: d.period })),
    ecbRate: macroFor(ecb, (d) => ({ rate: d.rate, period: d.period })),
    deJobVacancyRate: macroFor(vac, (d) => ({ rate: d.rate, period: d.period })),
    deEmploymentRate: macroFor(emp, (d) => ({ rate: d.rate, period: d.period })),
    deCompositeLeadingIndicator: (() => {
      const r = settledOk<{ value: number; period: string; trend: string }>(
        cli as PromiseSettledResult<{ ok: true; data: { value: number; period: string; trend: string } } | { ok: false; reason?: string }>
      );
      if (!r.ok) return { ok: false as const, reason: r.reason };
      return { ok: true as const, value: r.data.value, period: r.data.period, trend: r.data.trend as IntelSnapshot['macro']['deCompositeLeadingIndicator']['trend'] };
    })(),
  };

  // Regional section — overlay Eurostat per-NUTS unemployment when ok.
  const overlayLand = (() => {
    const r = settledOk<{ byNuts: Record<string, { rate: number; period: string }> }>(
      regUne as PromiseSettledResult<{ ok: true; data: { byNuts: Record<string, { rate: number; period: string }> } } | { ok: false; reason?: string }>
    );
    if (!r.ok) return null;
    return r.data.byNuts;
  })();

  const topBundeslaender = regional.bundeslaender
    .filter((b) => b.companyCount > 0 || b.signalCount > 0)
    .slice(0, 10)
    .map((b) => ({
      code: b.code,
      name: b.name,
      quadrant: b.quadrant,
      hiringRate: b.hiringRate,
      companyCount: b.companyCount,
      signalCount: b.signalCount,
      unemploymentRate: overlayLand?.[b.nuts]?.rate ?? null,
    }));

  const quadrants = regional.quadrants.map((q) => ({
    id: q.id,
    label: q.label,
    hiringRate: q.hiringRate,
    momentum30d: q.momentum30d,
    companyCount: q.companyCount,
    signalCount: q.signalCount,
    averageHiringScore: q.averageHiringScore,
  }));

  // Breaking news section
  const newsRes = settledOk<{ items: Awaited<ReturnType<typeof fetchAllNews>>['items']; feeds: unknown[] }>(
    newsBatch as PromiseSettledResult<{ ok: true; data: { items: Awaited<ReturnType<typeof fetchAllNews>>['items']; feeds: unknown[] } } | { ok: false; reason?: string }>
  );
  const news = newsRes.ok ? classifyNewsBatch(newsRes.data.items) : [];
  const breakingNews = news
    .slice(0, newsLimit)
    .map((n) => ({
      company: n.entity.canonical,
      signalType: n.signalType,
      title: n.title,
      source: n.sourceLabel,
      link: n.link,
      publishedAt: n.publishedAt,
      breaking: n.breaking,
    }));

  // Job market section (Adzuna)
  const jobMarket = (() => {
    if (adzuna.status === 'rejected') {
      return { ok: false as const, reason: 'rejected' };
    }
    const v = adzuna.value as Awaited<ReturnType<typeof fetchAdzunaPulse>>;
    if (!v.ok) {
      return { ok: false as const, reason: v.reason };
    }
    return {
      ok: true as const,
      totalPostings: v.data.totalPostings,
      byCategory: v.data.byCategory.map((c) => ({
        category: c.category,
        postings: c.postings,
        meanSalary: c.meanSalary,
      })),
      topCompaniesAcross: v.data.topCompaniesAcross,
    };
  })();

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: '1.0',
    market: {
      totalSignals: market.totalSignals,
      averageHiringScore: market.averageHiringScore,
      highProbabilityCompanies: market.highProbabilityCompanies,
      newSignals24h: market.newSignals24h,
      positiveGrowthSignals: market.positiveGrowthSignals,
      negativeRiskSignals: market.negativeRiskSignals,
    },
    macro,
    regions: { quadrants, topBundeslaender },
    sectors: sectorTrends.map((s) => ({
      sector: s.sector,
      companyCount: s.companyCount,
      signalVolume: s.signalVolume,
      averageScore: s.averageScore,
      momentum: s.momentum,
      trendDirection: s.trendDirection,
    })),
    opportunities: opps.map((o) => ({
      companyId: o.companyId,
      companyName: o.companyName,
      industry: o.industry,
      region: o.region,
      opportunityScore: o.opportunityScore,
      confidence: o.confidence,
      topSignals: o.topSignals,
      recommendedTiming: o.recommendedTiming,
      whyNow: o.whyNow,
    })),
    breakingNews,
    jobMarket,
  };
}
