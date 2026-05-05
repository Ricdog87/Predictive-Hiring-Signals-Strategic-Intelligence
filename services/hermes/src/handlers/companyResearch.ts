import type { Request, Response } from 'express';
import { completion } from '../openrouter';

interface Body {
  /** Free-form company name typed by the user (search field). */
  query?: string;
  /** Optional country / region hint to narrow ambiguous matches. */
  region?: string;
  /** Optional sector hint (e.g. "Pharma", "Mobility"). */
  sector?: string;
  /** Optional language for the narrative. Default "de". */
  locale?: string;
}

const SYSTEM_PROMPT = [
  'Du bist Senior Hiring-Intelligence-Analyst und recherchierst LIVE eine',
  'Firma für einen deutschen Recruiter. Du suchst im Web nach Fakten der',
  'letzten 12 Monate, gewichtest deutsche Wirtschaftsquellen höher (Handelsblatt,',
  'Manager Magazin, WirtschaftsWoche, Tagesschau, FAZ, Spiegel, Bundesanzeiger,',
  'Handelsregister, Pressemitteilungen) und lieferst eine kompakte Hiring-These.',
  '',
  'Output MUSS valides JSON sein, KEIN Markdown:',
  '{',
  '  "canonical": string (offizieller Firmenname),',
  '  "industry": string (Sektor in einem Wort, z.B. "Mobility & Automotive"),',
  '  "region": string (HQ-Region, z.B. "DACH · South" oder Land),',
  '  "headquarters": string (Stadt, Land),',
  '  "employeeCount": number | null (DACH-Headcount, oder null),',
  '  "summary": string (≤ 320 chars, Was macht die Firma, in deutscher Sprache),',
  '  "hiringPosture": "expanding" | "exploring" | "consolidating" | "contracting" | "unknown",',
  '  "recentSignals": [',
  '    { "type": string (z.B. "funding_grant" | "mna_buy" | "restructuring" | "expansion" | "patent_filing" | "leadership_change" | "job_spike" | "press"),',
  '      "title": string (Originaltitel der Quelle, ≤ 140 chars),',
  '      "date": string (YYYY-MM-DD),',
  '      "source": string (Domain wie "handelsblatt.com"),',
  '      "url": string (HTTPS) }',
  '  ] (3-7 Einträge, frischeste zuerst),',
  '  "rolesLikely": string[] (3-6 lower-case Role-Family Namen, was die Firma als nächstes einstellt),',
  '  "whyNow": string (≤ 320 chars, warum gerade jetzt — die forward-looking These),',
  '  "risks": string[] (0-3 ehrliche Risiko-Hinweise — Restructuring, Insolvenz nahe, Marktdruck),',
  '  "confidence": number (0..1)',
  '}',
  '',
  'Regeln:',
  ' - Nur reale, nachprüfbare Fakten zitieren. URL muss eine echte Quelle sein.',
  ' - Bei Unsicherheit: confidence senken statt Spekulation einbauen.',
  ' - Wenn die Firma nicht eindeutig identifizierbar ist: gib das beste Match zurück',
  '   und vermerke in summary dass mehrere Firmen ähnlichen Namens existieren.',
  ' - Wenn keine relevanten Signale in 12 Monaten: leeres Array für recentSignals',
  '   plus hiringPosture="unknown".',
].join('\n');

export async function companyResearchHandler(
  req: Request,
  res: Response
): Promise<void> {
  const body = (req.body ?? {}) as Body;
  const query = (body.query ?? '').trim();
  if (!query) {
    res.status(400).json({ ok: false, error: 'query is required' });
    return;
  }

  const userPrompt = [
    `Recherchiere die Firma: "${query}".`,
    body.region ? `Regionshinweis: ${body.region}.` : null,
    body.sector ? `Sektor-Hinweis: ${body.sector}.` : null,
    `Sprache: ${body.locale ?? 'de'}.`,
    '',
    'Suche LIVE im Web. Gewichte deutsche Quellen höher.',
    'Liefere das JSON-Objekt — keine Erklärung davor oder danach.',
  ]
    .filter(Boolean)
    .join('\n');

  const r = await completion({
    tier: 'live',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseFormatJson: true,
    maxTokens: 1100,
    temperature: 0.2,
  });

  if (!r.ok) {
    res.status(200).json({
      ok: false,
      fellBack: true,
      error: r.error ?? 'live_unavailable',
      research: {
        canonical: query,
        industry: 'Unknown',
        region: 'Unknown',
        headquarters: 'Unknown',
        employeeCount: null,
        summary: 'Live-Recherche aktuell nicht erreichbar. Bitte später erneut versuchen.',
        hiringPosture: 'unknown',
        recentSignals: [],
        rolesLikely: [],
        whyNow: '',
        risks: [],
        confidence: 0.0,
      },
      model: r.model,
    });
    return;
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(r.text);
  } catch {
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
    research:
      parsed && typeof parsed === 'object'
        ? parsed
        : { canonical: query, summary: r.text.slice(0, 320), raw: true },
    citations: r.citations ?? [],
    model: r.model,
    usage: r.usage,
    generatedAt: new Date().toISOString(),
  });
}
