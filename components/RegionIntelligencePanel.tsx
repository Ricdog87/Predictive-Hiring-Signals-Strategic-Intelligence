"use client";

import { TREND_STYLES } from "@/lib/marketIntelligence";
import type { RegionTrend } from "@/lib/uiContracts/market";
import { formatPct } from "@/lib/format";

interface RegionIntelligencePanelProps {
  regions: RegionTrend[];
}

export function RegionIntelligencePanel({
  regions,
}: RegionIntelligencePanelProps) {
  const top = regions.slice(0, 3);
  const maxRoles = Math.max(...regions.map((r) => r.predictedRoles90d), 1);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Region Intelligence</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            geo · sector mix · momentum · DE focus
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          {regions.length} regions
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px border-b border-bg-border bg-bg-border md:grid-cols-3">
        {top.map((r, i) => (
          <HotRegionCard key={r.region} rank={i + 1} region={r} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-px bg-bg-border md:grid-cols-2 xl:grid-cols-3">
        {regions.map((r) => (
          <RegionTile
            key={r.region}
            region={r}
            maxRoles={maxRoles}
          />
        ))}
        {regions.length === 0 && (
          <div className="bg-bg-panel p-6 text-center font-mono text-2xs uppercase tracking-wider text-text-muted md:col-span-2 xl:col-span-3">
            No regions match the active query.
          </div>
        )}
      </div>
    </div>
  );
}

function HotRegionCard({ rank, region }: { rank: number; region: RegionTrend }) {
  const t = TREND_STYLES[region.trend];
  const isDach = region.region === "DACH";
  return (
    <div className="relative bg-bg-panel p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="label-eyebrow flex items-center gap-1.5">
            <span className="text-accent-cyan">#{rank}</span>
            <span>Hottest region</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[15px] font-semibold text-text-primary">
              {region.region}
            </span>
            {isDach && (
              <span className="chip ring-accent-cyan/40 text-accent-cyan bg-accent-cyan/10">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
                DE focus
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-2xs text-text-muted">
            {region.dominantSectors
              .map(
                (s) => `${s.sector} ${Math.round(s.share * 100)}%`
              )
              .join(" · ")}
          </div>
        </div>
        <span className={`font-mono text-base ${t.tone}`}>{t.glyph}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="num text-3xl font-semibold text-accent-cyan">
          {region.averageScore}
        </span>
        <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
          avg score
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
        <div
          className="h-full bg-accent-cyan/80"
          style={{ width: `${region.averageScore}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px]">
        <div>
          <div className="label-eyebrow">Companies</div>
          <div className="num text-text-primary">{region.companies}</div>
        </div>
        <div>
          <div className="label-eyebrow">Confidence</div>
          <div className="num text-text-primary">{region.averageConfidence}</div>
        </div>
        <div>
          <div className="label-eyebrow">Roles 90d</div>
          <div className="num text-accent-cyan">{region.predictedRoles90d}</div>
        </div>
      </div>
    </div>
  );
}

function RegionTile({
  region,
  maxRoles,
}: {
  region: RegionTrend;
  maxRoles: number;
}) {
  const t = TREND_STYLES[region.trend];
  const heat =
    region.averageScore >= 70
      ? "bg-accent-cyan"
      : region.averageScore >= 50
      ? "bg-accent-amber"
      : "bg-text-muted";
  const isDach = region.region === "DACH";

  return (
    <div className="bg-bg-panel p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-text-primary">
              {region.region}
            </span>
            {isDach && (
              <span className="chip ring-accent-cyan/40 text-accent-cyan bg-accent-cyan/10">
                DE
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-2xs text-text-muted">
            {region.companies} companies · {region.predictedRoles90d} roles 90d
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`num text-base font-semibold text-accent-cyan`}>
            {region.averageScore}
          </span>
          <span className={`font-mono text-sm ${t.tone}`}>{t.glyph}</span>
        </div>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
        <div className={heat} style={{ width: `${region.averageScore}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
        <Row label="Confidence" value={region.averageConfidence.toString()} />
        <Row
          label="Momentum"
          value={formatPct(region.momentum)}
          tone={region.momentum >= 0 ? "text-accent-green" : "text-accent-red"}
        />
        <Row
          label="Pred. roles"
          value={region.predictedRoles90d.toString()}
          tone="text-accent-cyan"
        />
        <Row
          label="Risk flags"
          value={region.negativeFlags.toString()}
          tone={
            region.negativeFlags > 0 ? "text-accent-red" : "text-text-secondary"
          }
        />
      </div>

      <div className="mt-3">
        <div className="label-eyebrow mb-1">Pred. roles · share</div>
        <div className="h-1 overflow-hidden rounded-full bg-bg-surface ring-1 ring-bg-border">
          <div
            className="h-full bg-accent-cyan/80"
            style={{
              width: `${(region.predictedRoles90d / maxRoles) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="label-eyebrow mb-1.5">Dominant sectors</div>
        <div className="flex flex-wrap gap-1">
          {region.dominantSectors.map((s) => (
            <span
              key={s.sector}
              className="chip ring-bg-rule text-text-secondary bg-bg-surface/60"
            >
              {s.sector}{" "}
              <span className="num text-text-muted">
                {Math.round(s.share * 100)}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {isDach && region.germanyShare !== undefined && (
        <div className="mt-3 rounded-sm border border-bg-border bg-bg-surface/40 p-2">
          <div className="label-eyebrow flex items-center justify-between">
            <span>Germany share · DACH</span>
            <span className="num text-accent-cyan">
              {Math.round(region.germanyShare * 100)}%
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg-base">
            <div
              className="h-full bg-accent-cyan/80"
              style={{ width: `${region.germanyShare * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className={`num ${tone ?? "text-text-primary"}`}>{value}</span>
    </div>
  );
}
