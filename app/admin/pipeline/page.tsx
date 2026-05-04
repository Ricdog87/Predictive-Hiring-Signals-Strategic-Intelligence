"use client";

import { useEffect, useMemo, useState } from "react";
import type { IngestRecord } from "@/lib/ingestStore";
import type { DedupedSignal, DedupStats } from "@/lib/signalDedup";

interface RecentResp {
  data: IngestRecord[];
  count: number;
  store: 'kv' | 'memory';
  generatedAt: string;
}

interface DedupedResp {
  data: DedupedSignal[];
  stats: DedupStats;
  count: number;
  rawCount: number;
  generatedAt: string;
}

interface SourceHealthRow {
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

interface SourcesResp {
  data: SourceHealthRow[];
  totals: { signals: number; signals24h: number; live: number; stale: number; silent: number };
  sourceCount: number;
  generatedAt: string;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export default function AdminPipelinePage() {
  const [recent, setRecent] = useState<RecentResp | null>(null);
  const [deduped, setDeduped] = useState<DedupedResp | null>(null);
  const [sources, setSources] = useState<SourcesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [r, d, s] = await Promise.all([
          getJson<RecentResp>('/api/ingest/recent?limit=200'),
          getJson<DedupedResp>('/api/signals/deduped?limit=500'),
          getJson<SourcesResp>('/api/sources/health'),
        ]);
        if (cancelled) return;
        setRecent(r);
        setDeduped(d);
        setSources(s);
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const lastIngestAt = recent?.data?.[0]?.receivedAt ?? null;
  const ingestStore = recent?.store ?? 'memory';
  const today = useMemo(() => {
    if (!recent) return 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return recent.data.filter(
      (r) => new Date(r.receivedAt).getTime() >= cutoff
    ).length;
  }, [recent]);

  const topSignalTypes = useMemo(() => {
    if (!deduped) return [] as Array<{ type: string; count: number }>;
    const m = new Map<string, number>();
    for (const d of deduped.data) {
      m.set(d.signalType, (m.get(d.signalType) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [deduped]);

  const failedFetches = useMemo(() => {
    // "failed" here means: a record whose metadata flags a non-2xx
    // response. We don't currently emit that, but the panel reads
    // `metadata.responseCode` if the upstream pipeline ever does.
    if (!recent) return 0;
    return recent.data.filter((r) => {
      const code = r.metadata?.responseCode;
      return typeof code === 'number' && (code < 200 || code >= 300);
    }).length;
  }, [recent]);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <div className="border-b border-bg-border bg-bg-surface px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="label-eyebrow flex items-center gap-2">
              <span>Admin · Pipeline Monitoring</span>
              <span className="text-text-faint">/</span>
              <span className="text-accent-cyan">v2</span>
            </div>
            <h1 className="mt-1 text-[18px] font-semibold tracking-tight">
              Hiring Signals Intelligence Pipeline
            </h1>
            <p className="mt-0.5 font-mono text-2xs uppercase tracking-terminal text-text-muted">
              read-only · live store: {ingestStore}
            </p>
          </div>
          <button
            onClick={() => setRefreshTick((x) => x + 1)}
            className="rounded-sm border border-bg-border bg-bg-panel px-3 py-1.5 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:text-text-primary"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-5 my-4 rounded-sm border border-accent-red/40 bg-accent-red/[0.06] px-3 py-2 font-mono text-[11px] text-accent-red">
          api error · {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-px border-b border-bg-border bg-bg-border md:grid-cols-3 xl:grid-cols-6">
        <Cell
          label="Last ingest"
          value={lastIngestAt ? formatRelative(lastIngestAt) : '—'}
          hint={lastIngestAt ?? 'no records yet'}
          tone="cyan"
        />
        <Cell
          label="Signals · 24h"
          value={today.toString()}
          hint="based on receivedAt"
          tone="green"
        />
        <Cell
          label="Total raw"
          value={(deduped?.stats.totalRecords ?? 0).toString()}
          hint="last 500 records"
        />
        <Cell
          label="Duplicates merged"
          value={(deduped?.stats.duplicatesMerged ?? 0).toString()}
          hint={`dedup rate ${Math.round((deduped?.stats.dedupRate ?? 0) * 100)}%`}
          tone="violet"
        />
        <Cell
          label="Sources tracked"
          value={(sources?.sourceCount ?? 0).toString()}
          hint={`${sources?.totals.live ?? 0} live · ${sources?.totals.stale ?? 0} stale`}
        />
        <Cell
          label="Failed fetches"
          value={failedFetches.toString()}
          hint="from metadata.responseCode"
          tone={failedFetches > 0 ? 'red' : undefined}
        />
      </div>

      <main className="px-5 py-5 space-y-6">
        {loading && !recent && (
          <div className="rounded-sm border border-bg-border bg-bg-panel p-6 font-mono text-2xs uppercase tracking-terminal text-text-muted">
            loading pipeline state…
          </div>
        )}

        <Panel title="Source Health" subtitle={`GET /api/sources/health · ${sources?.sourceCount ?? 0} sources`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-bg-border bg-bg-surface/40 text-left">
                  <Th>Source</Th>
                  <Th align="right">Trust</Th>
                  <Th align="right">Signals</Th>
                  <Th align="right">24h</Th>
                  <Th align="right">7d</Th>
                  <Th align="right">Companies</Th>
                  <Th align="right">Avg conf.</Th>
                  <Th>Last seen</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {(sources?.data ?? []).map((s) => (
                  <tr
                    key={s.source}
                    className="border-b border-bg-line/50 hover:bg-bg-elevated/40"
                  >
                    <td className="px-3 py-2 align-middle">
                      <div className="font-medium text-text-primary">{s.label}</div>
                      <div className="font-mono text-2xs text-text-muted">{s.source}</div>
                    </td>
                    <td className="num px-3 py-2 text-right align-middle">
                      <TrustBar value={s.trust} />
                    </td>
                    <td className="num px-3 py-2 text-right align-middle">{s.signals}</td>
                    <td className="num px-3 py-2 text-right align-middle">{s.signals24h}</td>
                    <td className="num px-3 py-2 text-right align-middle">{s.signals7d}</td>
                    <td className="num px-3 py-2 text-right align-middle">{s.uniqueCompanies}</td>
                    <td className="num px-3 py-2 text-right align-middle">
                      {s.avgConfidence.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 align-middle font-mono text-2xs text-text-muted">
                      {s.lastSeenAt ? formatRelative(s.lastSeenAt) : '—'}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <StatusChip status={s.status} />
                    </td>
                  </tr>
                ))}
                {(sources?.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center font-mono text-2xs uppercase tracking-terminal text-text-muted">
                      no sources tracked yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Top signal types · last 500 records (deduped)" subtitle="GET /api/signals/deduped">
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 xl:grid-cols-8">
            {topSignalTypes.length === 0 ? (
              <div className="col-span-full font-mono text-2xs uppercase tracking-terminal text-text-muted">
                no deduped signals yet
              </div>
            ) : (
              topSignalTypes.map((row) => (
                <div
                  key={row.type}
                  className="rounded-sm border border-bg-border bg-bg-surface px-3 py-2"
                >
                  <div className="label-eyebrow truncate">{row.type}</div>
                  <div className="num mt-1 text-[18px] font-semibold text-accent-cyan">
                    {row.count}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Recent ingests" subtitle="GET /api/ingest/recent?limit=200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-bg-border bg-bg-surface/40 text-left">
                  <Th>Received</Th>
                  <Th>Company</Th>
                  <Th>Signal</Th>
                  <Th>Source</Th>
                  <Th align="right">Impact</Th>
                  <Th align="right">Confidence</Th>
                  <Th>Title</Th>
                </tr>
              </thead>
              <tbody>
                {(recent?.data ?? []).slice(0, 50).map((r) => (
                  <tr key={r.id} className="border-b border-bg-line/50 hover:bg-bg-elevated/40">
                    <td className="px-3 py-2 align-middle font-mono text-2xs text-text-muted">
                      {formatRelative(r.receivedAt)}
                    </td>
                    <td className="px-3 py-2 align-middle text-text-primary">{r.companyName}</td>
                    <td className="px-3 py-2 align-middle font-mono text-[11px] text-accent-cyan">
                      {r.signalType}
                    </td>
                    <td className="px-3 py-2 align-middle font-mono text-2xs text-text-muted">
                      {r.source}
                    </td>
                    <td className={`num px-3 py-2 text-right align-middle ${r.impact >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {r.impact >= 0 ? `+${r.impact}` : r.impact}
                    </td>
                    <td className="num px-3 py-2 text-right align-middle">{r.confidence.toFixed(2)}</td>
                    <td className="px-3 py-2 align-middle text-text-secondary">
                      <div className="line-clamp-1 max-w-[420px]">{r.title}</div>
                    </td>
                  </tr>
                ))}
                {(recent?.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center font-mono text-2xs uppercase tracking-terminal text-text-muted">
                      no ingest records yet — POST to /api/ingest
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-bg-border bg-bg-panel">
      <header className="flex items-center justify-between border-b border-bg-border px-4 py-2.5">
        <div>
          <div className="text-[13px] font-semibold text-text-primary">{title}</div>
          {subtitle && (
            <div className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
              {subtitle}
            </div>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

function Cell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'cyan' | 'green' | 'violet' | 'red';
}) {
  const fg =
    tone === 'cyan'
      ? 'text-accent-cyan'
      : tone === 'green'
      ? 'text-accent-green'
      : tone === 'violet'
      ? 'text-accent-violet'
      : tone === 'red'
      ? 'text-accent-red'
      : 'text-text-primary';
  return (
    <div className="bg-bg-panel px-4 py-3">
      <div className="label-eyebrow truncate">{label}</div>
      <div className={`num mt-1 text-[18px] font-semibold ${fg}`}>{value}</div>
      {hint && (
        <div className="mt-0.5 font-mono text-2xs uppercase tracking-terminal text-text-muted">
          {hint}
        </div>
      )}
    </div>
  );
}

function TrustBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 85 ? 'bg-accent-green' : pct >= 65 ? 'bg-accent-cyan' : 'bg-accent-amber';
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="num text-[12px] text-text-primary">{value.toFixed(2)}</span>
    </div>
  );
}

function StatusChip({ status }: { status: 'live' | 'stale' | 'silent' }) {
  const cls =
    status === 'live'
      ? 'bg-accent-green/10 text-accent-green ring-accent-green/30'
      : status === 'stale'
      ? 'bg-accent-amber/10 text-accent-amber ring-accent-amber/30'
      : 'bg-bg-elevated text-text-muted ring-bg-rule';
  return (
    <span className={`chip uppercase ${cls}`}>{status}</span>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`label-eyebrow px-3 py-2.5 font-medium ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diffSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 48) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return `${diffD}d ago`;
}
