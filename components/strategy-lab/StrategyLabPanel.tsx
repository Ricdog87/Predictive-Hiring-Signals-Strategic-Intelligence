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
  quota?: { remaining: number; limit: number; resetSec: number };
}

export function StrategyLabPanel({ apiKey }: StrategyLabPanelProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StrategyLabResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);

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
      if (payload.quota) {
        setQuotaRemaining(payload.quota.remaining);
        setQuotaLimit(payload.quota.limit);
      }
    } catch (e) {
      setError((e as Error).message || "Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }, [form, apiKey]);

  return (
    <div className="space-y-5">
      {/* KPI strip — mirrors TodayPanel's KPI row */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-bg-border bg-bg-border md:grid-cols-4">
        <KpiCell
          label="Status"
          value={
            loading ? "läuft" : result ? "fertig" : error ? "fehler" : "bereit"
          }
          tone={loading ? "cyan" : result ? "green" : error ? "red" : "violet"}
          hint={
            loading
              ? "Vorstandsgremium tagt"
              : result
              ? `${Math.round(result.meta.durationMs / 1000)}s · runId ${result.meta.runId.slice(0, 6)}`
              : "Sektor + Region wählen"
          }
        />
        <KpiCell
          label="Scope"
          value={form.sector ? truncate(form.sector, 18) : "—"}
          tone="cyan"
          hint={`${form.region} · ${form.companySizeRange}`}
        />
        <KpiCell
          label="Horizont"
          value={`${form.horizonMonths} Mo`}
          tone="violet"
          hint={`${form.targetCount} Vertriebs-Actions`}
        />
        <KpiCell
          label="Quota · h"
          value={
            quotaRemaining !== null && quotaLimit !== null
              ? `${quotaRemaining}/${quotaLimit}`
              : "—"
          }
          tone="green"
          hint="rollende Stunde · pro Key"
        />
      </div>

      {/* Form + canvas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <span className="label-eyebrow">Lauf konfigurieren</span>
              <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
                DACH · Mittelstand
              </span>
            </div>
          </div>
          <StrategyLabForm
            form={form}
            loading={loading}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            onSubmit={submit}
          />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <span className="label-eyebrow">Konsolidierter Brief</span>
              <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
                {loading
                  ? "tagt · 4-Runden-Konsens"
                  : result
                  ? "live · konsolidiert"
                  : "bereit"}
              </span>
            </div>
            {result && (
              <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
                runId {result.meta.runId.slice(0, 8)} ·{" "}
                {Math.round(result.meta.durationMs / 1000)}s
              </span>
            )}
          </div>
          <div className="px-4 py-4">
            {error ? <ErrorBox detail={error} /> : null}
            {!error && !result && !loading ? <EmptyState /> : null}
            {loading ? <LoadingState /> : null}
            {result ? <ResultView result={result} /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

const INPUT_CLS =
  "w-full rounded-sm border border-bg-border bg-bg-surface px-2 py-1.5 font-mono text-[12px] text-text-primary placeholder:text-text-faint focus:border-accent-cyan focus:outline-none";

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
      className="space-y-3 px-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Field label="Sektor">
        <input
          className={INPUT_CLS}
          placeholder="z.B. Automotive Tier-1, Maschinenbau"
          value={form.sector}
          onChange={(e) => onChange({ sector: e.target.value })}
          maxLength={120}
          required
        />
      </Field>
      <Field label="Region">
        <select
          className={INPUT_CLS}
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
          className={INPUT_CLS}
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
        <Field label="Horizont · Mo">
          <input
            type="number"
            min={1}
            max={24}
            className={INPUT_CLS}
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
            className={INPUT_CLS}
            value={form.targetCount}
            onChange={(e) =>
              onChange({ targetCount: Number(e.target.value) || 10 })
            }
          />
        </Field>
      </div>
      <Field label="Notes · optional">
        <textarea
          className={`${INPUT_CLS} min-h-[72px]`}
          placeholder="z.B. Fokus auf Bestandskunden, nur Field-Sales-Rollen"
          value={form.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          maxLength={2000}
        />
      </Field>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm border border-accent-cyan/60 bg-accent-cyan/10 px-3 py-2 font-mono text-2xs uppercase tracking-terminal text-accent-cyan transition-colors hover:bg-accent-cyan/20 disabled:opacity-50"
      >
        {loading ? "Analyse läuft …" : "Strategie-Lauf starten"}
      </button>
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
        Read-only Intelligence · Modell-Schätzung, keine verbindliche Empfehlung.
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
    <div className="space-y-5">
      <ResultSection title="Executive Summary" hint="konsolidiert">
        <ul className="space-y-1.5 text-[13px] leading-relaxed text-text-primary">
          {result.executiveSummary.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="font-mono text-accent-cyan">›</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </ResultSection>

      <ResultSection title="Annahmen" hint="transparent">
        <ul className="space-y-1 text-[12.5px] text-text-secondary">
          {result.assumptions.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="font-mono text-text-faint">·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </ResultSection>

      <ResultSection title="Marktlagebild" hint="3 Spalten · Konsens">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-bg-border bg-bg-border md:grid-cols-3">
          <SubList title="Branchen-Trends" items={result.marktLagebild.branchenTrends} />
          <SubList
            title="Regionale Hotspots"
            items={result.marktLagebild.regionaleHotspots}
          />
          <SubList
            title="Konsens-Kernaussagen"
            items={result.marktLagebild.konsensKernaussagen}
          />
        </div>
      </ResultSection>

      <ResultSection title="Hiring-Predictions" hint={`${result.predictions.length} Cluster`}>
        <div className="overflow-x-auto rounded-sm border border-bg-border">
          <table className="w-full text-left font-mono text-[11.5px]">
            <thead className="bg-bg-surface/60">
              <tr className="text-text-muted">
                <Th>Cluster</Th>
                <Th>Region</Th>
                <Th>Rollen</Th>
                <Th>Horizont</Th>
                <Th>Stärke</Th>
                <Th>Begründung</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-line/60">
              {result.predictions.map((p, i) => (
                <tr key={i} className="align-top hover:bg-bg-elevated/40">
                  <Td className="font-semibold text-text-primary">{p.cluster}</Td>
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

      <ResultSection
        title="Vertriebs-Actions"
        hint={`Top ${result.vertriebsActions.length} priorisiert`}
      >
        <ul className="divide-y divide-bg-line/60 overflow-hidden rounded-sm border border-bg-border">
          {result.vertriebsActions.map((a) => (
            <li key={a.rank} className="px-4 py-3 hover:bg-bg-elevated/40">
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xs uppercase tracking-terminal text-accent-cyan">
                  #{a.rank}
                </span>
                <span className="truncate text-[13px] font-semibold text-text-primary">
                  {a.archetype}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
                {a.signals.length > 0 && (
                  <>
                    <span className="text-text-faint">Signale</span>
                    <span>{a.signals.join(" · ")}</span>
                  </>
                )}
                {a.roles.length > 0 && (
                  <>
                    <span className="text-text-faint">·</span>
                    <span className="text-text-faint">Rollen</span>
                    <span>{a.roles.join(" · ")}</span>
                  </>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-text-primary">
                {a.outreachMessage}
              </p>
              <p className="mt-1 text-2xs italic text-text-secondary">
                {a.priorityReason}
              </p>
            </li>
          ))}
        </ul>
      </ResultSection>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ResultSection title="Offene Risiken" hint={`${result.openRisks.length} flags`}>
          <ul className="divide-y divide-bg-line/60 overflow-hidden rounded-sm border border-bg-border">
            {result.openRisks.map((r, i) => (
              <li key={i} className="px-4 py-2.5 hover:bg-bg-elevated/40">
                <div className="text-[13px] font-semibold text-text-primary">{r.risk}</div>
                <div className="mt-0.5 font-mono text-2xs uppercase tracking-wider text-text-muted">
                  <span className="text-text-faint">Mitigation</span> · {r.mitigation}
                </div>
              </li>
            ))}
          </ul>
        </ResultSection>
        <ResultSection title="Next Steps" hint="7 Tage">
          <ol className="divide-y divide-bg-line/60 overflow-hidden rounded-sm border border-bg-border">
            {result.nextSteps.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-bg-elevated/40"
              >
                <span className="num font-mono text-[11px] text-accent-cyan">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px] text-text-primary">{s}</span>
              </li>
            ))}
          </ol>
        </ResultSection>
      </div>
    </div>
  );
}

function ResultSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-3">
        <span className="label-eyebrow">{title}</span>
        {hint && (
          <span className="font-mono text-2xs uppercase tracking-wider text-text-faint">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function SubList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-bg-panel px-4 py-3">
      <div className="label-eyebrow">{title}</div>
      <ul className="mt-1.5 space-y-1 text-[12.5px] text-text-secondary">
        {items.length === 0 ? (
          <li className="text-text-faint">—</li>
        ) : (
          items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="font-mono text-text-faint">·</span>
              <span>{it}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function StrengthChip({ value }: { value: string }) {
  const tone =
    value === "hoch"
      ? "text-accent-green ring-accent-green/40"
      : value === "mittel-hoch"
      ? "text-accent-cyan ring-accent-cyan/40"
      : value === "mittel"
      ? "text-accent-amber ring-accent-amber/40"
      : "text-text-muted ring-bg-border";
  return (
    <span
      className={`chip ${tone} bg-bg-surface/60`}
    >
      {value}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-mono text-2xs uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 text-text-primary ${className ?? ""}`}>{children}</td>;
}

function KpiCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "cyan" | "violet" | "green" | "red";
}) {
  const fg =
    tone === "cyan"
      ? "text-accent-cyan"
      : tone === "violet"
      ? "text-accent-violet"
      : tone === "green"
      ? "text-accent-green"
      : "text-accent-red";
  return (
    <div className="bg-bg-panel px-4 py-3">
      <div className="label-eyebrow truncate">{label}</div>
      <div className={`num mt-1 text-[18px] font-semibold leading-none ${fg}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-muted">
          {hint}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-sm border border-dashed border-bg-line bg-bg-surface/40 p-4 text-[12.5px]">
      <div className="font-semibold text-text-primary">Strategy Lab bereit.</div>
      <div className="mt-1 text-text-muted">
        Wähle Sektor, Region und Zeithorizont links und starte den
        Strategie-Lauf. Das Lab simuliert intern ein Vorstandsgremium aus
        sieben Rollen (CEO · CFO · CHRO · CTO · Macro · Sales · Orchestrator)
        und liefert einen konsolidierten Brief.
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-sm border border-dashed border-bg-line bg-bg-surface/40 p-4">
      <div className="label-eyebrow">Vorstandsgremium tagt</div>
      <div className="mt-2 h-1 w-32 animate-pulse-soft rounded-full bg-accent-cyan/40" />
      <div className="mt-2 font-mono text-2xs uppercase tracking-wider text-text-muted">
        Lagebild → Widersprüche → Konsens → Actions
      </div>
      <div className="mt-1 font-mono text-2xs uppercase tracking-wider text-text-faint">
        typisch 45-90s · 4 Runden konsolidiert
      </div>
    </div>
  );
}

function ErrorBox({ detail }: { detail: string }) {
  return (
    <div className="rounded-sm border border-accent-red/40 bg-accent-red/[0.06] px-3 py-2 font-mono text-[11px] text-accent-red">
      {detail}
    </div>
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1) + "…";
}
