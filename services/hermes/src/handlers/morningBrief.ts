import type { Request, Response } from 'express';
import { completion } from '../openrouter';

interface Body {
  /** Free-form role / context that shapes the brief. */
  role?: string;
  /** ISO locale, default "de-DE". */
  locale?: string;
  /** Sectors the user cares about — biases the news selection. */
  focusIndustries?: string[];
  /** Regions the user cares about (DACH default). */
  focusRegions?: string[];
  /** Optional watchlist company names — surface news mentioning these first. */
  watchlist?: string[];
}

const SYSTEM_PROMPT = [
  'Du bist Senior-Wirtschaftsredakteur einer deutschen Wirtschaftszeitung',
  'und briefst morgens einen Recruiter / Talent-Acquisition-Lead über die für',
  'seinen Beruf relevanteste Lage in DACH. Suche LIVE im Web nach Nachrichten',
  'der letzten 72 Stunden zu:',
  '  1. Stellenabbau / Layoffs / Restructuring (welche Firmen, wie viele Stellen)',
  '  2. Stellenaufbau / Expansion / Hiring (welche Firmen, welche Bereiche, ggf. wie viele Stellen)',
  '  3. M&A / Übernahmen / Insolvenzen / Fusionen',
  '  4. Funding-Runden / Förderzusagen (DACH Startups, Mittelstand, Konzerne)',
  '  5. Makro-Lage (DAX, Inflation, Konjunktur, ifo-Index, Bundesagentur für Arbeit, EZB)',
  '',
  'Gewichte deutsche Quellen höher: Handelsblatt, Manager Magazin, Wirtschafts-',
  'Woche, Tagesschau, Spiegel, FAZ, Süddeutsche, Bundesagentur, Statistisches',
  'Bundesamt, INSM. Internationale Quellen (Reuters, Bloomberg, FT) nur wenn',
  'sie über DACH-Firmen berichten.',
  '',
  'Output MUSS valides JSON sein, KEIN Markdown, KEIN Preamble. Schema:',
  '{',
  '  "headline": string (≤ 90 chars, Schlagzeile in deutscher Sprache, prägnant),',
  '  "summary": string (≤ 320 chars, Tagesüberblick im Wirtschaftszeitungs-Stil),',
  '  "layoffPulse": [',
  '    { "company": string, "headcount": number | null, "context": string (≤ 120 chars), "source": string }',
  '  ] (3-7 Einträge, größter Stellenabbau zuerst),',
  '  "hiringPulse": [',
  '    { "company": string, "context": string (≤ 120 chars), "source": string }',
  '  ] (2-5 Einträge),',
  '  "deals": [',
  '    { "type": "M&A" | "Funding" | "Insolvency" | "Spin-off",',
  '      "companies": string[], "summary": string (≤ 120 chars), "source": string }',
  '  ] (0-4 Einträge),',
  '  "macroPulse": string (≤ 220 chars, ein bis zwei Sätze zur DACH-Wirtschaftslage),',
  '  "watchToday": string[] (3-5 short bullets in Imperativ — was Recruiter heute beobachten sollten),',
  '  "confidence": number (0..1)',
  '}',
  '',
  'Regeln:',
  ' - Nur reale Zahlen aus den letzten 72h zitieren. Wenn Zahl unsicher: setze headcount=null',
  '   und formuliere context mit "laut Bericht" / "berichtet wird".',
  ' - Keine Spekulation, keine erfundenen Firmen, keine erfundenen Quellen.',
  ' - Wenn nichts zu einem Bereich vorliegt: leeres Array statt erfundener Inhalt.',
  ' - "source" ist immer eine Domain-Kurzform wie "handelsblatt.com" oder "tagesschau.de".',
  ' - Stelle sicher: layoffPulse + hiringPulse + deals zusammen ≥ 5 Einträge,',
  '   sonst hat der Recruiter morgens nichts in der Hand.',
].join('\n');

export async function morningBriefHandler(
  req: Request,
  res: Response
): Promise<void> {
  const body = (req.body ?? {}) as Body;
  const role = (body.role ?? 'Senior Recruiter / Talent Acquisition Lead').trim();
  const locale = (body.locale ?? 'de-DE').trim();
  const industries = body.focusIndustries ?? [];
  const regions = body.focusRegions ?? ['DACH', 'Deutschland'];
  const watchlist = (body.watchlist ?? []).slice(0, 25);

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const userPrompt = [
    `Heute ist ${today}.`,
    `Rolle des Empfängers: ${role}.`,
    `Sprache: ${locale}.`,
    industries.length > 0
      ? `Bevorzugte Branchen: ${industries.join(', ')}.`
      : 'Keine Branchenpräferenz — decke das gesamte deutsche Wirtschaftsgeschehen ab.',
    `Region: ${regions.join(', ')}.`,
    watchlist.length > 0
      ? `Watchlist (Firmen die priorisiert werden sollen falls heute relevant): ${watchlist.join(', ')}.`
      : 'Keine spezifische Watchlist — wähle die größten/wichtigsten Bewegungen.',
    '',
    'Liefere das JSON. Keine Erklärung davor oder danach.',
  ].join('\n');

  const r = await completion({
    tier: 'live', // Sonar with web search
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    responseFormatJson: true,
    maxTokens: 1200,
    temperature: 0.2,
  });

  if (!r.ok) {
    res.status(200).json({
      ok: false,
      fellBack: true,
      error: r.error ?? 'live_unavailable',
      brief: deterministicFallback(role, today),
      model: r.model,
    });
    return;
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(r.text);
  } catch {
    // Sonar occasionally wraps in prose — try to recover JSON object
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
    brief:
      parsed && typeof parsed === 'object'
        ? parsed
        : { headline: 'Briefing erhalten — Format unklar', summary: r.text.slice(0, 320), raw: true },
    citations: r.citations ?? [],
    model: r.model,
    usage: r.usage,
    generatedAt: new Date().toISOString(),
  });
}

function deterministicFallback(role: string, today: string) {
  return {
    headline: `${today} · Live-Briefing offline`,
    summary:
      'Sonar (Perplexity) ist gerade nicht erreichbar. Das Dashboard läuft auf seinen eigenen Live-Quellen weiter — Eurostat, ECB, RSS-Wires sind aktiv. Erneuter Versuch in wenigen Minuten.',
    layoffPulse: [],
    hiringPulse: [],
    deals: [],
    macroPulse: `Briefing für ${role} — Live-Engine temporär nicht erreichbar.`,
    watchToday: [
      'Dashboard-Forecast & Wire-Feed sind live verfügbar.',
      'Brief erneut anfordern in 5–10 Minuten.',
    ],
    confidence: 0.3,
  };
}
