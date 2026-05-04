import type { Request, Response } from 'express';
import { completion } from '../openrouter';

interface Body {
  companyName?: string;
  signalType?: string;
  title?: string;
  description?: string;
  source?: string;
  observedAt?: string;
}

const SYSTEM_PROMPT = [
  'You are an industrial-recruiting analyst.',
  'Given a company hiring signal, return a strict JSON object with:',
  '{ "summary": string (<= 240 chars),',
  '  "intent": "expansion"|"funding"|"restructuring"|"leadership"|"product"|"unknown",',
  '  "rolesLikely": string[]  (lower-case role family names, max 4),',
  '  "urgency": "low"|"medium"|"high",',
  '  "riskFlag": boolean,',
  '  "confidence": number  (0..1) }',
  'Be terse. Do not invent facts beyond the input. No markdown.',
].join(' ');

export async function analyzeSignalHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Body;
  const company = (body.companyName ?? '').trim();
  if (!company) {
    res.status(400).json({ ok: false, error: 'companyName required' });
    return;
  }

  const userPrompt = [
    `Company: ${company}`,
    body.signalType ? `Signal type: ${body.signalType}` : null,
    body.source ? `Source: ${body.source}` : null,
    body.observedAt ? `Observed at: ${body.observedAt}` : null,
    body.title ? `Title: ${body.title}` : null,
    body.description ? `Description: ${body.description}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const r = await completion({
    tier: 'fast',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseFormatJson: true,
    maxTokens: 400,
  });

  if (!r.ok) {
    res.status(200).json({
      ok: false,
      fellBack: true,
      error: r.error ?? 'llm_unavailable',
      analysis: fallbackAnalysis(body),
      model: r.model,
    });
    return;
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(r.text);
  } catch {
    parsed = null;
  }

  res.json({
    ok: true,
    analysis: parsed ?? { summary: r.text.slice(0, 240), raw: true },
    model: r.model,
    usage: r.usage,
    generatedAt: new Date().toISOString(),
  });
}

function fallbackAnalysis(body: Body) {
  return {
    summary: `${body.companyName ?? 'Company'} · ${body.signalType ?? 'signal'} (LLM offline; deterministic fallback)`,
    intent: 'unknown',
    rolesLikely: ['operations', 'gtm'],
    urgency: 'medium',
    riskFlag: body.signalType === 'restructuring' || body.signalType === 'insolvency',
    confidence: 0.5,
  };
}
