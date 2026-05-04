import type { Request, Response } from 'express';
import { completion } from '../openrouter';

interface Body {
  companyId?: string;
  companyName?: string;
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

const SYSTEM_PROMPT = [
  'You are an industrial-recruiting analyst.',
  'Given a company profile and recent hiring signals, return strict JSON:',
  '{ "thesis": string (<= 320 chars),',
  '  "topDrivers": string[] (max 4 short bullet phrases),',
  '  "watchOuts": string[] (max 3 short bullet phrases),',
  '  "rolesLikely": string[] (lower-case role family names, max 5),',
  '  "timing": "this_week"|"two_weeks"|"this_month"|"watch",',
  '  "confidence": number (0..1) }',
  'Stay grounded in the provided signals. No markdown.',
].join(' ');

export async function analyzeCompanyHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Body;
  const name = (body.companyName ?? '').trim();
  if (!name) {
    res.status(400).json({ ok: false, error: 'companyName required' });
    return;
  }

  const sig = (body.signals ?? []).slice(0, 8);
  const userPrompt = [
    `Company: ${name}`,
    body.industry ? `Industry: ${body.industry}` : null,
    body.region ? `Region: ${body.region}` : null,
    body.hiringScore != null ? `HiringScore: ${body.hiringScore}/100` : null,
    sig.length ? `Recent signals (most recent first):` : null,
    ...sig.map(
      (s, i) =>
        `  ${i + 1}. type=${s.signalType ?? '?'} impact=${s.impact ?? '?'} conf=${
          s.confidence ?? '?'
        } observedAt=${s.observedAt ?? '?'} title="${(s.title ?? '').slice(0, 120)}"`
    ),
  ]
    .filter(Boolean)
    .join('\n');

  const r = await completion({
    tier: 'fast',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseFormatJson: true,
    maxTokens: 500,
  });

  if (!r.ok) {
    res.status(200).json({
      ok: false,
      fellBack: true,
      error: r.error ?? 'llm_unavailable',
      analysis: deterministicFallback(body),
      model: r.model,
    });
    return;
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(r.text);
  } catch {
    parsed = null;
  }

  res.json({
    ok: true,
    analysis: parsed ?? { thesis: r.text.slice(0, 320), raw: true },
    model: r.model,
    usage: r.usage,
    generatedAt: new Date().toISOString(),
  });
}

function deterministicFallback(body: Body) {
  const score = body.hiringScore ?? 0;
  return {
    thesis: `${body.companyName ?? 'Company'} · hiring score ${Math.round(score)}/100 · LLM offline (deterministic fallback)`,
    topDrivers: ['recent signal volume', 'positive signal slant'],
    watchOuts: [],
    rolesLikely: ['operations', 'gtm'],
    timing: score >= 70 ? 'two_weeks' : score >= 50 ? 'this_month' : 'watch',
    confidence: 0.5,
  };
}
