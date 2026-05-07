/**
 * Direct Anthropic discovery layer — fills data gaps the RSS classifier
 * leaves open. Specifically targets DACH insolvency / restructuring
 * events using Claude with the web_search server tool.
 *
 * Architecture choice:
 *   - This is intentionally *not* routed through the engine proxy.
 *     Claude is a parallel data source, like Sonar but with stronger
 *     reasoning and citation hygiene.
 *   - Cached aggressively (6h) — insolvency events are slow-moving
 *     and the call is the most expensive in the stack ($0.10–0.20).
 *   - Whitelabel-clean: vendor strings live only in env vars and
 *     internal logs. The CompanySignal surface stays neutral —
 *     `provider: 'rsg-discovery'`, no Anthropic/Claude references.
 */

import type { CompanySignal, HiringSignalType } from './types';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 60_000;
const CACHE_MS = 6 * 60 * 60 * 1000; // 6h

interface DiscoveryEvent {
  company: string;
  industry?: string;
  bundeslandCode?: string;
  city?: string;
  eventType: 'insolvency' | 'restructuring';
  observedAt: string;
  source?: string;
  affected?: number;
  description?: string;
}

interface CacheEntry {
  data: CompanySignal[];
  expiresAt: number;
  fetchedAt: number;
}

const globalForCache = globalThis as unknown as {
  __rsgAnthropicInsolvCache?: CacheEntry;
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

const SYSTEM_PROMPT = `Du bist ein DACH-Region (Deutschland, Österreich, Schweiz) Business-Intelligence-Agent für Headhunter und Outplacement-Berater. Du nutzt das web_search Tool um aktuelle Insolvenzanträge, Insolvenzverfahren und Restrukturierungs-Ankündigungen zu finden.

Output: NUR ein einzelnes JSON-Objekt, keine Prosa, keine Markdown-Codeblöcke. Schema:
{
  "events": [
    {
      "company": "Canonical company name",
      "industry": "Industry / sector (German)",
      "bundeslandCode": "Two-letter DE state code (BY/NW/BW/HE/SN/...) or null",
      "city": "Headquarters city",
      "eventType": "insolvency" | "restructuring",
      "observedAt": "YYYY-MM-DD",
      "source": "Real URL of reporting source",
      "affected": 1200,
      "description": "Short German description, max 140 chars"
    }
  ]
}

Regeln:
- Nutze mindestens 3 unterschiedliche Quellen pro Suche.
- Priorisiere offizielle Bundesanzeiger / insolvenzbekanntmachungen.de und Tier-1 Wires (Handelsblatt, manager-magazin, Tagesschau, FAZ, Reuters DE).
- Erfinde NICHTS. Wenn nichts gefunden: { "events": [] }.
- Nur DACH-Region.
- "insolvency" für Insolvenzanträge / Insolvenzverfahren.
- "restructuring" für Stellenabbau / Restrukturierungs-Ankündigungen.`;

async function callDiscovery(cfg: DiscoveryConfig): Promise<DiscoveryEvent[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const userPrompt = `Finde DACH-Insolvenzen und Restrukturierungen der letzten ${cfg.windowDays} Tage. Maximal ${cfg.maxEvents} Events. Fokus: Mitarbeiter-Abbau-relevant.`;
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
        max_tokens: 4_000,
        system: SYSTEM_PROMPT,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: cfg.maxSearches,
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[discovery] http ${res.status}: ${(await res
          .text()
          .catch(() => ''))
          .slice(0, 200)}`
      );
      return [];
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    // The API emits tool_use + tool_result + final text blocks. The
    // JSON we want is in the trailing text — collect last text block.
    const textBlocks = (data.content ?? []).filter(
      (b): b is { type: 'text'; text: string } =>
        b.type === 'text' && typeof b.text === 'string'
    );
    const last = textBlocks[textBlocks.length - 1]?.text?.trim();
    if (!last) return [];
    const cleaned = last.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    let parsed: { events?: DiscoveryEvent[] };
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
          (e.eventType === 'insolvency' || e.eventType === 'restructuring')
      )
      .slice(0, cfg.maxEvents);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[discovery] call failed', (err as Error).message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

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

function eventToSignal(e: DiscoveryEvent, idx: number): CompanySignal {
  const signalType: HiringSignalType =
    e.eventType === 'insolvency' ? 'insolvency' : 'restructuring';
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
    id: `rsg-disc-${slug || `i${idx}`}-${signalType}`,
    companyId: slug || `discovered-${idx}`,
    provider: 'rsg-discovery',
    signalType,
    impact: signalType === 'insolvency' ? -85 : -55,
    confidence: 0.65,
    observedAt: observed,
    meta: {
      title: e.description ?? `${e.company} — ${signalType}`,
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

/**
 * Public API. Returns CompanySignal[] in the same shape as the rest
 * of the pipeline so callers can merge results without translation.
 * No-op when disabled or unconfigured.
 */
export async function discoverInsolvenzAnthropic(): Promise<CompanySignal[]> {
  const cfg = readConfig();
  if (!cfg.enabled || !cfg.apiKey) return [];

  const now = Date.now();
  const cached = globalForCache.__rsgAnthropicInsolvCache;
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const events = await callDiscovery(cfg);
  const signals = events.map(eventToSignal);
  globalForCache.__rsgAnthropicInsolvCache = {
    data: signals,
    expiresAt: now + CACHE_MS,
    fetchedAt: now,
  };
  return signals;
}
