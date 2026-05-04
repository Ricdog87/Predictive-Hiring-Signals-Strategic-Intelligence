"use client";

import { useEffect, useState } from "react";
import type { CompanyView, ForecastBand } from "@/lib/marketView";
import type { CompanyForecast } from "@/lib/hiringForecast";
import { forecastStyles } from "@/lib/format";
import { signalTypeShortLabel } from "@/lib/marketIntelligence";
import { PanelEmpty } from "./EmptyStates";

interface ForecastPanelProps {
  company: CompanyView | null;
}

export function ForecastPanel({ company }: ForecastPanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Forecast · Predicted Role Clusters</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            RSG Engine · forecast band · role clusters
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          Read-only intelligence
        </span>
      </div>

      {!company ? (
        <PanelEmpty
          title="No company selected"
          hint="Pick a row in the radar to see the forecast band and predicted role clusters."
        />
      ) : (
        <ForecastContent company={company} />
      )}
    </div>
  );
}

function ForecastContent({ company }: { company: CompanyView }) {
  const f = forecastStyles[company.forecastBand];
  const clusters = company.expectedRoleClusters;
  const totalRoles =
    clusters.length > 0
      ? Math.max(8, Math.round((company.hiringProbability / 100) * 24))
      : 0;
  const palette = ["#0E6B85", "#6D4FC4", "#3A8841", "#B07C12", "#1F7E96"];
  const forward = useForwardForecast(company.id);
  const shares = clusters.length === 0
    ? []
    : clusters.map((_, i) => 1 / clusters.length + ((i % 2 === 0 ? 0.05 : -0.05) / clusters.length));

  return (
    <div className="grid grid-cols-1 gap-px bg-bg-border lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="bg-bg-panel p-5">
        <div className="label-eyebrow mb-2">Forecast Window</div>
        <div className="flex items-baseline gap-2">
          <span className="num text-3xl font-semibold text-text-primary">
            {company.expectedHiringWindowDays}
          </span>
          <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
            days
          </span>
        </div>
        <div className="mt-2">
          <span className={`chip ${f.text} ${f.ring} bg-bg-surface/60`}>
            <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
            {f.label}
          </span>
        </div>

        <BandTimeline window={company.expectedHiringWindowDays} band={company.forecastBand} />

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-bg-border bg-bg-border">
          <Cell label="Hiring Prob." value={`${company.hiringProbability}%`} tone="cyan" />
          <Cell
            label="Confidence"
            value={Math.round(company.confidenceScore).toString()}
            tone={
              company.confidenceTier === "high"
                ? "green"
                : company.confidenceTier === "medium"
                ? "cyan"
                : "amber"
            }
          />
          <Cell
            label="Hiring Score"
            value={Math.round(company.hiringScore).toString()}
            tone="cyan"
          />
          <Cell label="Signals" value={company.signals.length.toString()} />
        </div>

        {company.isNegativeFlagged && (
          <div className="mt-4 rounded-sm border border-accent-red/30 bg-accent-red/[0.06] p-2.5">
            <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-accent-red">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-red animate-pulse-soft" />
              Restructuring risk
            </div>
            <div className="mt-1 text-[11.5px] text-text-secondary">
              Negative signals detected: insolvency, restructuring or M&amp;A target
              event. Forecast may not represent net hiring.
            </div>
          </div>
        )}
      </div>

      <div className="bg-bg-panel p-5">
        <div className="flex items-center justify-between">
          <div className="label-eyebrow">Predicted Role Clusters</div>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            RSG Engine · predicted
          </span>
        </div>

        {clusters.length === 0 ? (
          <div className="mt-4 font-mono text-2xs uppercase tracking-wider text-text-muted">
            no role clusters predicted
          </div>
        ) : (
          <>
            <div className="mt-3">
              <div className="flex h-3 overflow-hidden rounded-sm ring-1 ring-bg-border">
                {clusters.map((c, i) => (
                  <div
                    key={c}
                    style={{
                      width: `${shares[i] * 100}%`,
                      backgroundColor: palette[i % palette.length],
                      opacity: 0.85,
                    }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-2xs uppercase tracking-wider text-text-secondary">
                {clusters.map((c, i) => (
                  <span key={c} className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: palette[i % palette.length] }}
                    />
                    <span>{c}</span>
                    <span className="text-text-muted">
                      {Math.round(shares[i] * 100)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {clusters.map((label, i) => {
                const count = Math.max(1, Math.round(shares[i] * totalRoles));
                return (
                  <div
                    key={label}
                    className="rounded-sm border border-bg-border bg-bg-surface/60 p-3"
                  >
                    <div className="label-eyebrow">{label}</div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="num text-lg font-semibold text-text-primary">
                        {count}
                      </span>
                      <span className="font-mono text-2xs text-text-muted">
                        roles
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
                      {Math.round(shares[i] * 100)}% of forecast
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <ForwardForecast forecast={forward} />
      </div>
    </div>
  );
}

function useForwardForecast(companyId: string): CompanyForecast | null {
  const [data, setData] = useState<CompanyForecast | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/forecast/company/${encodeURIComponent(companyId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const j = (await res.json()) as { ok: boolean; forecast?: CompanyForecast };
        if (!cancelled && j.ok && j.forecast) {
          setData(j.forecast);
        }
      } catch {
        // silent — Forward Forecast is supplementary
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);
  return data;
}

const POSTURE_TONE: Record<string, { fg: string; ring: string; bg: string; label: string }> = {
  expanding:     { fg: "text-accent-green",  ring: "ring-accent-green/40",  bg: "bg-accent-green/10",  label: "Expanding"     },
  exploring:     { fg: "text-accent-cyan",   ring: "ring-accent-cyan/40",   bg: "bg-accent-cyan/10",   label: "Exploring"     },
  consolidating: { fg: "text-accent-amber",  ring: "ring-accent-amber/40",  bg: "bg-accent-amber/10",  label: "Consolidating" },
  contracting:   { fg: "text-accent-red",    ring: "ring-accent-red/40",    bg: "bg-accent-red/10",    label: "Contracting"   },
  unknown:       { fg: "text-text-muted",    ring: "ring-bg-rule",          bg: "bg-bg-elevated",      label: "—"             },
};

function ForwardForecast({ forecast }: { forecast: CompanyForecast | null }) {
  if (!forecast) return null;
  const top = forecast.byFamily.slice(0, 5);
  if (top.length === 0) return null;
  const posture = POSTURE_TONE[forecast.posture] ?? POSTURE_TONE.unknown;
  return (
    <div className="mt-6 border-t border-bg-border pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="label-eyebrow">Forward Forecast · 30 / 60 / 90 / 180 d</div>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            RSG Engine · forward forecast
          </span>
        </div>
        <span className={`chip ${posture.fg} ${posture.ring} ${posture.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${posture.fg.replace('text-', 'bg-')}`} />
          {posture.label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-4 font-mono text-2xs uppercase tracking-wider text-text-muted">
        <span>
          forward score{' '}
          <span className="num text-accent-cyan">{forecast.forwardScore.toFixed(1)}</span>
        </span>
        <span className="text-text-faint">·</span>
        <span>
          confidence{' '}
          <span className="num text-text-secondary">
            {Math.round(forecast.forecastConfidence * 100)}%
          </span>
        </span>
        <span className="text-text-faint">·</span>
        <span>
          drivers{' '}
          {forecast.topDrivers.length === 0 ? (
            <span className="text-text-faint">—</span>
          ) : (
            forecast.topDrivers.map((d) => (
              <span key={d} className="ml-1 text-text-secondary">
                {signalTypeShortLabel(d)}
              </span>
            ))
          )}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-sm border border-bg-border">
        <table className="min-w-full text-[12px]">
          <thead>
            <tr className="bg-bg-surface/40 text-left">
              <Th>Role family</Th>
              <Th align="right">30d</Th>
              <Th align="right">60d</Th>
              <Th align="right">90d</Th>
              <Th align="right">180d</Th>
              <Th align="right">Peak</Th>
              <Th>Drivers</Th>
            </tr>
          </thead>
          <tbody>
            {top.map((f) => (
              <tr key={f.family} className="border-t border-bg-line/50">
                <td className="px-3 py-1.5 align-middle">
                  <span className="font-medium text-text-primary">{f.label}</span>
                </td>
                <ProbCell value={f.probability30} />
                <ProbCell value={f.probability60} />
                <ProbCell value={f.probability90} />
                <ProbCell value={f.probability180} />
                <td className="num px-3 py-1.5 text-right align-middle text-text-secondary">
                  {f.peakDay}d
                </td>
                <td className="px-3 py-1.5 align-middle">
                  <div className="flex flex-wrap gap-1">
                    {f.drivingSignals.slice(0, 2).map((d) => (
                      <span
                        key={d}
                        className="chip ring-bg-rule text-text-secondary bg-bg-surface/60"
                      >
                        {signalTypeShortLabel(d)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProbCell({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const fg =
    v >= 70 ? "text-accent-green" : v >= 45 ? "text-accent-cyan" : v >= 20 ? "text-text-secondary" : "text-text-muted";
  const bar =
    v >= 70 ? "bg-accent-green" : v >= 45 ? "bg-accent-cyan" : v >= 20 ? "bg-accent-violet" : "bg-text-muted";
  return (
    <td className="px-3 py-1.5 text-right align-middle">
      <div className="flex items-center justify-end gap-2">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
          <div className={`h-full ${bar}`} style={{ width: `${v}%` }} />
        </div>
        <span className={`num text-[11.5px] font-semibold ${fg}`}>
          {v.toFixed(0)}%
        </span>
      </div>
    </td>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`label-eyebrow px-3 py-1.5 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function BandTimeline({
  window,
  band,
}: {
  window: number;
  band: ForecastBand;
}) {
  const max = 120;
  const pct = Math.min(100, (window / max) * 100);
  const bands = [
    { label: "Imminent", pct: 25, tone: "bg-accent-violet" },
    { label: "Near", pct: 25, tone: "bg-accent-cyan" },
    { label: "Mid", pct: 25, tone: "bg-accent-amber" },
    { label: "Watch", pct: 25, tone: "bg-text-muted" },
  ];
  const f = forecastStyles[band];
  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
        {bands.map((b) => (
          <div
            key={b.label}
            className={`${b.tone} opacity-30`}
            style={{ width: `${b.pct}%` }}
          />
        ))}
      </div>
      <div className="relative mt-1 h-1.5">
        <div
          className={`absolute -translate-x-1/2 ${f.dot} h-3 w-0.5 rounded-full`}
          style={{ left: `${pct}%`, top: "-9px" }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-2xs uppercase tracking-wider text-text-faint">
        <span>0d</span>
        <span>30d</span>
        <span>60d</span>
        <span>90d</span>
        <span>120d+</span>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "cyan" | "green" | "amber";
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "green"
      ? "text-accent-green"
      : tone === "amber"
      ? "text-accent-amber"
      : "text-text-primary";
  return (
    <div className="bg-bg-panel p-3">
      <div className="label-eyebrow">{label}</div>
      <div className={`num mt-1 text-base font-semibold ${fg}`}>{value}</div>
    </div>
  );
}
