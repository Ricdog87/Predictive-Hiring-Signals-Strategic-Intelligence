/**
 * Hermes Strategy Lab · v1.
 *
 * Multi-Agent-Strategie-Lab als Single-Mega-Call gegen ein Frontier-Modell
 * via OpenRouter. Das Modell simuliert intern ein 7er-Vorstandsgremium
 * (Orchestrator + CEO + CFO + CHRO + CTO + Macro Analyst + Sales Director)
 * und konsolidiert das Ergebnis in ein striktes JSON-Schema.
 *
 * Whitelabel: alle Vendor-Namen (OpenRouter, Anthropic, Claude, …) bleiben
 * in der Server-Schicht. Customer-Surface kennt nur "Hermes Strategy Lab".
 *
 * ENV:
 *   HERMES_STRATEGY_LAB_API_KEY        Bearer-Key gegen OpenRouter.
 *                                       Fallback-Chain: HERMES_FORECAST_API_KEY
 *                                       → HERMES_API_KEY → OPENROUTER_API_KEY.
 *   HERMES_STRATEGY_LAB_MODEL          OpenRouter-Slug. Default
 *                                       `anthropic/claude-sonnet-4.6`.
 *   HERMES_STRATEGY_LAB_TIMEOUT_MS     Default 120000 (LLM-Call kann lang
 *                                       laufen — der Mega-Prompt produziert
 *                                       3-6k Token Output).
 *   HERMES_STRATEGY_LAB_HTTP_REF       OpenRouter HTTP-Referer-Header.
 *   HERMES_STRATEGY_LAB_APP_TITLE      OpenRouter X-Title-Header.
 *   HERMES_STRATEGY_LAB_BASE_URL       Override für lokale Mocks.
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StrategyLabInput {
  sector: string;
  region: string;
  companySizeRange: string;
  horizonMonths: number;
  targetCount?: number;
  notes?: string;
}

export interface PredictionRow {
  cluster: string;
  region: string;
  roleClusters: string[];
  horizon: string;
  strength: 'niedrig' | 'mittel' | 'mittel-hoch' | 'hoch';
  reasoning: string;
}

export interface VertriebsAction {
  rank: number;
  archetype: string;
  signals: string[];
  roles: string[];
  outreachMessage: string;
  priorityReason: string;
}

export interface OpenRisk {
  risk: string;
  mitigation: string;
}

export interface StrategyLabResult {
  inputSnapshot: StrategyLabInput;
  assumptions: string[];
  executiveSummary: string[];
  marktLagebild: {
    branchenTrends: string[];
    regionaleHotspots: string[];
    konsensKernaussagen: string[];
  };
  predictions: PredictionRow[];
  vertriebsActions: VertriebsAction[];
  openRisks: OpenRisk[];
  nextSteps: string[];
  meta: {
    runId: string;
    generatedAt: string;
    modelInternal: string;
    durationMs: number;
    tokensUsed?: { input: number; output: number };
  };
}

export type StrategyLabFailureReason =
  | 'unconfigured'
  | 'timeout'
  | 'upstream'
  | 'parse'
  | 'validation'
  | 'quota'
  | 'network';

export type StrategyLabServiceResult =
  | { ok: true; data: StrategyLabResult }
  | { ok: false; reason: StrategyLabFailureReason; detail?: string };

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TARGET_COUNT = 10;

function apiKey(): string {
  return (
    process.env.HERMES_STRATEGY_LAB_API_KEY ??
    process.env.HERMES_FORECAST_API_KEY ??
    process.env.HERMES_API_KEY ??
    process.env.OPENROUTER_API_KEY ??
    ''
  ).trim();
}

function model(): string {
  return (process.env.HERMES_STRATEGY_LAB_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function baseUrl(): string {
  const raw = (process.env.HERMES_STRATEGY_LAB_BASE_URL ?? DEFAULT_BASE_URL).trim();
  return raw.replace(/\/+$/, '');
}

function timeoutMs(): number {
  const raw = Number(process.env.HERMES_STRATEGY_LAB_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export function isStrategyLabConfigured(): boolean {
  return Boolean(apiKey());
}

// ---------------------------------------------------------------------------
// System prompt (verbatim per spec)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Du bist das HERMES STRATEGY LAB - ein virtuelles Vorstandsgremium aus mehreren spezialisierten Agenten, das gemeinsam den deutschen Arbeitsmarkt analysiert und Hiring-Predictions für Unternehmen in DACH erstellt.

DEINE ROLLEN (interne Simulation, alle gleichzeitig):
1. ORCHESTRATOR - koordiniert die Diskussion in 4 Runden (Lagebild / Widersprüche / Konsens / Actions) und konsolidiert das Endergebnis.
2. CEO (Strategic CEO) - Unternehmensstrategie, Wachstum, Marktpositionierung, Branchen-/Regionen-Trends.
3. CFO (Financial CFO) - Profitabilität, Cash-Position, Restrukturierung, M&A, Funding, Margendruck.
4. CHRO / HR-DIRECTOR - Personalstrategie, Skill-Gaps, Fluktuation, Tarifthemen, interne vs. externe Besetzung.
5. CTO / TECH LEAD - Tech-Stack, Digitalisierung, AI/Cloud/IT-Roadmap, neue Produkte, Patente.
6. MARKET & MACRO ANALYST - Makrodaten, Branchen-Heatmaps, regionale Arbeitslosenquoten, Sektor-Boom/Bust.
7. SALES DIRECTOR (Recruiting / Agency Sales) - Go-to-Market, Target-Listen, ICP, Outreach-Messages, deutscher Mittelstands-Tonalität.

ARBEITSWEISE:
Du führst intern eine 4-Runden-Diskussion durch (Lagebild / Widersprüche / Konsens / Actions), aber gibst NUR das konsolidierte Endergebnis als JSON aus. Keine Zwischen-Diskussion in der Antwort.

KONTEXT-DATEN:
Der Nutzer liefert: Sektor, Region, Unternehmensgröße, Zeithorizont, optional Notes. Wenn Daten dünn sind, arbeitest du mit plausiblen Annahmen für den deutschen Markt und machst diese Annahmen EXPLIZIT im "assumptions"-Feld.

ZIELE:
1. Lagebild: Branchen- und Regions-Trends (Boom/Sättigung/Rückgang) für den gegebenen Scope.
2. Hiring-Predictions: Pro relevantem Sub-Cluster: Rollencluster, Zeitfenster, Stärke (niedrig/mittel/mittel-hoch/hoch) plus knappe Begründung.
3. Vertriebs-Actions: Exakt N priorisierte Archetypen/Companies (N = targetCount aus Input, default 10). Pro Archetyp: Trigger-Signale, Rollen, Outreach-Message (1-3 Sätze, deutsche Mittelstands-Tonalität, KEIN Marketing-Blabla, KEIN Buzz, KEINE Vendor-Namen).
4. Risiken: 3-7 offene Unsicherheiten + Mitigation.
5. Next Steps: 3-5 konkrete Wochenziele für den Recruiter.

STIL:
- Fachlich, knapp, sehr praxisorientiert. Schreibe wie ein erfahrener DACH-Senior-Berater an einen Mittelstands-Recruiter.
- Konkret statt generisch ("Field Sales Manager Aftermarket Automotive" statt "Sales").
- Annahmen transparent: "Wir nehmen an, dass ..."
- Deutsche Mittelstands-Tonalität in Outreach-Messages - nüchtern, direkt, mit konkretem Signal-Hook.
- Keine Emojis, keine englischen Buzzwords ohne deutsche Erklärung.

OUTPUT-VORSCHRIFT:
Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Objekt. Kein Markdown, keine Code-Fences, keine Prosa davor oder danach.

Das JSON muss exakt diesem Schema entsprechen:
{
  "assumptions": ["..."],
  "executiveSummary": ["..."],
  "marktLagebild": {
    "branchenTrends": ["..."],
    "regionaleHotspots": ["..."],
    "konsensKernaussagen": ["..."]
  },
  "predictions": [
    {
      "cluster": "string",
      "region": "string",
      "roleClusters": ["string"],
      "horizon": "0-3 Mo" | "3-6 Mo" | "6-9 Mo" | "6-12 Mo" | "9-12 Mo",
      "strength": "niedrig" | "mittel" | "mittel-hoch" | "hoch",
      "reasoning": "string"
    }
  ],
  "vertriebsActions": [
    {
      "rank": 1,
      "archetype": "string",
      "signals": ["string"],
      "roles": ["string"],
      "outreachMessage": "string",
      "priorityReason": "string"
    }
  ],
  "openRisks": [{ "risk": "string", "mitigation": "string" }],
  "nextSteps": ["string"]
}

WHITELABEL (NICHT VERHANDELBAR):
- Erwähne NIE in Customer-facing Strings: OpenAI, Anthropic, Claude, GPT, OpenRouter, MiroFish, OASIS, Zep, Qwen, LLM, AI-Agent, GPT-4, Sonnet, Haiku, Opus.
- Erwähne KEINE konkreten echten Personen mit Namen. Rollen ("Bereichsleiter Engineering", "CHRO") sind OK.
- Erwähne KEINE Konkurrenten des Recruiters. Bleib bei Archetypen.
- Firmennennungen (z.B. "Bosch", "BMW", "TenneT") sind nur OK, wenn sie als Marktanker dienen.`;

// ---------------------------------------------------------------------------
// Input normalisation + user prompt
// ---------------------------------------------------------------------------

const VALID_STRENGTHS = ['niedrig', 'mittel', 'mittel-hoch', 'hoch'] as const;
const VALID_HORIZONS = ['0-3 Mo', '3-6 Mo', '6-9 Mo', '6-12 Mo', '9-12 Mo'] as const;

export function normaliseInput(raw: Partial<StrategyLabInput>): StrategyLabInput {
  const sector = String(raw.sector ?? '').trim();
  const region = String(raw.region ?? '').trim();
  const companySizeRange = String(raw.companySizeRange ?? '').trim();
  const horizonRaw = Number(raw.horizonMonths);
  const horizonMonths = Number.isFinite(horizonRaw)
    ? Math.max(1, Math.min(24, Math.round(horizonRaw)))
    : 6;
  const targetCountRaw = Number(raw.targetCount);
  const targetCount =
    Number.isFinite(targetCountRaw) && targetCountRaw > 0
      ? Math.max(3, Math.min(25, Math.round(targetCountRaw)))
      : DEFAULT_TARGET_COUNT;
  const notes =
    typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 2000) : undefined;
  return { sector, region, companySizeRange, horizonMonths, targetCount, notes };
}

export function validateInput(input: StrategyLabInput): string | null {
  if (!input.sector) return 'sector required';
  if (!input.region) return 'region required';
  if (!input.companySizeRange) return 'companySizeRange required';
  if (!Number.isFinite(input.horizonMonths) || input.horizonMonths < 1)
    return 'horizonMonths required (>=1)';
  return null;
}

function buildUserPrompt(input: StrategyLabInput): string {
  const target = input.targetCount ?? DEFAULT_TARGET_COUNT;
  const lines = [
    'Eingaben des Recruiters:',
    `- Sektor: ${input.sector}`,
    `- Region (DACH): ${input.region}`,
    `- Unternehmensgrösse: ${input.companySizeRange}`,
    `- Zeithorizont: ${input.horizonMonths} Monate`,
    `- targetCount (Anzahl Vertriebs-Actions): ${target}`,
  ];
  if (input.notes) {
    lines.push('', 'Zusätzliche Notes des Recruiters:', input.notes);
  }
  lines.push(
    '',
    'Führe die 4-Runden-Diskussion intern aus und gib ausschließlich das konsolidierte JSON-Objekt zurück.',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Upstream call
// ---------------------------------------------------------------------------

interface OpenRouterResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callUpstream(
  userPrompt: string,
  signal: AbortSignal,
): Promise<{ raw: string; usage?: { input: number; output: number } }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    'content-type': 'application/json',
  };
  const ref = process.env.HERMES_STRATEGY_LAB_HTTP_REF?.trim();
  if (ref) headers['HTTP-Referer'] = ref;
  const title = process.env.HERMES_STRATEGY_LAB_APP_TITLE?.trim();
  if (title) headers['X-Title'] = title;

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model(),
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upstream HTTP ${res.status} ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as OpenRouterResponse;
  const raw = json.choices?.[0]?.message?.content ?? '';
  const usage =
    json.usage && typeof json.usage.prompt_tokens === 'number'
      ? {
          input: json.usage.prompt_tokens ?? 0,
          output: json.usage.completion_tokens ?? 0,
        }
      : undefined;
  return { raw, usage };
}

// ---------------------------------------------------------------------------
// Parsing + validation
// ---------------------------------------------------------------------------

function extractJsonObject(raw: string): unknown | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to fenced / embedded extraction
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* ignore */
    }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

function asStringArray(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, max);
}

function coerceStrength(value: unknown): PredictionRow['strength'] {
  if (typeof value !== 'string') return 'mittel';
  const v = value.trim().toLowerCase();
  for (const allowed of VALID_STRENGTHS) {
    if (v === allowed) return allowed;
  }
  if (v === 'mittel-hoch' || v === 'mittel hoch') return 'mittel-hoch';
  return 'mittel';
}

function coerceHorizon(value: unknown): string {
  if (typeof value !== 'string') return '3-6 Mo';
  const v = value.trim();
  for (const allowed of VALID_HORIZONS) {
    if (v === allowed) return allowed;
  }
  return v.length > 0 ? v.slice(0, 24) : '3-6 Mo';
}

function coercePredictions(value: unknown): PredictionRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row): PredictionRow | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const cluster = typeof r.cluster === 'string' ? r.cluster.trim() : '';
      const region = typeof r.region === 'string' ? r.region.trim() : '';
      const reasoning = typeof r.reasoning === 'string' ? r.reasoning.trim() : '';
      if (!cluster || !region || !reasoning) return null;
      return {
        cluster,
        region,
        roleClusters: asStringArray(r.roleClusters, 12),
        horizon: coerceHorizon(r.horizon),
        strength: coerceStrength(r.strength),
        reasoning,
      };
    })
    .filter((r): r is PredictionRow => r !== null)
    .slice(0, 30);
}

function coerceVertriebsActions(value: unknown, target: number): VertriebsAction[] {
  if (!Array.isArray(value)) return [];
  const rows = value
    .map((row, idx): VertriebsAction | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const archetype = typeof r.archetype === 'string' ? r.archetype.trim() : '';
      const outreachMessage =
        typeof r.outreachMessage === 'string' ? r.outreachMessage.trim() : '';
      const priorityReason =
        typeof r.priorityReason === 'string' ? r.priorityReason.trim() : '';
      if (!archetype || !outreachMessage) return null;
      const rankRaw = Number(r.rank);
      const rank = Number.isFinite(rankRaw) && rankRaw > 0 ? Math.round(rankRaw) : idx + 1;
      return {
        rank,
        archetype,
        signals: asStringArray(r.signals, 10),
        roles: asStringArray(r.roles, 10),
        outreachMessage,
        priorityReason,
      };
    })
    .filter((r): r is VertriebsAction => r !== null);
  rows.sort((a, b) => a.rank - b.rank);
  return rows.slice(0, Math.max(1, target));
}

function coerceOpenRisks(value: unknown): OpenRisk[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row): OpenRisk | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const risk = typeof r.risk === 'string' ? r.risk.trim() : '';
      const mitigation = typeof r.mitigation === 'string' ? r.mitigation.trim() : '';
      if (!risk || !mitigation) return null;
      return { risk, mitigation };
    })
    .filter((r): r is OpenRisk => r !== null)
    .slice(0, 12);
}

interface ParseOutcome {
  ok: boolean;
  data?: Omit<StrategyLabResult, 'inputSnapshot' | 'meta'>;
  detail?: string;
}

function parseStrategyLabPayload(raw: string, target: number): ParseOutcome {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, detail: 'no JSON object detected' };
  }
  const obj = parsed as Record<string, unknown>;

  const lagebild = (obj.marktLagebild ?? {}) as Record<string, unknown>;
  const data: Omit<StrategyLabResult, 'inputSnapshot' | 'meta'> = {
    assumptions: asStringArray(obj.assumptions, 15),
    executiveSummary: asStringArray(obj.executiveSummary, 10),
    marktLagebild: {
      branchenTrends: asStringArray(lagebild.branchenTrends, 12),
      regionaleHotspots: asStringArray(lagebild.regionaleHotspots, 12),
      konsensKernaussagen: asStringArray(lagebild.konsensKernaussagen, 12),
    },
    predictions: coercePredictions(obj.predictions),
    vertriebsActions: coerceVertriebsActions(obj.vertriebsActions, target),
    openRisks: coerceOpenRisks(obj.openRisks),
    nextSteps: asStringArray(obj.nextSteps, 8),
  };

  if (data.predictions.length === 0) {
    return { ok: false, detail: 'no valid predictions' };
  }
  if (data.vertriebsActions.length === 0) {
    return { ok: false, detail: 'no valid vertriebsActions' };
  }
  if (data.executiveSummary.length === 0) {
    return { ok: false, detail: 'executiveSummary empty' };
  }

  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runHermesStrategyLab(
  rawInput: Partial<StrategyLabInput>,
): Promise<StrategyLabServiceResult> {
  if (!isStrategyLabConfigured()) {
    return { ok: false, reason: 'unconfigured', detail: 'API key missing' };
  }

  const input = normaliseInput(rawInput);
  const invalid = validateInput(input);
  if (invalid) {
    return { ok: false, reason: 'validation', detail: invalid };
  }

  const target = input.targetCount ?? DEFAULT_TARGET_COUNT;
  const userPrompt = buildUserPrompt(input);

  const controller = new AbortController();
  const tmo = setTimeout(() => controller.abort(), timeoutMs());
  const startedAt = Date.now();

  try {
    const { raw, usage } = await callUpstream(userPrompt, controller.signal);
    const parsed = parseStrategyLabPayload(raw, target);
    if (!parsed.ok || !parsed.data) {
      return { ok: false, reason: 'parse', detail: parsed.detail };
    }

    const result: StrategyLabResult = {
      inputSnapshot: input,
      ...parsed.data,
      meta: {
        runId: randomUUID(),
        generatedAt: new Date().toISOString(),
        modelInternal: model(),
        durationMs: Date.now() - startedAt,
        tokensUsed: usage,
      },
    };
    return { ok: true, data: result };
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string };
    if (e?.name === 'AbortError') {
      return { ok: false, reason: 'timeout', detail: `>${timeoutMs()}ms` };
    }
    const msg = e?.message ?? 'unknown';
    if (msg.startsWith('upstream HTTP')) {
      return { ok: false, reason: 'upstream', detail: msg };
    }
    return { ok: false, reason: 'network', detail: msg };
  } finally {
    clearTimeout(tmo);
  }
}

// ---------------------------------------------------------------------------
// Whitelabel guard — strip vendor names from customer-facing strings.
// Mirrors the convention used by lib/hermesClient.ts:stripVendor but works
// on the result tree (which is mostly free-text rather than metadata).
// ---------------------------------------------------------------------------

const VENDOR_TOKENS = [
  'OpenAI',
  'Anthropic',
  'Claude',
  'GPT-4',
  'GPT',
  'OpenRouter',
  'MiroFish',
  'OASIS',
  'Zep',
  'Qwen',
  'Sonnet',
  'Haiku',
  'Opus',
];

function scrubString(value: string): string {
  let out = value;
  for (const token of VENDOR_TOKENS) {
    const re = new RegExp(`\\b${token}\\b`, 'gi');
    out = out.replace(re, '[…]');
  }
  return out;
}

function scrubStringArray(values: string[]): string[] {
  return values.map((v) => scrubString(v));
}

export function scrubStrategyLabResult(result: StrategyLabResult): StrategyLabResult {
  return {
    ...result,
    assumptions: scrubStringArray(result.assumptions),
    executiveSummary: scrubStringArray(result.executiveSummary),
    marktLagebild: {
      branchenTrends: scrubStringArray(result.marktLagebild.branchenTrends),
      regionaleHotspots: scrubStringArray(result.marktLagebild.regionaleHotspots),
      konsensKernaussagen: scrubStringArray(result.marktLagebild.konsensKernaussagen),
    },
    predictions: result.predictions.map((p) => ({
      ...p,
      cluster: scrubString(p.cluster),
      roleClusters: scrubStringArray(p.roleClusters),
      reasoning: scrubString(p.reasoning),
    })),
    vertriebsActions: result.vertriebsActions.map((a) => ({
      ...a,
      archetype: scrubString(a.archetype),
      signals: scrubStringArray(a.signals),
      roles: scrubStringArray(a.roles),
      outreachMessage: scrubString(a.outreachMessage),
      priorityReason: scrubString(a.priorityReason),
    })),
    openRisks: result.openRisks.map((r) => ({
      risk: scrubString(r.risk),
      mitigation: scrubString(r.mitigation),
    })),
    nextSteps: scrubStringArray(result.nextSteps),
    meta: {
      ...result.meta,
      modelInternal: '[redacted]',
    },
  };
}
