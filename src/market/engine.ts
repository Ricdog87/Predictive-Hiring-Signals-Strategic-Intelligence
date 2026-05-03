import { CompanyAggregate, CompanyProfile, CompanySignal } from '../../lib/types';
import { UNKNOWN_REGION, UNKNOWN_SECTOR } from '../companyMaster/master';
import { MarketCluster, MarketOverview, RegionTrend, SectorTrend } from './types';

const round2 = (v: number) => Math.round(v * 100) / 100;
const trend = (v: number) => (v > 0.1 ? 'up' : v < -0.1 ? 'down' : 'flat');
const sectorOf = (c: CompanyProfile) => c.industry || UNKNOWN_SECTOR;
const regionOf = (c: CompanyProfile) => c.headquarters || UNKNOWN_REGION;

export function computeMarketOverview(companies: CompanyProfile[], signals: CompanySignal[], aggregates: CompanyAggregate[]): MarketOverview {
  const scores = aggregates.map((a) => a.latestScore?.hiringScore ?? 0);
  const windows = aggregates.map((a) => a.latestPrediction?.expectedHiringWindowDays ?? 0).filter((x) => x > 0);
  const now = Date.now();
  const within24h = signals.filter((s) => now - new Date(s.observedAt).getTime() <= 86400000).length;
  const sectorVolume = topCounts(companies.map(sectorOf));
  const regionVolume = topCounts(companies.map(regionOf));
  return {
    totalSignals: signals.length,
    highProbabilityCompanies: aggregates.filter((a) => (a.latestPrediction?.hiringProbability ?? 0) >= 0.7).length,
    averageHiringScore: round2(avg(scores)),
    averageHiringWindowDays: round2(avg(windows)),
    newSignals24h: within24h,
    hottestSectors: sectorVolume.slice(0, 3).map((x) => x.key),
    hottestRegions: regionVolume.slice(0, 3).map((x) => x.key),
    negativeRiskSignals: signals.filter((s) => s.impact < 0).length,
    positiveGrowthSignals: signals.filter((s) => s.impact > 0).length,
  };
}

export function computeSectorTrends(companies: CompanyProfile[], signals: CompanySignal[], aggregates: CompanyAggregate[]): SectorTrend[] {
  const bySector = groupBy(companies, sectorOf);
  return Object.entries(bySector).map(([sector, cs]) => {
    const ids = new Set(cs.map((c) => c.id));
    const ss = signals.filter((s) => ids.has(s.companyId));
    const as = aggregates.filter((a) => ids.has(a.company.id));
    const momentum = round2(avg(ss.map((s) => s.impact * s.confidence)) / 20);
    return {
      sector,
      companyCount: cs.length,
      signalVolume: ss.length,
      averageScore: round2(avg(as.map((a) => a.latestScore?.hiringScore ?? 0))),
      strongestSignalTypes: topCounts(ss.map((s) => s.signalType)).slice(0, 3).map((x) => x.key),
      trendDirection: trend(momentum),
      confidence: round2(avg(ss.map((s) => s.confidence))),
      momentum,
    };
  });
}

export function computeRegionTrends(companies: CompanyProfile[], signals: CompanySignal[], aggregates: CompanyAggregate[]): RegionTrend[] {
  const byRegion = groupBy(companies, regionOf);
  return Object.entries(byRegion).map(([region, cs]) => {
    const ids = new Set(cs.map((c) => c.id));
    const ss = signals.filter((s) => ids.has(s.companyId));
    const as = aggregates.filter((a) => ids.has(a.company.id));
    const hottestSectors = topCounts(cs.map(sectorOf)).slice(0, 3).map((x) => x.key);
    const moment = avg(ss.map((s) => s.impact * s.confidence)) / 20;
    return {
      region,
      companyCount: cs.length,
      signalVolume: ss.length,
      averageScore: round2(avg(as.map((a) => a.latestScore?.hiringScore ?? 0))),
      hottestSectors,
      trendDirection: trend(moment),
      confidence: round2(avg(ss.map((s) => s.confidence))),
    };
  });
}

export function computeMarketClusters(companies: CompanyProfile[], signals: CompanySignal[], aggregates: CompanyAggregate[]): MarketCluster[] {
  const keyMap = new Map<string, CompanyProfile[]>();
  for (const c of companies) {
    const key = `${sectorOf(c)}|${regionOf(c)}`;
    keyMap.set(key, [...(keyMap.get(key) ?? []), c]);
  }
  return [...keyMap.entries()].map(([key, cs]) => {
    const [sector = UNKNOWN_SECTOR, region = UNKNOWN_REGION] = key.split('|');
    const ids = new Set(cs.map((c) => c.id));
    const ss = signals.filter((s) => ids.has(s.companyId));
    const score = round2(avg(aggregates.filter((a) => ids.has(a.company.id)).map((a) => a.latestScore?.hiringScore ?? 0)));
    const momentum = round2(avg(ss.map((s) => s.impact * s.confidence)) / 20);
    return {
      sector,
      region,
      companyCount: cs.length,
      averageHiringScore: score,
      dominantSignals: topCounts(ss.map((s) => s.signalType)).slice(0, 3).map((x) => x.key),
      momentum,
      riskLevel: round2(Math.max(0, avg(ss.filter((s) => s.impact < 0).map((s) => Math.abs(s.impact))))),
      opportunityLevel: round2(Math.max(0, avg(ss.filter((s) => s.impact > 0).map((s) => s.impact)))),
    };
  });
}

function avg(values: number[]): number { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function groupBy<T>(arr: T[], fn: (x: T) => string): Record<string, T[]> { return arr.reduce<Record<string, T[]>>((a, x) => ((a[fn(x)] = [...(a[fn(x)] ?? []), x]), a), {}); }
function topCounts(values: string[]): Array<{ key: string; count: number }> {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}
