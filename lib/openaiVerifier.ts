/**
 * Cross-verify layer for discovery signals.
 *
 * Calls OpenAI directly (NOT through the engine proxy) so it works as
 * an independent second opinion: if the engine hallucinates a hiring
 * claim, the verifier penalises it before it lands in the radar.
 *
 * Behaviour by design:
 *   - Disabled by default (opt-in via OPENAI_VERIFIER_ENABLED=true)
 *   - Skips signals below OPENAI_VERIFIER_MIN_CONFIDENCE (default 0.7)
 *     because low-conf signals don't deserve the spend
 *   - Hard timeout — never blocks the dashboard if OpenAI is slow
 *   - Any failure (no key, timeout, parse error, 5xx) → treats the
 *     signal as verified=true, so the original confidence stays intact
 *     ("trust unless proven otherwise")
 */

import type { CompanySignal } from './types';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT_MS = 6_000;

export interface VerifierVerdict {
  verified: boolean;
  adjustedConfidence: number;
  reasoning: string;
}

interface VerifierConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  minConfidence: number;
}

function readConfig(): VerifierConfig {
  return {
    enabled:
      (process.env.OPENAI_VERIFIER_ENABLED ?? 'false').toLowerCase() === 'true',
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
    model: process.env.OPENAI_VERIFIER_MODEL?.trim() || 'gpt-4o-mini',
    minConfidence: Number(process.env.OPENAI_VERIFIER_MIN_CONFIDENCE) || 0.7,
  };
}

export function isVerifierConfigured(): boolean {
  const cfg = readConfig();
  return cfg.enabled && cfg.apiKey.length > 0;
}

function metaString(
  meta: CompanySignal['meta'] | undefined,
  ...keys: string[]
): string {
  if (!meta) return '';
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return '';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function passthrough(signal: CompanySignal, reason: string): VerifierVerdict {
  return {
    verified: true,
    adjustedConfidence: signal.confidence,
    reasoning: reason,
  };
}

/**
 * Ask GPT-4o-mini whether the signal's claim is grounded in real,
 * verifiable reporting. JSON-only response keeps the parse surface tiny.
 */
export async function verifyDiscoverySignal(
  signal: CompanySignal
): Promise<VerifierVerdict> {
  const cfg = readConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    return passthrough(signal, 'verifier disabled');
  }
  if (signal.confidence < cfg.minConfidence) {
    return passthrough(signal, 'below verify threshold');
  }

  const title = metaString(signal.meta, 'title', 'headline');
  const description = metaString(signal.meta, 'description', 'summary');
  const source = metaString(signal.meta, 'source', 'provider');
  if (!title && !description) {
    return passthrough(signal, 'no metadata to verify');
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Du bewertest ob Hiring-Aussagen über DACH-Unternehmen faktisch belastbar sind. Antworte NUR als JSON: {"verified": boolean, "score": number zwischen 0 und 1, "why": string mit max 140 Zeichen}. verified=true wenn die Aussage durch eine seriöse, verifizierbare Quelle plausibel ist.',
          },
          {
            role: 'user',
            content: [
              `Signal-Typ: ${signal.signalType}`,
              `Title: ${title || '(none)'}`,
              `Beschreibung: ${description || '(none)'}`,
              `Quelle: ${source || '(unknown)'}`,
              `Engine-Confidence: ${signal.confidence.toFixed(2)}`,
              '',
              'Frage: Ist diese Hiring-Aussage faktisch gestützt durch eine verifizierbare Quelle? JSON antworten.',
            ].join('\n'),
          },
        ],
      }),
    });

    if (!res.ok) {
      return passthrough(signal, `verifier http ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return passthrough(signal, 'verifier empty response');
    }
    let parsed: { verified?: unknown; score?: unknown; why?: unknown };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return passthrough(signal, 'verifier parse error');
    }

    const verified = Boolean(parsed.verified);
    const score =
      typeof parsed.score === 'number' && Number.isFinite(parsed.score)
        ? clamp(parsed.score, 0, 1)
        : null;
    const reasoning =
      typeof parsed.why === 'string' && parsed.why.trim().length > 0
        ? parsed.why.trim().slice(0, 140)
        : verified
        ? 'verifier approved'
        : 'verifier flagged';

    // Penalty model: if not verified, halve the confidence. If verified,
    // blend the verifier's own score with the engine confidence (mean) —
    // a conservative two-source aggregator.
    let adjusted = signal.confidence;
    if (!verified) {
      adjusted = signal.confidence * 0.5;
    } else if (score !== null) {
      adjusted = (signal.confidence + score) / 2;
    }

    return {
      verified,
      adjustedConfidence: clamp(adjusted, 0, 1),
      reasoning,
    };
  } catch (err) {
    return passthrough(
      signal,
      `verifier error · ${(err as Error).message.slice(0, 80)}`
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fan-out a batch of signals through the verifier in parallel.
 * Returns a NEW array with `confidence` adjusted in place. Original
 * shape is preserved so callers stay drop-in.
 */
export async function verifyDiscoveryBatch(
  signals: CompanySignal[]
): Promise<CompanySignal[]> {
  if (!isVerifierConfigured() || signals.length === 0) return signals;

  const verdicts = await Promise.all(
    signals.map((s) =>
      verifyDiscoverySignal(s).catch(() => ({
        verified: true,
        adjustedConfidence: s.confidence,
        reasoning: 'verifier crash',
      }))
    )
  );

  return signals.map((s, i) => {
    const v = verdicts[i];
    if (!v) return s;
    return {
      ...s,
      confidence: v.adjustedConfidence,
      meta: {
        ...(s.meta ?? {}),
        verifierVerified: v.verified,
        verifierReasoning: v.reasoning,
      },
    };
  });
}
