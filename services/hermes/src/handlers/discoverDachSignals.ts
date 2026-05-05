/**
 * /discover-dach-signals · live LLM-driven DACH hiring intelligence.
 *
 * Bursts the Top-DACH news/web with a single call to the live tier
 * (default openai/gpt-4o-mini:online — gpt-4o-mini with the OpenRouter
 * web plugin enabled). The model is asked to return ~30 structured
 * `DiscoveredSignal` objects covering hiring spikes, M&A, funding,
 * restructuring, expansion etc. across DACH sectors + Bundesländer.
 *
 * Output is strictly validated server-side: signalType must be one of
 * the allowed taxonomy values, impact and confidence are clamped, and
 * obviously hallucinated entries (no companyName, no signalType) drop
 * out of the response. The caller (Vercel `lib/mockData.getDiscoveredSignals`)
 * caches the result for ~10 min so the cost of one OpenRouter call is
 * amortised over thousands of dashboard reads.
 *
 * Cost ballpark: gpt-4o-mini:online ≈ $0.001 / call. Cached 10 min
 * means ≤ 144 calls / day = ~$0.15 / day = ~$4.50 / month.
 */

import type { Request, Response } from 'express';
import { completion } from '../openrouter';

interface DiscoverInput {
  market?: 'DACH' | 'global';
  maxSignals?: number;
  /** Optional sector hints to bias the search. */
  focusSectors?: string[];
}

export interface DiscoveredSignal {
  companyName: string;
  sector: string;
  headquarters: string;
  region: string;
  bundesland?: string;
  signalType: string;
  title: string;
  description: string;
  source: string;
  sourceUrl?: string;
  impact: number;
  confidence: number;
  publishedAt: string;
}

const ALLOWED_SIGNAL_TYPES = new Set([
  'mna_buy',
  'mna_sell',
  'gf_change',
  'patent_filing',
  'location_expansion',
  'funding_grant',
  'press_release',
  'restructuring',
  'insolvency',
  'job_spike',
  'employee_growth',
  'product_launch',
  'new_business_unit',
]);

const ALLOWED_SECTORS = [
  'Industrial AI',
  'Mobility & Automotive',
  'Financial Services',
  'Pharma & Healthcare',
  'Consumer Goods',
  'Retail',
  'Travel & Logistics',
  'Telecom & Cloud',
  'Semiconductors',
  'Energy & Utilities',
  'Defense & Aerospace',
  'Real Estate',
  'Chemicals & Energy',
  'E-commerce',
  'Fintech',
  'Media & Entertainment',
  'Tech',
];

const ALLOWED_BUNDESLAND = new Set([
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
  'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
]);

const SYSTEM_PROMPT = `Du bist Spezialist für DACH-Hiring-Intelligence. Du durchsuchst aktuelle deutsche, österreichische und schweizer Wirtschaftsnachrichten der LETZTEN 14 TAGE und extrahierst strukturierte Hiring-/M&A-/Restructuring-Signale.

Output: STRIKT-VALIDES JSON, exakt dieses Schema:
{
  "signals": [
    {
      "companyName": "<echter Firmenname>",
      "sector": "<einer aus: Industrial AI, Mobility & Automotive, Financial Services, Pharma & Healthcare, Consumer Goods, Retail, Travel & Logistics, Telecom & Cloud, Semiconductors, Energy & Utilities, Defense & Aerospace, Real Estate, Chemicals & Energy, E-commerce, Fintech, Media & Entertainment, Tech>",
      "headquarters": "<Stadt-Name z.B. München, Wolfsburg, Wien, Zürich>",
      "region": "<einer aus: DACH · North, DACH · South, DACH · West, DACH · East, Europe · CH, Europe · AT, Global · US>",
      "bundesland": "<Bundesland-Code: BY, BW, NW, NI, HE, RP, SH, HH, HB, BE, BB, MV, SN, ST, TH, SL — nur für deutsche Firmen>",
      "signalType": "<EXAKT einer aus: mna_buy, mna_sell, gf_change, patent_filing, location_expansion, funding_grant, press_release, restructuring, insolvency, job_spike, employee_growth, product_launch, new_business_unit>",
      "title": "<5-15 Wörter Headline>",
      "description": "<1-2 Sätze, max 200 Zeichen>",
      "source": "<Publikation z.B. Handelsblatt, manager-magazin, Spiegel, FAZ, NZZ, Standard, Bilanz>",
      "sourceUrl": "<vollständige URL falls bekannt>",
      "impact": <Zahl -100..+100, NEGATIV für layoff/restructuring/insolvency, POSITIV für hiring/expansion/funding>,
      "confidence": <0.0..1.0>,
      "publishedAt": "<ISO 8601 Datum>"
    }
  ]
}

REGELN (kritisch):
- NUR ECHTE Firmen aus Web-Search-Ergebnissen — KEINE erfundenen Namen
- KEINE erfundenen URLs oder Quellen
- Verteile auf 8-12 verschiedene SEKTOREN für Diversität (NICHT nur Mobility oder nur Finance)
- Verteile auf möglichst viele BUNDESLÄNDER (Bayern, BW, NRW, Niedersachsen, Hessen, Hamburg, Berlin, Sachsen etc.)
- Nutze ECHTE deutsche Firmen jenseits DAX-40: Mittelstand, Hidden Champions, Familienunternehmen
- Bei DACH-North/South/West/East: nutze die geografische Verteilung der HQ-Stadt`;

const MIN_SIGNALS = 10;
const MAX_SIGNALS_CAP = 50;
const DEFAULT_MAX = 30;

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function clampFloat(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateSignal(raw: unknown): DiscoveredSignal | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.companyName)) return null;
  if (!isStr(r.signalType)) return null;
  const signalType = r.signalType.trim();
  if (!ALLOWED_SIGNAL_TYPES.has(signalType)) return null;

  const sector = isStr(r.sector) ? r.sector.trim() : 'Tech';
  const region = isStr(r.region) ? r.region.trim() : 'DACH · West';
  const headquarters = isStr(r.headquarters) ? r.headquarters.trim() : '';
  const bundesland = isStr(r.bundesland) ? r.bundesland.trim().toUpperCase() : undefined;
  const validBundesland =
    bundesland && ALLOWED_BUNDESLAND.has(bundesland) ? bundesland : undefined;

  const title = isStr(r.title) ? r.title.trim().slice(0, 200) : '';
  const description = isStr(r.description) ? r.description.trim().slice(0, 400) : '';
  const source = isStr(r.source) ? r.source.trim() : 'unknown';
  const sourceUrl = isStr(r.sourceUrl) ? r.sourceUrl.trim() : undefined;
  const publishedAt =
    isStr(r.publishedAt) && !Number.isNaN(Date.parse(r.publishedAt))
      ? new Date(r.publishedAt).toISOString()
      : new Date().toISOString();

  return {
    companyName: r.companyName.trim(),
    sector: ALLOWED_SECTORS.includes(sector) ? sector : 'Tech',
    headquarters,
    region,
    bundesland: validBundesland,
    signalType,
    title,
    description,
    source,
    sourceUrl,
    impact: clampInt(r.impact, -100, 100, 0),
    confidence: clampFloat(r.confidence, 0, 1, 0.5),
    publishedAt,
  };
}

export async function discoverDachSignalsHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as DiscoverInput;
  const market = body.market === 'global' ? 'global' : 'DACH';
  const maxSignals = clampInt(body.maxSignals, MIN_SIGNALS, MAX_SIGNALS_CAP, DEFAULT_MAX);
  const focus =
    Array.isArray(body.focusSectors) && body.focusSectors.length
      ? body.focusSectors.filter(isStr).join(', ')
      : '';

  const userPrompt = focus
    ? `Finde ${maxSignals} aktuelle Hiring-/M&A-/Restructuring-Signale aus DACH-Wirtschaftsnachrichten (letzte 14 Tage). Fokus auf Sektoren: ${focus}. Diversifiziere geografisch über Bundesländer.`
    : `Finde ${maxSignals} aktuelle Hiring-/M&A-/Restructuring-Signale aus DACH-Wirtschaftsnachrichten (letzte 14 Tage). Verteile auf 8-12 verschiedene SEKTOREN UND möglichst viele Bundesländer für Diversität. Mische Großkonzerne mit Mittelstand und Hidden Champions.`;

  const result = await completion({
    tier: 'live',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 4000,
    responseFormatJson: true,
    temperature: 0.3,
  });

  if (!result.ok) {
    res.status(200).json({
      ok: false,
      fellBack: true,
      market,
      maxSignals,
      error: result.error,
      model: result.model,
      signals: [],
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  let parsed: { signals?: unknown[] } | null = null;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    res.status(200).json({
      ok: false,
      fellBack: true,
      market,
      maxSignals,
      error: 'invalid_json',
      rawPreview: result.text.slice(0, 400),
      model: result.model,
      signals: [],
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  const rawSignals = Array.isArray(parsed?.signals) ? parsed.signals : [];
  const validated: DiscoveredSignal[] = [];
  for (const s of rawSignals) {
    const v = validateSignal(s);
    if (v) validated.push(v);
    if (validated.length >= maxSignals) break;
  }

  res.status(200).json({
    ok: true,
    market,
    maxSignals,
    rawCount: rawSignals.length,
    validatedCount: validated.length,
    signals: validated,
    model: result.model,
    citations: result.citations ?? [],
    usage: result.usage,
    generatedAt: new Date().toISOString(),
  });
}
