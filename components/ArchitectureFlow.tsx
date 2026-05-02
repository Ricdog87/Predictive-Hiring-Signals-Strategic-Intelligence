"use client";

const NODES = [
  {
    id: "sources",
    title: "Public Signals",
    sub: "LinkedIn · Crunchbase · Press · GitHub",
    tone: "muted" as const,
  },
  {
    id: "n8n",
    title: "n8n",
    sub: "Ingestion workflows",
    tone: "violet" as const,
  },
  {
    id: "hermes",
    title: "Hermes",
    sub: "Signal store + Scoring service",
    tone: "cyan" as const,
  },
  {
    id: "radar",
    title: "Hiring Radar",
    sub: "Predictive Intelligence UI",
    tone: "green" as const,
    active: true,
  },
  {
    id: "miro",
    title: "MiroFish",
    sub: "Strategy boards",
    tone: "amber" as const,
  },
];

const TONES = {
  muted: { ring: "ring-bg-rule", text: "text-text-secondary", dot: "bg-text-muted" },
  cyan: { ring: "ring-accent-cyan/40", text: "text-accent-cyan", dot: "bg-accent-cyan" },
  violet: { ring: "ring-accent-violet/40", text: "text-accent-violet", dot: "bg-accent-violet" },
  green: { ring: "ring-accent-green/40", text: "text-accent-green", dot: "bg-accent-green" },
  amber: { ring: "ring-accent-amber/40", text: "text-accent-amber", dot: "bg-accent-amber" },
};

export function ArchitectureFlow() {
  return (
    <div className="panel relative overflow-hidden">
      <div className="absolute inset-0 bg-grid bg-grid-fade opacity-60" />
      <div className="relative panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">System Topology</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            v0.1 mock · target architecture
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          read-only intelligence surface
        </span>
      </div>

      <div className="relative px-6 py-8">
        <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:gap-0">
          {NODES.map((n, i) => {
            const t = TONES[n.tone];
            return (
              <div key={n.id} className="flex flex-1 items-center">
                <div
                  className={`relative flex-1 rounded-md border bg-bg-surface px-4 py-3 ring-1 transition-shadow ${
                    n.active
                      ? "border-accent-green/50 shadow-[0_0_0_1px_rgba(52,211,153,0.2),0_0_30px_-8px_rgba(52,211,153,0.6)]"
                      : "border-bg-border"
                  } ${t.ring}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${t.dot} ${
                          n.active ? "animate-pulse-soft" : ""
                        }`}
                      />
                      <span className={`label-eyebrow ${t.text}`}>
                        {n.title}
                      </span>
                    </div>
                    {n.active && (
                      <span className="font-mono text-2xs uppercase tracking-wider text-accent-green">
                        you are here
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[12.5px] text-text-secondary">
                    {n.sub}
                  </div>
                </div>
                {i < NODES.length - 1 && (
                  <div className="hidden flex-shrink-0 items-center px-2 lg:flex">
                    <Connector />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-bg-border pt-4 font-mono text-2xs uppercase tracking-wider text-text-muted">
          <div className="flex items-center gap-3">
            <Legend dot="bg-accent-green" label="Operational" />
            <Legend dot="bg-accent-cyan" label="Planned · Hermes" />
            <Legend dot="bg-accent-violet" label="Planned · n8n" />
            <Legend dot="bg-accent-amber" label="Planned · MiroFish" />
          </div>
          <div className="flex items-center gap-3 text-text-secondary">
            <span>NO HUBSPOT</span>
            <span className="text-text-faint">·</span>
            <span>NO E-MAIL</span>
            <span className="text-text-faint">·</span>
            <span>NO OUTREACH</span>
            <span className="text-text-faint">·</span>
            <span>READ-ONLY INTELLIGENCE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <svg width="44" height="14" viewBox="0 0 44 14" fill="none">
      <defs>
        <linearGradient id="conn" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path
        d="M0 7 H36"
        stroke="url(#conn)"
        strokeWidth="1.4"
        strokeDasharray="3 3"
      />
      <path
        d="M36 2 L43 7 L36 12 Z"
        fill="#22D3EE"
        fillOpacity="0.85"
      />
    </svg>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}
