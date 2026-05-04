import { listIngest } from '../../../../lib/ingestStore';
import {
  listSourceTrustEntries,
  sourceTrustLabel,
  sourceTrustScore,
} from '../../../../lib/sourceTrust';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MS_PER_HOUR = 3_600_000;

interface SourceHealth {
  source: string;
  label: string;
  trust: number;
  signals: number;
  signals24h: number;
  signals7d: number;
  uniqueCompanies: number;
  avgImpact: number;
  avgConfidence: number;
  lastSeenAt: string | null;
  lastSeenAgoMin: number | null;
  status: 'live' | 'stale' | 'silent';
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export async function GET() {
  const records = await listIngest(2000);
  const now = Date.now();
  const hour = MS_PER_HOUR;

  const buckets = new Map<string, SourceHealth>();

  for (const rec of records) {
    const source = rec.source || 'external';
    const observedAtMs = new Date(rec.observedAt).getTime();
    const ageHours = Number.isFinite(observedAtMs)
      ? Math.max(0, (now - observedAtMs) / hour)
      : Infinity;

    let entry = buckets.get(source);
    if (!entry) {
      entry = {
        source,
        label: sourceTrustLabel(source),
        trust: sourceTrustScore(source),
        signals: 0,
        signals24h: 0,
        signals7d: 0,
        uniqueCompanies: 0,
        avgImpact: 0,
        avgConfidence: 0,
        lastSeenAt: null,
        lastSeenAgoMin: null,
        status: 'silent',
      };
      buckets.set(source, entry);
    }
    entry.signals += 1;
    if (ageHours <= 24) entry.signals24h += 1;
    if (ageHours <= 24 * 7) entry.signals7d += 1;
    entry.avgImpact += rec.impact;
    entry.avgConfidence += rec.confidence;
    if (
      !entry.lastSeenAt ||
      new Date(rec.observedAt).getTime() > new Date(entry.lastSeenAt).getTime()
    ) {
      entry.lastSeenAt = rec.observedAt;
    }
  }

  // Pass two — finalize averages, status, unique-companies count.
  const seenCompanies = new Map<string, Set<string>>();
  for (const rec of records) {
    const source = rec.source || 'external';
    const set = seenCompanies.get(source) ?? new Set<string>();
    set.add(rec.companyName.toLowerCase());
    seenCompanies.set(source, set);
  }

  const data: SourceHealth[] = [];
  buckets.forEach((entry) => {
    if (entry.signals > 0) {
      entry.avgImpact = round2(entry.avgImpact / entry.signals);
      entry.avgConfidence = round2(entry.avgConfidence / entry.signals);
    }
    entry.uniqueCompanies = seenCompanies.get(entry.source)?.size ?? 0;
    if (entry.lastSeenAt) {
      const ageMin = Math.max(
        0,
        Math.round((now - new Date(entry.lastSeenAt).getTime()) / 60_000)
      );
      entry.lastSeenAgoMin = ageMin;
      entry.status = ageMin <= 24 * 60 ? 'live' : ageMin <= 7 * 24 * 60 ? 'stale' : 'silent';
    }
    data.push(entry);
  });

  // Surface known sources from the trust catalogue too, even if they
  // haven't fired yet — this is the "expected vs observed" view.
  const knownSources = new Set(data.map((d) => d.source));
  for (const entry of listSourceTrustEntries()) {
    if (knownSources.has(entry.source)) continue;
    data.push({
      source: entry.source,
      label: entry.label,
      trust: entry.trust,
      signals: 0,
      signals24h: 0,
      signals7d: 0,
      uniqueCompanies: 0,
      avgImpact: 0,
      avgConfidence: 0,
      lastSeenAt: null,
      lastSeenAgoMin: null,
      status: 'silent',
    });
  }

  data.sort((a, b) => {
    if (b.signals !== a.signals) return b.signals - a.signals;
    return b.trust - a.trust;
  });

  const totals = data.reduce(
    (acc, s) => {
      acc.signals += s.signals;
      acc.signals24h += s.signals24h;
      acc.live += s.status === 'live' ? 1 : 0;
      acc.stale += s.status === 'stale' ? 1 : 0;
      acc.silent += s.status === 'silent' ? 1 : 0;
      return acc;
    },
    { signals: 0, signals24h: 0, live: 0, stale: 0, silent: 0 }
  );

  return Response.json({
    data,
    totals,
    sourceCount: data.length,
    generatedAt: new Date().toISOString(),
  });
}
