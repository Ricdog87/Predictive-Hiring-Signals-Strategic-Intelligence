import type { Request, Response } from 'express';
import { completion } from '../openrouter';

interface Body {
  companyId?: string;
  companyName?: string;
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

const SYSTEM_PROMPT = [
  'You are a senior strategic-recruiting partner writing an internal',
  'opportunity brief for an account team. Output MUST be valid JSON:',
  '{ "headline": string (<= 90 chars),',
  '  "whyNow": string (<= 320 chars, plain prose),',
  '  "evidence": string[] (3-5 bullet phrases, each <= 140 chars, must reference the signals),',
  '  "rolesAndPersonas": string[] (3-5 lines, format "<role family> · <buyer persona>"),',
  '  "talkingPoints": string[] (3-5 short bullets the AE/recruiter can open with),',
  '  "risks": string[] (0-3 honest risk callouts),',
  '  "recommendedTiming": "this_week"|"two_weeks"|"this_month"|"watch",',
  '  "confidence": number (0..1) }',
  'Be concrete, no fluff, no markdown. Do not invent contacts, headcount or revenue.',
  'This brief is INTERNAL recruiting intelligence — never propose specific outreach copy.',
].join(' ');

export async function opportunityBriefHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Body;
  const name = (body.companyName ?? '').trim();
  if (!name) {
    res.status(400).json({ ok: false, error: 'companyName required' });
    return;
  }

  const sig = (body.signals ?? []).slice(0, 10);
  const userPrompt = [
    `Company: ${name}`,
    body.industry ? `Industry: ${body.industry}` : null,
    body.region ? `Region: ${body.region}` : null,
    body.opportunityScore != null
      ? `OpportunityScore: ${body.opportunityScore}/100`
      : null,
    body.hiringScore != null ? `HiringScore: ${body.hiringScore}/100` : null,
    body.topSignals?.length
      ? `Top signal types (computed): ${body.topSignals.join(', ')}`
      : null,
    body.predictedRoles?.length
      ? `Predicted role clusters (computed): ${body.predictedRoles.join(', ')}`
      : null,
    body.bestContactPersona
      ? `Suggested persona archetype: ${body.bestContactPersona}`
      : null,
    sig.length ? `Recent signals:` : null,
    ...sig.map(
      (s, i) =>
        `  ${i + 1}. type=${s.signalType ?? '?'} impact=${s.impact ?? '?'} conf=${
          s.confidence ?? '?'
        } src=${s.source ?? '?'} observedAt=${s.observedAt ?? '?'} title="${(s.title ?? '').slice(0, 140)}"`
    ),
  ]
    .filter(Boolean)
    .join('\n');

  const r = await completion({
    tier: 'deep',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseFormatJson: true,
    maxTokens: 1200,
  });

  if (!r.ok) {
    res.status(200).json({
      ok: false,
      fellBack: true,
      error: r.error ?? 'llm_unavailable',
      brief: deterministicFallback(body),
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
    brief: parsed ?? { headline: name, whyNow: r.text.slice(0, 320), raw: true },
    model: r.model,
    usage: r.usage,
    generatedAt: new Date().toISOString(),
  });
}

function deterministicFallback(body: Body) {
  return {
    headline: `${body.companyName ?? 'Company'} · opportunity (LLM offline)`,
    whyNow: `OpportunityScore ${body.opportunityScore ?? '?'}/100, hiring ${
      body.hiringScore ?? '?'
    }/100. Deterministic fallback — Hermes returned without an LLM call.`,
    evidence: (body.topSignals ?? []).map((s) => `Recent ${s} activity`),
    rolesAndPersonas: (body.predictedRoles ?? ['operations']).map(
      (r) => `${r} · ${body.bestContactPersona ?? 'Head of People'}`
    ),
    talkingPoints: ['Refer to dashboard signal log for the latest evidence.'],
    risks: [],
    recommendedTiming:
      (body.opportunityScore ?? 0) >= 75
        ? 'this_week'
        : (body.opportunityScore ?? 0) >= 60
        ? 'two_weeks'
        : 'this_month',
    confidence: 0.5,
  };
}
