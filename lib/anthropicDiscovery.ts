/**
 * Direct LLM-with-web-search discovery layer.
 *
 * Two missions, both opt-in via ANTHROPIC_DISCOVERY_ENABLED=true:
 *
 *   1. Insolvenz + Restructuring (negative signals — Outplacement plays)
 *   2. Hiring + Funding + M&A + Expansion + Leadership (positive signals
 *      — active recruiting opportunities)
 *
 * Each mission caches independently (6h). Whitelabel-clean: every
 * vendor identifier lives only in env vars and internal logs.
 * The CompanySignal surface stays neutral: provider='rsg-discovery'.
 *
 * Architectural notes:
 *   - Not routed through the engine proxy. Claude is a parallel data
 *     source — like Sonar, but with stronger reasoning + citation
 *     hygiene. We use the web_search server tool so Claude grounds
 *     each event in real reportable URLs.
 *   - Hard timeout (60s) — never blocks the dashboard.
 *   - Trust-on-failure: any error → empty list, callers stay drop-in.
 */

import type { CompanySignal, HiringSignalType } from './types';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 60_000;
const CACHE_MS = 6 * 60 * 60 * 1000; // 6h

// ─── shared types ───────────────────────────────────────────────────

interface CacheEntry {
  data: CompanySignal[];
  expiresAt: number;
  fetchedAt: number;
}

const globalForCache = globalThis as unknown as {
  __rsgAnthropicCache?: Record<string, CacheEntry>;
};

interface DiscoveryConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
  windowDays: number;
  maxEvents: number;
  maxSearches: number;
}

function readConfig(): DiscoveryConfig {
  return {
    enabled:
      (process.env.ANTHROPIC_DISCOVERY_ENABLED ?? 'false').toLowerCase() ===
      'true',
    apiKey: process.env.ANTHROPIC_API_KEY?.trim() ?? '',
    model:
      process.env.ANTHROPIC_DISCOVERY_MODEL?.trim() ||
      'claude-haiku-4-5-20251001',
    windowDays: Number(process.env.ANTHROPIC_DISCOVERY_WINDOW_DAYS) || 90,
    maxEvents: Number(process.env.ANTHROPIC_DISCOVERY_MAX_EVENTS) || 30,
    maxSearches: Number(process.env.ANTHROPIC_DISCOVERY_MAX_SEARCHES) || 5,
  };
}

export function isAnthropicDiscoveryConfigured(): boolean {
  const cfg = readConfig();
  return cfg.enabled && cfg.apiKey.length > 0;
}

// ─── mission definitions ────────────────────────────────────────────

interface RawEvent {
  company: string;
  industry?: string;
  bundeslandCode?: string;
  city?: string;
  signalType: HiringSignalType;
  observedAt?: string;
  source?: string;
  affected?: number;
  description?: string;
}

interface Mission {
  /** Cache slot. */
  key: string;
  /** Used to prefix the generated CompanySignal id. */
  idPrefix: string;
  /** System prompt. The user prompt is generic. */
  system: (cfg: DiscoveryConfig) => string;
  /** Whitelist of allowed signalType strings the model may emit. */
  allowedTypes: ReadonlySet<HiringSignalType>;
  /**
   * Map (signalType, hasAffected) → impact (-100..100).
   * Mirrors the weights used elsewhere so derived hiring scores are
   * consistent with classifier-derived signals.
   */
  impactFor: (e: RawEvent) => number;
  /** Confidence baseline; per-event metadata may bump it later. */
  baseConfidence: number;
}

const INSOLVENZ_MISSION: Mission = {
  key: 'insolvenz',
  idPrefix: 'rsg-disc-i',
  allowedTypes: new Set<HiringSignalType>(['insolvency', 'restructuring']),
  baseConfidence: 0.65,
  impactFor: (e) => (e.signalType === 'insolvency' ? -85 : -55),
  system: (cfg) =>
    `Du bist ein DACH-Region (Deutschland, Österreich, Schweiz) Business-Intelligence-Agent für Headhunter und Outplacement-Berater. Du nutzt das web_search Tool um aktuelle Insolvenzanträge, Insolvenzverfahren und Restrukturierungs-Ankündigungen der letzten ${cfg.windowDays} Tage zu finden.

Output: NUR ein einzelnes JSON-Objekt, keine Prosa, keine Markdown-Codeblöcke. Schema:
{
  "events": [
    {
      "company": "Canonical company name",
      "industry": "Industry / sector (German)",
      "bundeslandCode": "Two-letter DE state code (BY/NW/BW/HE/SN/HH/BE/...) or null",
      "city": "Headquarters city",
      "signalType": "insolvency" | "restructuring",
      "observedAt": "YYYY-MM-DD",
      "source": "Real URL of reporting source",
      "affected": 1200,
      "description": "Short German description, max 140 chars"
    }
  ]
}

Regeln:
- Mindestens 3 unterschiedliche Quellen pro Suche.
- Priorisiere Bundesanzeiger / insolvenzbekanntmachungen.de, IHK-News, regionale Tageszeitungen und Tier-1 Wires (Handelsblatt, manager-magazin, Tagesschau, FAZ, Reuters DE).
- Erfinde NICHTS. Wenn nichts gefunden: { "events": [] }.
- Nur DACH-Region.
- "insolvency" für Insolvenzanträge / Insolvenzverfahren.
- "restructuring" für Stellenabbau / Restrukturierungs-Ankündigungen mit Zahlen.
- **Mittelstand-Bias**: Bevorzuge mittelständische Unternehmen (200-5.000 MA) — diese sind für Outplacement-Plays wertvoller als DAX-Konzerne. DAX-Standortabbau nur dann, wenn der lokale Outplacement-Pool klar quantifiziert ist (Werk-Schliessung mit Beschäftigtenzahl).
- Maximal ${cfg.maxEvents} Events.`,
};

const HIRING_MISSION: Mission = {
  key: 'hiring',
  idPrefix: 'rsg-disc-h',
  allowedTypes: new Set<HiringSignalType>([
    'job_spike',
    'employee_growth',
    'funding_grant',
    'mna_buy',
    'mna_sell',
    'location_expansion',
    'new_business_unit',
    'product_launch',
    'gf_change',
    'patent_filing',
  ]),
  baseConfidence: 0.6,
  impactFor: (e) => {
    switch (e.signalType) {
      case 'job_spike':
        return Math.min(80, 30 + (e.affected ?? 0) / 50);
      case 'employee_growth':
        return 55;
      case 'funding_grant':
        return Math.min(90, 50 + Math.log10(Math.max(1, e.affected ?? 1)) * 8);
      case 'mna_buy':
        return 70;
      case 'mna_sell':
        return -25;
      case 'location_expansion':
        return 50;
      case 'new_business_unit':
        return 60;
      case 'product_launch':
        return 35;
      case 'gf_change':
        return 30;
      case 'patent_filing':
        return 20;
      default:
        return 25;
    }
  },
  system: (cfg) =>
    `Du bist ein DACH-Business-Intelligence-Agent für Personaldienstleister. Mission: Finde aktuelle Wachstums- und Hiring-Signale deutschlandweit (mit Österreich + Schweiz) der letzten ${cfg.windowDays} Tage. Nutze das web_search Tool und priorisiere Quellen mit messbaren Zahlen.

Zielsignale (signalType-Werte):
- "job_spike"            (Hiring-Welle / "X neue Stellen / 1.000 Mitarbeiter gesucht")
- "employee_growth"      (Headcount-Wachstum, Personaloffensive)
- "funding_grant"        (Series A/B/C/D, Förderung, Bundeszuschuss — affected = $/€ in Mio)
- "mna_buy"              (Übernahme: Käufer-Seite)
- "mna_sell"             (Übernahme: Target-Seite)
- "location_expansion"   (Standorteröffnung, neuer Hub)
- "new_business_unit"    (Neues BU / Spin-off / Tochter)
- "product_launch"       (Wesentlicher Launch)
- "gf_change"            (Geschäftsführer / C-Level / Vorstandswechsel)
- "patent_filing"        (Substanzielle Patent-Aktivität)

Output: NUR ein einzelnes JSON-Objekt, keine Prosa. Schema:
{
  "events": [
    {
      "company": "Canonical company name",
      "industry": "Industry / sector (German)",
      "bundeslandCode": "Two-letter DE state code (BY/NW/BW/HE/SN/HH/BE/RP/SH/NI/BB/MV/SL/ST/TH) or AT/CH or null",
      "city": "Headquarters city",
      "signalType": "<one of the 10 above>",
      "observedAt": "YYYY-MM-DD",
      "source": "Real URL of reporting source",
      "affected": 250,
      "description": "Short German description, max 140 chars"
    }
  ]
}

Quellen-Priorität (DACH-Mittelstand-Bias):
- Tier 1 (Mittelstand-relevant): Pressebox, OpenPR, IHK-Newsroom-Feeds, regionale Tageszeitungen (z. B. Stuttgarter Zeitung, Westfalenpost, Augsburger Allgemeine, Heilbronner Stimme), VDI Nachrichten, Markt & Mittelstand, Wirtschaftswoche.de Mittelstand, deutsche-startups.de
- Tier 2 (überregional): Handelsblatt, manager-magazin, FAZ Wirtschaft, Süddeutsche Wirtschaft, Tagesschau-Wirtschaft, Reuters DE, Bloomberg DE
- Tier 3 (Branchen-Trade-Press): t3n, Automobilwoche, Logistik-Heute, Lebensmittel-Zeitung, Pharmazeutische Zeitung, Bauwelt, Energie & Management
- Tier 4 (direkte Quellen): Unternehmens-Newsrooms, Geschäftsberichte, Karriere-Seiten

Regeln:
- Mindestens 4 unterschiedliche Quellen verteilt über die Suchen.
- Erfinde NICHTS. Bei Unsicherheit: weglassen.
- **HARTE Mittelstand-Pflicht**: Bevorzuge mittelständische Unternehmen (200-5.000 MA) — Hidden Champions, Familienunternehmen, regionale Marktführer. Kein DAX, kein MDAX, kein TecDAX als Hauptthema außer:
  (a) eine Mittelstands-Tochter ist betroffen (dann die Tochter nennen, nicht den Konzern) ODER
  (b) der Konzern ist Käufer/Verkäufer einer Mittelstands-Firma (dann das Target nennen) ODER
  (c) DAX-Standortabbau mit klarem Outplacement-Pool für Mittelstands-Recruiter.
- **Geografische Verteilung**: Bevorzuge B-Städte und Regionen (Baden-Württemberg ausserhalb Stuttgart, Bayern ausserhalb München, NRW Westfalen-Sauerland, Mittel-/Norddeutschland) gegenüber den Top-3-Metropolen.
- "affected" ist eine Zahl: bei Hiring = Anzahl Stellen, bei Funding = Mio €/$, bei M&A = Deal-Volumen Mio €.
- Maximal ${cfg.maxEvents} Events. Diversifiziere über Branchen.
- Mindestens 5 verschiedene Bundesländer wenn möglich.`,
};

// ─── core call ──────────────────────────────────────────────────────

async function callMission(
  mission: Mission,
  cfg: DiscoveryConfig
): Promise<RawEvent[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 6_000,
        system: mission.system(cfg),
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: cfg.maxSearches,
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Suche jetzt. Liefere bis zu ${cfg.maxEvents} Events der letzten ${cfg.windowDays} Tage als JSON.`,
          },
        ],
      }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[discovery:${mission.key}] http ${res.status}: ${(await res
          .text()
          .catch(() => ''))
          .slice(0, 200)}`
      );
      return [];
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const textBlocks = (data.content ?? []).filter(
      (b): b is { type: 'text'; text: string } =>
        b.type === 'text' && typeof b.text === 'string'
    );
    const last = textBlocks[textBlocks.length - 1]?.text?.trim();
    if (!last) return [];
    const cleaned = last.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    let parsed: { events?: RawEvent[] };
    try {
      parsed = JSON.parse(cleaned) as typeof parsed;
    } catch {
      return [];
    }
    if (!Array.isArray(parsed.events)) return [];
    return parsed.events
      .filter(
        (e) =>
          e &&
          typeof e.company === 'string' &&
          e.company.trim().length > 0 &&
          mission.allowedTypes.has(e.signalType)
      )
      .slice(0, cfg.maxEvents);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[discovery:${mission.key}] call failed`,
      (err as Error).message
    );
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ─── helpers ────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöüß]/g, (ch) =>
      ch === 'ä' ? 'ae' : ch === 'ö' ? 'oe' : ch === 'ü' ? 'ue' : 'ss'
    )
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function eventToSignal(
  mission: Mission,
  e: RawEvent,
  idx: number
): CompanySignal {
  const slug = slugify(e.company);
  const observed = e.observedAt
    ? (() => {
        try {
          return new Date(`${e.observedAt}T12:00:00Z`).toISOString();
        } catch {
          return new Date().toISOString();
        }
      })()
    : new Date().toISOString();
  return {
    id: `${mission.idPrefix}-${slug || `x${idx}`}-${e.signalType}`,
    companyId: slug || `discovered-${idx}`,
    provider: 'rsg-discovery',
    signalType: e.signalType,
    impact: Math.round(mission.impactFor(e)),
    confidence: mission.baseConfidence,
    observedAt: observed,
    meta: {
      title: e.description ?? `${e.company} — ${e.signalType}`,
      description: e.description ?? '',
      source: e.source ?? 'rsg-discovery',
      url: e.source ?? '',
      bundesland: e.bundeslandCode ?? '',
      headquarters: e.city ?? '',
      industry: e.industry ?? '',
      companyName: e.company,
      affected: typeof e.affected === 'number' ? e.affected : null,
      provider: 'rsg-discovery',
    },
  };
}

async function runMission(mission: Mission): Promise<CompanySignal[]> {
  const cfg = readConfig();
  if (!cfg.enabled || !cfg.apiKey) return [];

  const cache =
    globalForCache.__rsgAnthropicCache ??
    (globalForCache.__rsgAnthropicCache = {});
  const now = Date.now();
  const hit = cache[mission.key];
  if (hit && hit.expiresAt > now) {
    return hit.data;
  }
  const events = await callMission(mission, cfg);
  const signals = events.map((e, i) => eventToSignal(mission, e, i));
  cache[mission.key] = {
    data: signals,
    expiresAt: now + CACHE_MS,
    fetchedAt: now,
  };
  return signals;
}

// ─── public API ─────────────────────────────────────────────────────

/** Insolvenz + Restructuring focus — used by /api/insolvenz-pulse. */
export function discoverInsolvenzAnthropic(): Promise<CompanySignal[]> {
  return runMission(INSOLVENZ_MISSION);
}

/** Hiring + funding + M&A + expansion + leadership — fed into the
 *  global signal pool used by Companies / Sectors / Regions / Today. */
export function discoverHiringAnthropic(): Promise<CompanySignal[]> {
  return runMission(HIRING_MISSION);
}

/** Combined feed — both missions run in parallel, returned merged. */
export async function discoverAllAnthropic(): Promise<CompanySignal[]> {
  const cfg = readConfig();
  if (!cfg.enabled || !cfg.apiKey) return [];
  const [insolvenz, hiring] = await Promise.all([
    discoverInsolvenzAnthropic().catch(() => [] as CompanySignal[]),
    discoverHiringAnthropic().catch(() => [] as CompanySignal[]),
  ]);
  return [...insolvenz, ...hiring];
}
