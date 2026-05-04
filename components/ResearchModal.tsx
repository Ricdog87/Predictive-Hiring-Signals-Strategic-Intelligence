"use client";

import { useEffect, useState } from "react";
import type { CompanyResearch } from "@/lib/hermesClient";

interface ResearchResp {
  ok: boolean;
  fellBack?: boolean;
  reason?: string;
  research?: CompanyResearch;
  citations?: string[];
  model?: string;
}

interface ResearchModalProps {
  query: string | null;
  onClose: () => void;
}

const POSTURE_TONE: Record<string, { fg: string; ring: string; bg: string; label: string }> = {
  expanding:     { fg: "text-accent-green",  ring: "ring-accent-green/40",  bg: "bg-accent-green/10",  label: "Expanding"     },
  exploring:     { fg: "text-accent-cyan",   ring: "ring-accent-cyan/40",   bg: "bg-accent-cyan/10",   label: "Exploring"     },
  consolidating: { fg: "text-accent-amber",  ring: "ring-accent-amber/40",  bg: "bg-accent-amber/10",  label: "Consolidating" },
  contracting:   { fg: "text-accent-red",    ring: "ring-accent-red/40",    bg: "bg-accent-red/10",    label: "Contracting"   },
  unknown:       { fg: "text-text-muted",    ring: "ring-bg-rule",          bg: "bg-bg-elevated",      label: "Unknown"       },
};

export function ResearchModal({ query, onClose }: ResearchModalProps) {
  const [data, setData] = useState<ResearchResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/hermes/research-company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, locale: 'de' }),
        });
        const json = (await res.json()) as ResearchResp;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Esc to close
  useEffect(() => {
    if (!query) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [query, onClose]);

  if (!query) return null;

  const research = data?.research;
  const posture = research
    ? POSTURE_TONE[research.hiringPosture] ?? POSTURE_TONE.unknown
    : POSTURE_TONE.unknown;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[10vh] palette-backdrop animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[760px] rounded-md border border-bg-border bg-bg-panel shadow-glow animate-slide-down overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-bg-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-accent-violet">✦</span>
            <span className="font-mono text-2xs uppercase tracking-terminal text-accent-violet font-semibold">
              Live research
            </span>
            <span className="text-text-faint">·</span>
            <span className="text-[14px] font-semibold text-text-primary">
              {research?.canonical ?? query}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="kbd"
            title="Close (esc)"
          >
            esc
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto">
          {!data && !error && (
            <div className="px-5 py-8 text-center font-mono text-2xs uppercase tracking-terminal text-text-muted">
              ▸ Sonar (Perplexity) recherchiert live im Web · 5–15 s …
            </div>
          )}

          {error && (
            <div className="m-5 rounded-sm border border-accent-red/40 bg-accent-red/[0.06] px-3 py-2 font-mono text-[12px] text-accent-red">
              api error · {error}
            </div>
          )}

          {data && !data.ok && (
            <div className="m-5 rounded-sm border border-accent-amber/40 bg-accent-amber/[0.06] px-3 py-3 text-[12.5px]">
              <div className="font-mono text-2xs uppercase tracking-terminal text-accent-amber font-semibold">
                Live research nicht verfügbar
              </div>
              <div className="mt-1 text-text-secondary">
                {data.reason === 'unconfigured'
                  ? 'Hermes (Live-Tier) ist auf der Radar-Seite noch nicht konfiguriert. Sobald HERMES_BASE_URL gesetzt ist, läuft die Sonar-Recherche live.'
                  : `Reason: ${data.reason ?? 'unknown'}`}
              </div>
            </div>
          )}

          {research && (
            <div className="px-5 py-4">
              {/* meta */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`chip ${posture.fg} ${posture.ring} ${posture.bg}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${posture.fg.replace('text-', 'bg-')}`} />
                  {posture.label}
                </span>
                <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
                  {research.industry}
                </span>
                <span className="text-text-faint">·</span>
                <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
                  {research.headquarters}
                </span>
                {research.employeeCount != null && (
                  <>
                    <span className="text-text-faint">·</span>
                    <span className="font-mono text-2xs uppercase tracking-terminal text-text-secondary">
                      {research.employeeCount.toLocaleString('de-DE')} MA
                    </span>
                  </>
                )}
                <span className="ml-auto font-mono text-2xs uppercase tracking-terminal text-text-muted">
                  conf · {Math.round((research.confidence ?? 0) * 100)}%
                </span>
              </div>

              <p className="text-[13.5px] leading-relaxed text-text-secondary">
                {research.summary}
              </p>

              {research.whyNow && (
                <div className="mt-3 rounded-sm border border-accent-violet/30 bg-accent-violet/[0.04] p-3">
                  <div className="label-eyebrow text-accent-violet mb-1">Why now</div>
                  <div className="text-[13px] text-text-primary">{research.whyNow}</div>
                </div>
              )}

              {research.recentSignals && research.recentSignals.length > 0 && (
                <div className="mt-4">
                  <div className="label-eyebrow mb-1.5">Recent signals (live)</div>
                  <ul className="divide-y divide-bg-line/50 rounded-sm border border-bg-border">
                    {research.recentSignals.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 px-3 py-2 hover:bg-bg-elevated/40">
                        <span className="font-mono text-2xs uppercase tracking-terminal text-accent-cyan whitespace-nowrap">
                          {s.type}
                        </span>
                        <div className="min-w-0 flex-1">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-[12.5px] text-text-primary hover:text-accent-cyan"
                          >
                            {s.title}
                          </a>
                          <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                            {s.date} · {s.source}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {research.rolesLikely && research.rolesLikely.length > 0 && (
                <div className="mt-4">
                  <div className="label-eyebrow mb-1.5">Roles likely (next 90 days)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {research.rolesLikely.map((r) => (
                      <span
                        key={r}
                        className="chip ring-accent-cyan/30 text-accent-cyan bg-accent-cyan/10"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {research.risks && research.risks.length > 0 && (
                <div className="mt-3">
                  <div className="label-eyebrow text-accent-amber mb-1.5">Risks</div>
                  <ul className="space-y-1 text-[12.5px] text-text-secondary">
                    {research.risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-accent-amber mt-0.5">▸</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* citations */}
              {data?.citations && data.citations.length > 0 && (
                <div className="mt-4 border-t border-bg-border pt-3">
                  <div className="label-eyebrow mb-1.5">Sources</div>
                  <div className="flex flex-wrap gap-2 font-mono text-2xs uppercase tracking-terminal">
                    {data.citations.map((c, i) => (
                      <a
                        key={i}
                        href={c}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-cyan hover:text-text-primary"
                      >
                        [{i + 1}] {(() => { try { return new URL(c).host.replace(/^www\./, ''); } catch { return c.slice(0, 30); } })()}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-bg-border bg-bg-surface px-5 py-2 font-mono text-2xs uppercase tracking-terminal text-text-muted">
          {data?.model && <>model · {data.model}</>}
          {data?.model && <span className="mx-2 text-text-faint">·</span>}
          <span>esc · close</span>
        </div>
      </div>
    </div>
  );
}
