/**
 * OpenRouter client · v1.
 *
 * Two-tier model strategy:
 *   - "fast"  → cheap classification / summary work (default
 *               openai/gpt-4o-mini, ~$0.15/M in)
 *   - "deep"  → richer narrative work, opportunity briefs only
 *               (default anthropic/claude-3.5-haiku, ~$0.80/M in)
 *
 * Both knobs are env-overridable so we can swap models without a
 * redeploy if pricing or availability shifts. The client carries:
 *   - hard request timeout (default 25 s)
 *   - max-tokens guardrail per tier
 *   - temperature default 0 for deterministic classification
 *   - structured response normalization
 *   - graceful fallback on timeout / 5xx so a Hermes request still
 *     returns something useful (without burning a second call).
 */

import { recordRequest } from './lib/budget';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export type ModelTier = 'fast' | 'deep' | 'live';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  tier: ModelTier;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  responseFormatJson?: boolean;
  /** Override the model env default for this call. */
  model?: string;
}

export interface CompletionResult {
  ok: boolean;
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** Source URLs returned by web-online models (Perplexity Sonar). */
  citations?: string[];
  error?: string;
  fellBack?: boolean;
}

const DEFAULT_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 25_000);
const DEFAULT_FAST_MODEL =
  process.env.OPENROUTER_MODEL_FAST?.trim() || 'openai/gpt-4o-mini';
const DEFAULT_DEEP_MODEL =
  process.env.OPENROUTER_MODEL_DEEP?.trim() || 'anthropic/claude-3.5-haiku';
const DEFAULT_LIVE_MODEL =
  process.env.OPENROUTER_MODEL_LIVE?.trim() || 'perplexity/sonar';
const DEFAULT_MAX_TOKENS_FAST = Number(
  process.env.OPENROUTER_MAX_TOKENS_FAST ?? 600
);
const DEFAULT_MAX_TOKENS_DEEP = Number(
  process.env.OPENROUTER_MAX_TOKENS_DEEP ?? 1500
);
const DEFAULT_MAX_TOKENS_LIVE = Number(
  process.env.OPENROUTER_MAX_TOKENS_LIVE ?? 800
);
const REFERER = process.env.OPENROUTER_REFERER?.trim() || 'https://rsg-hiring-radar.local';
const APP_NAME = process.env.OPENROUTER_APP_NAME?.trim() || 'RSG Hermes';

function modelFor(tier: ModelTier): string {
  if (tier === 'deep') return DEFAULT_DEEP_MODEL;
  if (tier === 'live') return DEFAULT_LIVE_MODEL;
  return DEFAULT_FAST_MODEL;
}

function defaultMaxTokens(tier: ModelTier): number {
  if (tier === 'deep') return DEFAULT_MAX_TOKENS_DEEP;
  if (tier === 'live') return DEFAULT_MAX_TOKENS_LIVE;
  return DEFAULT_MAX_TOKENS_FAST;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function completion(opts: CompletionOptions): Promise<CompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      text: '',
      model: 'unconfigured',
      error: 'OPENROUTER_API_KEY missing',
      fellBack: true,
    };
  }

  // Budget gate — drop the request before we even hit the wire when
  // we've blown the per-day cap or the per-minute rate ceiling.
  const budget = recordRequest(opts.tier);
  if (!budget.allowed) {
    return {
      ok: false,
      text: '',
      model: opts.model ?? modelFor(opts.tier),
      error: `budget guardrail tripped: ${budget.reason}`,
      fellBack: true,
    };
  }

  const model = opts.model ?? modelFor(opts.tier);
  const messages: ChatMessage[] = [];
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
  messages.push({ role: 'user', content: opts.userPrompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: Math.min(
      opts.maxTokens ?? defaultMaxTokens(opts.tier),
      defaultMaxTokens(opts.tier)
    ),
    temperature: opts.temperature ?? 0,
  };
  if (opts.responseFormatJson) {
    body.response_format = { type: 'json_object' };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': REFERER,
        'X-Title': APP_NAME,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        text: '',
        model,
        error: `openrouter ${res.status}: ${errText.slice(0, 200)}`,
        fellBack: true,
      };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: CompletionResult['usage'];
      citations?: string[];
      // Some providers return citations on the choice itself.
      // Keep defensive: pick whichever surface is present.
    } & Record<string, unknown>;
    const text = json.choices?.[0]?.message?.content?.trim() ?? '';
    const citationsRaw =
      (json.citations as string[] | undefined) ??
      ((json.choices?.[0] as Record<string, unknown> | undefined)?.[
        'citations'
      ] as string[] | undefined);
    const citations = Array.isArray(citationsRaw)
      ? citationsRaw.filter((c): c is string => typeof c === 'string')
      : undefined;
    return { ok: true, text, model, usage: json.usage, citations };
  } catch (err) {
    const message = (err as Error).message ?? 'unknown';
    return {
      ok: false,
      text: '',
      model,
      error: message.includes('aborted')
        ? `timeout after ${DEFAULT_TIMEOUT_MS}ms`
        : message,
      fellBack: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const OPENROUTER_INFO = {
  fastModel: () => DEFAULT_FAST_MODEL,
  deepModel: () => DEFAULT_DEEP_MODEL,
  timeoutMs: () => DEFAULT_TIMEOUT_MS,
  configured: isOpenRouterConfigured,
};
