/**
 * Hermes client · v1.
 *
 * Thin fetch wrapper used by the Hiring Radar API routes that proxy
 * to the Hermes analysis service. Hermes is *optional* — when
 * `HERMES_BASE_URL` is unset, every call short-circuits to a structured
 * "disabled" response so the dashboard and the n8n pipeline never
 * break, they just degrade gracefully.
 *
 * ENV:
 *   HERMES_BASE_URL    e.g. https://hermes.example.com  (no trailing slash needed)
 *   HERMES_API_KEY     optional bearer token, must match Hermes-side
 *   HERMES_TIMEOUT_MS  default 25000
 */

const DEFAULT_TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS ?? 25_000);

function baseUrl(): string | null {
  const raw = process.env.HERMES_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

export function isHermesConfigured(): boolean {
  return baseUrl() !== null;
}

export interface HermesError {
  ok: false;
  fellBack: true;
  reason:
    | 'unconfigured'
    | 'timeout'
    | 'network'
    | 'http_error'
    | 'invalid_json';
  detail?: string;
  status?: number;
}

export interface HermesEnvelope<T> {
  ok: true;
  data: T;
}

export type HermesResult<T> = HermesEnvelope<T> | HermesError;

interface CallOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  timeoutMs?: number;
}

async function call<T>(opts: CallOptions): Promise<HermesResult<T>> {
  const root = baseUrl();
  if (!root) {
    return {
      ok: false,
      fellBack: true,
      reason: 'unconfigured',
      detail: 'HERMES_BASE_URL not set',
    };
  }

  const url = `${root}${opts.path.startsWith('/') ? '' : '/'}${opts.path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const apiKey = process.env.HERMES_API_KEY?.trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  try {
    const res = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        fellBack: true,
        reason: 'http_error',
        status: res.status,
        detail: text.slice(0, 300),
      };
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch (err) {
      return {
        ok: false,
        fellBack: true,
        reason: 'invalid_json',
        detail: (err as Error).message,
      };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    const message = (err as Error).message ?? 'unknown';
    return {
      ok: false,
      fellBack: true,
      reason: message.includes('aborted') ? 'timeout' : 'network',
      detail: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface HermesHealth {
  ok: boolean;
  service: string;
  version: string;
  uptimeSec: number;
  auth: 'enforced' | 'open';
  openrouter: {
    configured: boolean;
    fastModel: string;
    deepModel: string;
    timeoutMs: number;
  };
  budget: unknown[];
  generatedAt: string;
}

export async function hermesHealth(): Promise<HermesResult<HermesHealth>> {
  return call<HermesHealth>({ method: 'GET', path: '/health' });
}

export interface AnalyzeSignalInput {
  companyName: string;
  signalType?: string;
  title?: string;
  description?: string;
  source?: string;
  observedAt?: string;
}

export interface SignalAnalysis {
  summary: string;
  intent: string;
  rolesLikely: string[];
  urgency: 'low' | 'medium' | 'high';
  riskFlag: boolean;
  confidence: number;
}

export async function analyzeSignal(
  input: AnalyzeSignalInput
): Promise<HermesResult<{ analysis: SignalAnalysis; model: string }>> {
  return call<{ analysis: SignalAnalysis; model: string }>({
    method: 'POST',
    path: '/analyze-signal',
    body: input,
  });
}

export interface AnalyzeCompanyInput {
  companyId?: string;
  companyName: string;
  industry?: string;
  region?: string;
  hiringScore?: number;
  signals?: Array<{
    signalType?: string;
    title?: string;
    impact?: number;
    confidence?: number;
    observedAt?: string;
  }>;
}

export interface CompanyAnalysis {
  thesis: string;
  topDrivers: string[];
  watchOuts: string[];
  rolesLikely: string[];
  timing: 'this_week' | 'two_weeks' | 'this_month' | 'watch';
  confidence: number;
}

export async function analyzeCompany(
  input: AnalyzeCompanyInput
): Promise<HermesResult<{ analysis: CompanyAnalysis; model: string }>> {
  return call<{ analysis: CompanyAnalysis; model: string }>({
    method: 'POST',
    path: '/analyze-company',
    body: input,
  });
}

export interface OpportunityBriefInput {
  companyId?: string;
  companyName: string;
  industry?: string;
  region?: string;
  opportunityScore?: number;
  hiringScore?: number;
  topSignals?: string[];
  predictedRoles?: string[];
  bestContactPersona?: string;
  signals?: Array<{
    signalType?: string;
    title?: string;
    impact?: number;
    confidence?: number;
    observedAt?: string;
    source?: string;
  }>;
}

export interface OpportunityBrief {
  headline: string;
  whyNow: string;
  evidence: string[];
  rolesAndPersonas: string[];
  talkingPoints: string[];
  risks: string[];
  recommendedTiming: 'this_week' | 'two_weeks' | 'this_month' | 'watch';
  confidence: number;
}

export async function generateOpportunityBrief(
  input: OpportunityBriefInput
): Promise<HermesResult<{ brief: OpportunityBrief; model: string }>> {
  return call<{ brief: OpportunityBrief; model: string }>({
    method: 'POST',
    path: '/generate-opportunity-brief',
    body: input,
    // deeper LLM tier on Hermes side, allow more headroom
    timeoutMs: Number(process.env.HERMES_TIMEOUT_MS_DEEP ?? 35_000),
  });
}

export interface RegionalInsightInput {
  /** ISO 3166-2:DE code (BW, BY, …) or NUTS-1 (DE1..DEG). */
  region?: string;
  /** Plain label, e.g. "Bayern" or "Süd". */
  label?: string;
  scope?: 'bundesland' | 'quadrant';
  context?: {
    hiringRate?: number;
    topSectors?: string[];
    topCompanies?: string[];
    momentum?: number;
    unemploymentRate?: number;
  };
}

export interface RegionalInsight {
  headline: string;
  narrative: string;
  drivers: string[];
  watchOuts: string[];
  rolesInDemand: string[];
  confidence: number;
}

export async function regionalInsight(
  input: RegionalInsightInput
): Promise<HermesResult<{ insight: RegionalInsight; citations?: string[]; model: string }>> {
  return call<{ insight: RegionalInsight; citations?: string[]; model: string }>({
    method: 'POST',
    path: '/regional-insight',
    body: input,
    // Live web search can take a moment — give it a longer leash.
    timeoutMs: Number(process.env.HERMES_TIMEOUT_MS_LIVE ?? 30_000),
  });
}
