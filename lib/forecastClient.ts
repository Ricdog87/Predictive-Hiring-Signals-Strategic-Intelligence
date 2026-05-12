/**
 * forecastClient.ts
 *
 * Default provider for Szenario-Forecasts: ein direkter LLM-Call mit
 * Labor-Market-Expert-Prompt. Schnell, billig, deterministisch in der
 * Latency. Funktioniert ohne den MiroFish-VPS-Stack.
 *
 * Whitelabel: Provider-Strings ("anthropic", "openai", "claude") bleiben
 * intern. Customer-Surface ist identisch zum mirofishClient (ScenarioResult).
 *
 * Wechsel auf MiroFish: setze ENV FORECAST_PROVIDER=mirofish und konfiguriere
 * MIROFISH_BASE_URL/MIROFISH_API_KEY. Default ist 'llm'.
 *
 * Provider-Auswahl in app/api/forecast/scenario/route.ts.
 */

export type ForecastErrorReason =
  | 'unconfigured'
  | 'network'
  | 'timeout'
  | 'upstream'
  | 'auth'
  | 'parse'
  | 'unknown';

export type ForecastResult<T> =
  | { ok: true; data: T; latencyMs: number }
  | { ok: false; reason: ForecastErrorReason; detail?: string; latencyMs: number };

// Canonical types · inline (no external dep auf den mirofish-Stub)
export interface ScenarioRequest {
  companyId: string;
  prompt: string;
  sector?: string;
  rounds?: number;
}

export interface ScenarioResult {
  simulationId: string;
  summary: string;
  predictedRoleClusters: Array<{ cluster: string; confidence: number }>;
  expectedHiringWindowDays: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type Provider = 'anthropic' | 'openai' | 'openrouter';

function provider(): Provider {
  const p = (process.env.FORECAST_LLM_PROVIDER ?? 'openrouter').toLowerCase();
  if (p === 'anthropic') return 'anthropic';
  if (p === 'openai') return 'openai';
  return 'openrouter';
}

function llmKey(): string {
  const p = provider();
  if (p === 'anthropic') return process.env.ANTHROPIC_API_KEY ?? '';
  if (p === 'openai') return process.env.OPENAI_API_KEY ?? '';
  // OpenRouter: Naming-Convention im RSG-Hauptrepo folgt "Hermes"-Whitelabel.
  // HERMES_FORECAST_API_KEY ist der DEDIZIERTE Sub-Key für Forecast-Calls
  // (isoliertes Cost-Tracking, separates Spend-Limit). Falls nicht gesetzt,
  // fallback auf den allgemeinen Hermes-Key.
  return (
    process.env.HERMES_FORECAST_API_KEY ??
    process.env.HERMES_API_KEY ??
    process.env.OPENROUTER_API_KEY ??
    process.env.OPENAI_API_KEY ??
    ''
  );
}

function llmModel(): string {
  const override =
    process.env.HERMES_FORECAST_MODEL ?? process.env.FORECAST_LLM_MODEL;
  if (override) return override;
  const p = provider();
  if (p === 'anthropic') return 'claude-haiku-4-5-20251001';
  if (p === 'openai') return 'gpt-4o-mini';
  // OpenRouter: vollqualifizierter Slug. Haiku = schnell + billig.
  return 'anthropic/claude-haiku-4-5';
}

export function isForecastLlmConfigured(): boolean {
  return Boolean(llmKey());
}

function timeoutMs(): number {
  const raw = Number(process.env.FORECAST_LLM_TIMEOUT_MS ?? '30000');
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Du bist ein DACH-Labor-Market-Senior-Analyst mit 20 Jahren Erfahrung.
Du hast Zugriff auf öffentlich verfügbares Wissen über deutsche Unternehmensstrukturen,
typische Hiring-Patterns nach Sektoren und makroökonomische Krisendynamik.

Deine Aufgabe: Für ein gegebenes Szenario prognostizieren, welche Job-Rollen-Cluster
das betroffene Unternehmen in den nächsten 3-6 Monaten suchen wird. Sei KONKRET
(z.B. "Field Sales Manager Aftermarket Automotive"), nicht generisch ("Sales").

Antworte AUSSCHLIESSLICH in folgendem JSON-Format, ohne Markdown-Fences, ohne Prosa:
{
  "summary": "1-3 Sätze, was im Szenario passieren wird",
  "roles": [
    { "name": "konkrete Rolle", "confidence": 0.0-1.0 }
  ],
  "expectedHiringWindowDays": 30-240,
  "confidence": 0.0-1.0
}

Liefere zwischen 4 und 8 Rollen. Confidence pro Rolle reflektiert deine Sicherheit,
dass DIESE Rolle in DIESEM Szenario gesucht wird. Gesamt-Confidence ist eine
Selbsteinschätzung deiner Prognose-Qualität.`;

function buildUserPrompt(req: ScenarioRequest): string {
  const sector = req.sector ? `Sektor: ${req.sector}\n` : '';
  return `${sector}Szenario:\n${req.prompt}\n\nCompany-ID (intern): ${req.companyId}`;
}

// ---------------------------------------------------------------------------
// Public · Health
// ---------------------------------------------------------------------------

export interface ForecastLlmHealth {
  configured: boolean;
  provider: Provider;
  model: string;
}

export function forecastLlmHealth(): ForecastLlmHealth {
  return {
    configured: isForecastLlmConfigured(),
    provider: provider(),
    model: llmModel(),
  };
}

// ---------------------------------------------------------------------------
// Public · Scenario Forecast
// ---------------------------------------------------------------------------

export async function runDirectScenarioForecast(
  req: ScenarioRequest
): Promise<ForecastResult<ScenarioResult>> {
  const t0 = Date.now();

  if (!isForecastLlmConfigured()) {
    return { ok: false, reason: 'unconfigured', latencyMs: 0 };
  }

  try {
    const raw = await callLlm(buildUserPrompt(req));
    const parsed = parseScenarioJson(raw);
    if (!parsed) {
      return {
        ok: false,
        reason: 'parse',
        detail: 'LLM lieferte kein valides JSON',
        latencyMs: Date.now() - t0,
      };
    }

    const result: ScenarioResult = {
      simulationId: `direct_${Date.now().toString(36)}`,
      summary: parsed.summary,
      predictedRoleClusters: parsed.roles
        .filter((r) => r.name && r.name.length >= 3)
        .slice(0, 8)
        .map((r) => ({
          cluster: r.name.trim(),
          confidence: clamp01(r.confidence),
        })),
      expectedHiringWindowDays: clampRange(parsed.expectedHiringWindowDays, 30, 240),
      confidence: clamp01(parsed.confidence),
    };

    if (result.predictedRoleClusters.length === 0) {
      return {
        ok: false,
        reason: 'parse',
        detail: 'Keine validen Role-Cluster im LLM-Output',
        latencyMs: Date.now() - t0,
      };
    }

    return { ok: true, data: result, latencyMs: Date.now() - t0 };
  } catch (e: unknown) {
    const latencyMs = Date.now() - t0;
    const err = e as { name?: string; message?: string };
    if (err?.name === 'AbortError') {
      return { ok: false, reason: 'timeout', latencyMs };
    }
    return { ok: false, reason: 'network', detail: err?.message, latencyMs };
  }
}

// ---------------------------------------------------------------------------
// LLM caller (provider-specific)
// ---------------------------------------------------------------------------

async function callLlm(userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const tmo = setTimeout(() => controller.abort(), timeoutMs());
  try {
    if (provider() === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': llmKey(),
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: llmModel(),
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`upstream HTTP ${res.status} ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as { content?: Array<{ text?: string }> };
      return json?.content?.[0]?.text ?? '';
    }

    // OpenAI / OpenRouter (beide OpenAI-Format)
    const isOpenRouter = provider() === 'openrouter';
    const baseUrl =
      process.env.FORECAST_LLM_BASE_URL ??
      (isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${llmKey()}`,
      'content-type': 'application/json',
    };
    if (isOpenRouter) {
      // OpenRouter-Ranking-Headers (optional, aber empfohlen)
      headers['HTTP-Referer'] =
        process.env.HERMES_FORECAST_HTTP_REFERER ??
        process.env.FORECAST_LLM_HTTP_REFERER ??
        'https://predictive-hiring-signals-strategic.vercel.app';
      headers['X-Title'] =
        process.env.HERMES_FORECAST_APP_TITLE ??
        process.env.FORECAST_LLM_APP_TITLE ??
        'RSG Hiring Radar';
    }

    // response_format wird nicht von allen OpenRouter-Modellen unterstützt -
    // wir lassen es weg und parsen JSON aus dem freien Text (robust).
    const useResponseFormat = !isOpenRouter;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: llmModel(),
        temperature: 0.3,
        ...(useResponseFormat ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`upstream HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json?.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(tmo);
  }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

interface RawScenarioOutput {
  summary: string;
  roles: Array<{ name: string; confidence: number }>;
  expectedHiringWindowDays: number;
  confidence: number;
}

function parseScenarioJson(raw: string): RawScenarioOutput | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }

  const p = parsed as Partial<RawScenarioOutput>;
  if (!p || typeof p !== 'object') return null;
  if (typeof p.summary !== 'string' || !Array.isArray(p.roles)) return null;

  return {
    summary: p.summary,
    roles: p.roles
      .filter((r): r is { name: string; confidence: number } =>
        Boolean(r && typeof r.name === 'string')
      )
      .map((r) => ({
        name: r.name,
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.5,
      })),
    expectedHiringWindowDays:
      typeof p.expectedHiringWindowDays === 'number' ? p.expectedHiringWindowDays : 120,
    confidence: typeof p.confidence === 'number' ? p.confidence : 0.6,
  };
}

function clamp01(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return n > 1 && n <= 100 ? n / 100 : 1;
  return Number(n.toFixed(2));
}

function clampRange(n: number | undefined, lo: number, hi: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return Math.round((lo + hi) / 2);
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
