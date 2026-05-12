"use client";

import { useCallback, useState } from "react";
import type {
  StrategyLabInput,
  StrategyLabResult,
  StrategyLabFailureReason,
} from "@/lib/strategyLab";

interface StrategyLabPanelProps {
  /** Optional API key — only required when /api/forecast/strategy-lab is gated. */
  apiKey?: string;
}

interface FormState {
  sector: string;
  region: string;
  companySizeRange: string;
  horizonMonths: number;
  targetCount: number;
  notes: string;
}

const INITIAL_FORM: FormState = {
  sector: "",
  region: "Bayern",
  companySizeRange: "250-1000 MA",
  horizonMonths: 6,
  targetCount: 10,
  notes: "",
};

const REGION_PRESETS = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Hamburg",
  "Hessen",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Sachsen",
  "Schleswig-Holstein",
  "Österreich · Wien",
  "Schweiz · Zürich",
];

const SIZE_PRESETS = [
  "10-49 MA",
  "50-249 MA",
  "250-1000 MA",
  "1.000-5.000 MA",
  "> 5.000 MA",
];

const REASON_COPY: Record<StrategyLabFailureReason | "tier_required", string> = {
  unconfigured: "Das Strategy Lab ist auf diesem Deployment nicht konfiguriert.",
  timeout:
    "Die Analyse hat das Zeit-Budget überschritten. Bitte erneut versuchen oder targetCount reduzieren.",
  upstream:
    "Die Analyse-Engine hat einen Fehler gemeldet. Bitte gleich nochmal versuchen.",
  parse: "Die Engine hat eine unerwartete Antwort geliefert. Bitte erneut starten.",
  validation: "Eingaben unvollständig — bitte alle Pflichtfelder prüfen.",
  quota:
    "Stündliches Strategy-Lab-Kontingent erschöpft. Bitte in einer Stunde erneut.",
  network: "Netzwerkfehler beim Aufruf der Analyse-Engine.",
  tier_required: "Diese Funktion ist Teil des Pro-Plans.",
};

interface ApiResponse {
  ok: boolean;
  data?: StrategyLabResult;
  reason?: StrategyLabFailureReason | "tier_required" | "bad_request";
  detail?: string;
}

export function StrategyLabPanel({ apiKey }: StrategyLabPanelProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StrategyLabResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!form.sector.trim()) {
      setError("Sektor ist Pflicht (z.B. 'Automotive Tier-1').");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const body: StrategyLabInput = {
      sector: form.sector.trim(),
      region: form.region.trim(),
      companySizeRange: form.companySizeRange.trim(),
      horizonMonths: form.horizonMonths,
      targetCount: form.targetCount,
      notes: form.notes.trim() || undefined,
    };

    try {
      const res = await fetch("/api/forecast/strategy-lab", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !payload.ok || !payload.data) {
        const reason = payload.reason ?? "upstream";
        const copy =
          reason in REASON_COPY
            ? REASON_COPY[reason as keyof typeof REASON_COPY]
            : "Unbekannter Fehler.";
        setError(payload.detail ? `${copy} (${payload.detail})` : copy);
      } else {
        setResult(payload.data);
      }
    } catch (e) {
      setError((e as Error).message || "Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }, [form, apiKey]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <span className="label-eyebrow">Strategy Lab · Multi-Agent Hiring Brief</span>
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            Hermes Engine · konsolidierter Vorstands-Output
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-wider text-text-muted">
          DACH · Mittelstand
        </span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-bg-border lg:grid-cols-[360px_minmax(0,1fr)]">
        <StrategyLabForm
          form={form}
          loading={loading}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSubmit={submit}
        />
        <div className="bg-bg-panel p-5">
          {error ? <ErrorBox detail={error} /> : null}
          {!error && !result && !loading ? <EmptyState /> : null}
          {loading ? <LoadingState /> : null}
          {result ? <ResultView result={result} /> : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function StrategyLabForm({
  form,
  loading,
  onChange,
  onSubmit,
}: {
  form: FormState;
  loading: boolean;
  onChange: (patch: Partial<FormState>) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="bg-bg-panel p-5 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Field label="Sektor">
        <input
          className="w-full rounded-sm border border-bg-border bg-bg-surface px-2 py-1.5 font-mono text-2xs text-text-primary focus:border-accent-cyan focus:outline-none"
          placeholder="z.B. Automotive Tier-1, Maschinenbau Werkzeug"
          value={form.sector}
          onChange={(e) => onChange({ sector: e.target.value })}
          maxLength={120}
          required
        />
      </Field>
      <Field label="Region">
        <select
          className="w-full rounded-sm border border-bg-border bg-bg-surface px-2 py-1.5 font-mono text-2xs text-text-primary focus:border-accent-cyan focus:outline-none"
          value={form.region}
          onChange={(e) => onChange({ region: e.target.value })}
        >
          {REGION_PRESETS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Unternehmensgrösse">
        <select
          className="w-full rounded-sm border border-bg-border bg-bg-surface px-2 py-1.5 font-mono text-2xs text-text-primary focus:border-accent-cyan focus:outline-none"
          value={form.companySizeRange}
          onChange={(e) => onChange({ companySizeRange: e.target.value })}
        >
          {SIZE_PRESETS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Horizont (Mo)">
          <input
            type="number"
            min={1}
            max={24}
            className="w-full rounded-sm border border-bg-border bg-bg-surface px-2 py-1.5 font-mono text-2xs text-text-primary focus:border-accent-cyan focus:outline-none"
            value={form.horizonMonths}
            onChange={(e) =>
              onChange({ horizonMonths: Number(e.target.value) || 6 })
            }
          />
        </Field>
        <Field label="Anzahl Actions">
          <input
            type="number"
            min={3}
            max={25}
            className="w-full rounded-sm border border-bg-border bg-bg-surface px-2 py-1.5 font-mono text-2xs text-text-primary focus:border-accent-cyan focus:outline-none"
            value={form.targetCount}
            onChange={(e) =>
              onChange({ targetCount: Number(e.target.value) || 10 })
            }
          />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <textarea
          className="terminal-input min-h-[80px]"
          placeholder="z.B. Fokus auf Bestandskunden, Recruiter-Capacity nur Field-Sales"
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          maxLength={2000}
        />
      </Field>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm border border-accent-cyan/60 bg-accent-cyan/10 px-3 py-2 font-mono text-2xs uppercase tracking-terminal text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-50"
      >
        {loading ? "Analyse läuft …" : "Strategie-Lauf starten"}
      </button>
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
        Read-only Intelligence · Outputs sind Modell-Schätzungen, keine
        verbindlichen Empfehlungen.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-eyebrow mb-1 block">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Result view
// ---------------------------------------------------------------------------

function ResultView({ result }: { result: StrategyLabResult }) {
  return (
    <div className="space-y-6">
      <ResultSection title="Executive Summary">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-text-primary">
          {result.executiveSummary.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </ResultSection>

      <ResultSection title="Annahmen">
        <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
          {result.assumptions.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </ResultSection>

      <ResultSection title="Marktlagebild">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SubList title="Branchen-Trends" items={result.marktLagebild.branchenTrends} />
          <SubList title="Regionale Hotspots" items={result.marktLagebild.regionaleHotspots} />
          <SubList
            title="Konsens-Kernaussagen"
            items={result.marktLagebild.konsensKernaussagen}
          />
        </div>
      </ResultSection>

      <ResultSection title="Hiring-Predictions">
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-2xs">
            <thead>
              <tr className="text-text-muted">
                <Th>Cluster</Th>
                <Th>Region</Th>
                <Th>Rollen</Th>
                <Th>Horizont</Th>
                <Th>Stärke</Th>
                <Th>Begründung</Th>
              </tr>
            </thead>
            <tbody>
              {result.predictions.map((p, i) => (
                <tr key={i} className="border-t border-bg-border/60 align-top">
                  <Td>{p.cluster}</Td>
                  <Td>{p.region}</Td>
                  <Td>{p.roleClusters.join(", ")}</Td>
                  <Td>{p.horizon}</Td>
                  <Td>
                    <StrengthChip value={p.strength} />
                  </Td>
                  <Td>
                    <span className="block max-w-[420px] whitespace-normal text-text-secondary">
                      {p.reasoning}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ResultSection>

      <ResultSection title="Vertriebs-Actions">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {result.vertriebsActions.map((a) => (
            <div
              key={a.rank}
              className="rounded-sm border border-bg-border/70 bg-bg-surface/40 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xs uppercase tracking-terminal text-accent-cyan">
                  #{a.rank} · {a.archetype}
                </span>
              </div>
              <div className="mt-1 text-2xs text-text-muted">
                {a.signals.length > 0 && (
                  <div>
                    <span className="text-text-faint">Signale:</span>{" "}
                    {a.signals.join(", ")}
                  </div>
                )}
                {a.roles.length > 0 && (
                  <div>
                    <span className="text-text-faint">Rollen:</span> {a.roles.join(", ")}
                  </div>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-text-primary">
                {a.outreachMessage}
              </p>
              <p className="mt-2 text-2xs italic text-text-secondary">
                {a.priorityReason}
              </p>
            </div>
          ))}
        </div>
      </ResultSection>

      <ResultSection title="Offene Risiken">
        <ul className="space-y-2">
          {result.openRisks.map((r, i) => (
            <li
              key={i}
              className="rounded-sm border border-bg-border/70 bg-bg-surface/40 p-2 text-sm"
            >
              <div className="font-medium text-text-primary">{r.risk}</div>
              <div className="text-2xs text-text-muted">
                <span className="text-text-faint">Mitigation:</span> {r.mitigation}
              </div>
            </li>
          ))}
        </ul>
      </ResultSection>

      <ResultSection title="Next Steps">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-text-primary">
          {result.nextSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </ResultSection>

      <MetaFooter result={result} />
    </div>
  );
}

function MetaFooter({ result }: { result: StrategyLabResult }) {
  return (
    <div className="border-t border-bg-border/60 pt-3 font-mono text-[10px] uppercase tracking-wider text-text-faint">
      runId {result.meta.runId.slice(0, 8)} · {Math.round(result.meta.durationMs / 1000)}s ·
      generated {new Date(result.meta.generatedAt).toLocaleString("de-DE")}
    </div>
  );
}

function ResultSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="label-eyebrow mb-2">{title}</div>
      {children}
    </section>
  );
}

function SubList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
        {title}
      </div>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-2xs text-text-secondary">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
        {items.length === 0 && <li className="text-text-faint">—</li>}
      </ul>
    </div>
  );
}

function StrengthChip({ value }: { value: string }) {
  const tone =
    value === "hoch"
      ? "text-accent-cyan ring-accent-cyan/40"
      : value === "mittel-hoch"
      ? "text-emerald-300 ring-emerald-400/40"
      : value === "mittel"
      ? "text-amber-300 ring-amber-400/40"
      : "text-text-muted ring-bg-border";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 ring-1 ${tone} bg-bg-surface/60 font-mono text-[10px] uppercase tracking-wider`}
    >
      {value}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-2 text-text-primary">{children}</td>;
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
      <div className="label-eyebrow mb-2">Strategy Lab bereit</div>
      <p className="max-w-md text-sm text-text-secondary">
        Wähle Sektor, Region und Zeithorizont links und starte den
        Strategie-Lauf. Das Lab simuliert intern ein Vorstandsgremium aus 7
        Rollen (CEO, CFO, CHRO, CTO, Macro-Analyst, Sales-Director plus
        Orchestrator) und liefert konsolidierte Hiring-Predictions plus
        priorisierte Vertriebs-Actions für den DACH-Markt.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center">
      <div className="h-2 w-32 animate-pulse rounded-full bg-accent-cyan/30" />
      <div className="label-eyebrow">Vorstandsgremium tagt …</div>
      <p className="max-w-md text-2xs text-text-muted">
        Lagebild → Widersprüche → Konsens → Actions. Typische Laufzeit
        45-90 Sekunden für eine komplette Vier-Runden-Diskussion.
      </p>
    </div>
  );
}

function ErrorBox({ detail }: { detail: string }) {
  return (
    <div className="rounded-sm border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
      {detail}
    </div>
  );
}
