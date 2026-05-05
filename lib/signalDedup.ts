/**
 * Signal dedup engine v1.
 *
 * Live ingest fans the same news event in from multiple feeds. The dedup
 * engine collapses functionally-identical signals into a single Master
 * Signal and exposes the merge audit (`mergedSources`, `duplicateCount`,
 * `dedupKey`) so downstream surfaces can show "+3 duplicates" rather
 * than re-counting the same event.
 *
 * Dedup criteria (all must hold):
 *   - same canonical company
 *   - same signal type
 *   - observedAt within a 14-day window
 *   - title token-Jaccard similarity >= 0.6
 *
 * Within a duplicate cluster:
 *   - winner = max(confidence)        (primary)
 *   - tiebreaker = max(observedAt)    (secondary, newer wins)
 *   - tiebreaker = max(receivedAt)    (tertiary, ingestion order)
 */

import type { IngestRecord } from './ingestStore';
import type { HiringSignalType } from './types';

const WINDOW_DAYS = 14;
const TITLE_SIM_THRESHOLD = 0.6;

export interface DedupedSignal {
  id: string;
  companyName: string;
  signalType: HiringSignalType;
  source: string;
  title: string;
  description: string;
  impact: number;
  confidence: number;
  observedAt: string;
  receivedAt: string;
  metadata: Record<string, unknown>;
  /** Stable dedup bucket id (`company:type:windowStart`) */
  dedupKey: string;
  /** Number of records that collapsed into this master (1 = no duplicate). */
  duplicateCount: number;
  /** Distinct sources that observed the same event. */
  mergedSources: string[];
  /** Highest observedAt across the cluster — useful for freshness scoring. */
  latestObservedAt: string;
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'with',
  'by', 'at', 'der', 'die', 'das', 'und', 'oder', 'ein', 'eine', 'in',
  'im', 'für', 'mit', 'von', 'zu', 'bei', 'auf', 'des', 'dem',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüß ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter++;
  });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function dayBucket(iso: string, windowDays = WINDOW_DAYS): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor(t / (windowDays * 86_400_000));
}

function canonicalCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(gmbh|ag|se|kg|inc|llc|ltd|co|corp|corporation)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDedupKey(rec: Pick<IngestRecord, 'companyName' | 'signalType' | 'observedAt'>): string {
  return `${canonicalCompany(rec.companyName)}|${rec.signalType}|${dayBucket(rec.observedAt)}`;
}

interface Cluster {
  master: IngestRecord;
  members: IngestRecord[];
  masterTokens: string[];
}

function pickMaster(a: IngestRecord, b: IngestRecord): IngestRecord {
  if (a.confidence !== b.confidence) return a.confidence > b.confidence ? a : b;
  const ao = new Date(a.observedAt).getTime();
  const bo = new Date(b.observedAt).getTime();
  if (ao !== bo) return ao > bo ? a : b;
  const ar = new Date(a.receivedAt).getTime();
  const br = new Date(b.receivedAt).getTime();
  return ar >= br ? a : b;
}

export function dedupKeyOf(rec: Pick<IngestRecord, 'companyName' | 'signalType' | 'observedAt'>): string {
  return buildDedupKey(rec);
}

export function dedupeSignals(records: IngestRecord[]): DedupedSignal[] {
  // Index by (canonicalCompany|signalType|window). Within a bucket, walk
  // members and merge by title similarity into clusters.
  const buckets = new Map<string, Cluster[]>();

  for (const rec of records) {
    const key = buildDedupKey(rec);
    const tokens = tokenize(rec.title || '');
    const list = buckets.get(key) ?? [];
    let merged = false;
    for (const cluster of list) {
      const sim = jaccard(tokens, cluster.masterTokens);
      if (sim >= TITLE_SIM_THRESHOLD) {
        cluster.members.push(rec);
        const newMaster = pickMaster(cluster.master, rec);
        if (newMaster !== cluster.master) {
          cluster.master = newMaster;
          cluster.masterTokens = tokenize(newMaster.title || '');
        }
        merged = true;
        break;
      }
    }
    if (!merged) {
      list.push({ master: rec, members: [rec], masterTokens: tokens });
      buckets.set(key, list);
    }
  }

  const out: DedupedSignal[] = [];
  buckets.forEach((clusters, key) => {
    for (const cluster of clusters) {
      const sources = Array.from(
        new Set(cluster.members.map((m) => m.source).filter(Boolean))
      );
      const latestObservedAt = cluster.members.reduce<string>((acc, m) => {
        const a = new Date(acc).getTime();
        const b = new Date(m.observedAt).getTime();
        return b > a ? m.observedAt : acc;
      }, cluster.master.observedAt);
      out.push({
        ...cluster.master,
        dedupKey: key,
        duplicateCount: cluster.members.length,
        mergedSources: sources,
        latestObservedAt,
      });
    }
  });

  return out.sort((a, b) => {
    const av = new Date(a.latestObservedAt).getTime();
    const bv = new Date(b.latestObservedAt).getTime();
    return bv - av;
  });
}

/** Quick stats helper for monitoring surfaces. */
export interface DedupStats {
  totalRecords: number;
  uniqueClusters: number;
  duplicatesMerged: number;
  dedupRate: number; // 0..1
}

export function dedupStats(records: IngestRecord[]): DedupStats {
  const deduped = dedupeSignals(records);
  const total = records.length;
  const merged = total - deduped.length;
  return {
    totalRecords: total,
    uniqueClusters: deduped.length,
    duplicatesMerged: merged,
    dedupRate: total === 0 ? 0 : Math.round((merged / total) * 1000) / 1000,
  };
}
