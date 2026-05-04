import type { Request, Response } from 'express';
import { completion } from '../openrouter';

interface Body {
  /** ISO 3166-2:DE code (BW, BY, BE, …) or NUTS-1 (DE1..DEG). */
  region?: string;
  /** Plain-text label, e.g. "Bayern" or "Süd". */
  label?: string;
  /** "bundesland" | "quadrant" — informs the prompt framing. */
  scope?: 'bundesland' | 'quadrant';
  /** Optional context for grounding: top sectors, hiringRate, etc. */
  context?: {
    hiringRate?: number;
    topSectors?: string[];
    topCompanies?: string[];
    momentum?: number;
    unemploymentRate?: number;
  };
}

const SYSTEM_PROMPT = [
  'You are a senior labour-market analyst writing for German recruiters.',
  'You will receive a German region (a Bundesland or a quadrant such as',
  'Nord/Ost/Süd/West) and will return a strict JSON object:',
  '{ "headline": string (<= 90 chars),',
  '  "narrative": string (<= 380 chars, plain prose, German),',
  '  "drivers": string[] (3-5 short bullet phrases, German),',
  '  "watchOuts": string[] (0-3 short bullet phrases, German),',
  '  "rolesInDemand": string[] (3-6 lower-case role families),',
  '  "confidence": number (0..1) }',
  'Use the live web search to ground claims in current sources from the',
  'last 90 days (Bundesagentur für Arbeit, IHK, Handelsblatt, manager-magazin,',
  'Spiegel Wirtschaft, official press releases). Prefer concrete companies,',
  'cities, and quantified moves. Never fabricate names or numbers.',
  'No markdown. JSON only.',
].join(' ');

export async function regionalInsightHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Body;
  const region = (body.region ?? '').trim();
  const label = (body.label ?? '').trim() || region;
  const scope = body.scope ?? 'bundesland';
  if (!region && !label) {
    res.status(400).json({ ok: false, error: 'region or label required' });
    return;
  }

  const ctx = body.context ?? {};
  const userPrompt = [
    `Region (${scope}): ${label}${region && region !== label ? ` (${region})` : ''}`,
    'Lokales Hiring-Signal-Profil (vom RSG Hiring Radar):',
    ctx.hiringRate !== undefined ? `  · hiringRate (composite 0..100): ${ctx.hiringRate}` : null,
    ctx.momentum !== undefined ? `  · momentum 30d: ${ctx.momentum}` : null,
    ctx.unemploymentRate !== undefined ? `  · Arbeitslosenquote: ${ctx.unemploymentRate}%` : null,
    ctx.topSectors?.length ? `  · Top-Sektoren: ${ctx.topSectors.join(', ')}` : null,
    ctx.topCompanies?.length ? `  · Beobachtete Firmen: ${ctx.topCompanies.join(', ')}` : null,
    '',
    'Aufgabe: Liefere eine kurze, faktenbasierte Einschätzung für Recruiter,',
    `was ${label} aktuell auf dem Arbeitsmarkt antreibt — gestützt auf live-Webquellen.`,
    'Return strict JSON as specified by the system prompt.',
  ]
    .filter(Boolean)
    .join('\n');

  const r = await completion({
    tier: 'live',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseFormatJson: true,
    maxTokens: 700,
  });

  if (!r.ok) {
    res.status(200).json({
      ok: false,
      fellBack: true,
      error: r.error ?? 'live_unavailable',
      insight: deterministicFallback(label, ctx),
      model: r.model,
    });
    return;
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(r.text);
  } catch {
    // Sonar occasionally returns leading prose then JSON — try to recover
    const start = r.text.indexOf('{');
    const end = r.text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(r.text.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
  }

  res.json({
    ok: true,
    insight:
      parsed && typeof parsed === 'object'
        ? parsed
        : { headline: label, narrative: r.text.slice(0, 380), raw: true },
    citations: r.citations ?? [],
    model: r.model,
    usage: r.usage,
    generatedAt: new Date().toISOString(),
  });
}

function deterministicFallback(
  label: string,
  ctx: NonNullable<Body['context']>
) {
  const trend = (ctx.momentum ?? 0) >= 0 ? 'aufwärts' : 'abwärts';
  return {
    headline: `${label}: ${trend}-Trend (live-Quellen offline)`,
    narrative: `Composite hiring rate ${ctx.hiringRate ?? '?'}/100, Momentum ${
      ctx.momentum ?? '?'
    }. Live-Datenquelle nicht erreichbar — deterministische Fallback-Einschätzung.`,
    drivers: ctx.topSectors?.slice(0, 3) ?? ['Aktivität in beobachteten Sektoren'],
    watchOuts: [],
    rolesInDemand: ['operations', 'sales', 'engineering'],
    confidence: 0.4,
  };
}
