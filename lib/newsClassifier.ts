/**
 * News classifier · v1.
 *
 * Layers:
 *   1. Entity extraction — match the headline against an extended
 *      DAX / MDAX / SDAX universe plus the company-master canonical
 *      list. First match wins; longer names are tried first to avoid
 *      "BMW" eating "BMW Group", etc.
 *   2. Signal classification — reuse `lib/signalClassifier.ts` so the
 *      news pipeline produces the exact same `signalType` taxonomy
 *      as the manual `/api/ingest` path. No drift between the two.
 *   3. Breaking-news flag — short-circuited by signal severity
 *      (insolvency / restructuring / mna_*) AND recency (< 6h).
 */

import { COMPANY_MASTER } from '../src/companyMaster/master';
import { classifySignal, type ClassificationResult } from './signalClassifier';
import type { RawNewsItem } from './newsFetcher';
import type { HiringSignalType } from './types';

/**
 * Curated extension to COMPANY_MASTER — well-known DACH companies
 * the classifier should recognise even when they aren't (yet) in the
 * master record. Keep alphabetical-ish, longer/full names first when
 * the same root could double-match (e.g. "Deutsche Bank" vs "Bank").
 */
const EXTENDED_DACH_COMPANIES: ReadonlyArray<{ canonical: string; aliases: string[]; sector?: string; region?: string }> = [
  { canonical: 'UniCredit',          aliases: ['unicredit'], sector: 'Financial Services', region: 'Europe · South' },
  { canonical: 'Commerzbank',        aliases: ['commerzbank'], sector: 'Financial Services', region: 'DACH · West' },
  { canonical: 'Deutsche Bank',      aliases: ['deutsche bank', 'deutsche bank ag'], sector: 'Financial Services', region: 'DACH · West' },
  { canonical: 'Allianz',            aliases: ['allianz', 'allianz se'], sector: 'Financial Services', region: 'DACH · South' },
  { canonical: 'Munich Re',          aliases: ['munich re', 'münchener rück', 'münchener rückversicherung'], sector: 'Financial Services', region: 'DACH · South' },
  { canonical: 'Hannover Rück',      aliases: ['hannover rück', 'hannover re'], sector: 'Financial Services', region: 'DACH · North' },
  { canonical: 'SAP',                aliases: ['sap se', ' sap '], sector: 'Enterprise Software', region: 'DACH · South' },
  { canonical: 'Siemens',            aliases: ['siemens ag', 'siemens energy', 'siemens healthineers', 'siemens'], sector: 'Industrial AI', region: 'DACH · South' },
  { canonical: 'Bosch',              aliases: ['robert bosch', 'bosch gmbh', 'bosch'], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'Volkswagen',         aliases: ['volkswagen', 'vw konzern', 'vw ag'], sector: 'Mobility & Automotive', region: 'DACH · North' },
  { canonical: 'Porsche',            aliases: ['porsche se', 'porsche ag', 'porsche'], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'BMW',                aliases: ['bmw group', 'bmw ag', ' bmw '], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'Mercedes-Benz',      aliases: ['mercedes-benz', 'mercedes benz'], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'Daimler Truck',      aliases: ['daimler truck'], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'Continental',        aliases: ['continental ag', 'continental'], sector: 'Mobility & Automotive', region: 'DACH · North' },
  { canonical: 'ZF Friedrichshafen', aliases: ['zf friedrichshafen', 'zf group'], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'BASF',               aliases: ['basf se', 'basf'], sector: 'Chemicals & Energy', region: 'DACH · West' },
  { canonical: 'Bayer',              aliases: ['bayer ag', 'bayer'], sector: 'Pharma & Healthcare', region: 'DACH · West' },
  { canonical: 'Merck KGaA',         aliases: ['merck kgaa', 'merck darmstadt'], sector: 'Pharma & Healthcare', region: 'DACH · West' },
  { canonical: 'Henkel',             aliases: ['henkel ag', 'henkel kgaa', 'henkel'], sector: 'Consumer Goods', region: 'DACH · West' },
  { canonical: 'Beiersdorf',         aliases: ['beiersdorf'], sector: 'Consumer Goods', region: 'DACH · North' },
  { canonical: 'Adidas',             aliases: ['adidas'], sector: 'Consumer Goods', region: 'DACH · South' },
  { canonical: 'Puma',               aliases: ['puma se', ' puma '], sector: 'Consumer Goods', region: 'DACH · South' },
  { canonical: 'Lufthansa',          aliases: ['deutsche lufthansa', 'lufthansa'], sector: 'Travel & Logistics', region: 'DACH · West' },
  { canonical: 'DHL',                aliases: ['dhl group', 'deutsche post', ' dhl '], sector: 'Travel & Logistics', region: 'DACH · West' },
  { canonical: 'Deutsche Telekom',   aliases: ['deutsche telekom', 'telekom ag'], sector: 'Telecom & Cloud', region: 'DACH · West' },
  { canonical: 'Vodafone',           aliases: ['vodafone deutschland', 'vodafone'], sector: 'Telecom & Cloud', region: 'DACH · West' },
  { canonical: 'Infineon',           aliases: ['infineon technologies', 'infineon'], sector: 'Semiconductors', region: 'DACH · South' },
  { canonical: 'ASML',               aliases: ['asml'], sector: 'Semiconductors', region: 'Europe · NL' },
  { canonical: 'Nordex',             aliases: ['nordex se', 'nordex'], sector: 'Energy & Utilities', region: 'DACH · North' },
  { canonical: 'Encavis',            aliases: ['encavis ag', 'encavis'], sector: 'Energy & Utilities', region: 'DACH · North' },
  { canonical: 'Vestas',             aliases: ['vestas wind systems', 'vestas'], sector: 'Energy & Utilities', region: 'Europe · DK' },
  { canonical: 'E.ON',               aliases: ['e.on', ' eon '], sector: 'Energy & Utilities', region: 'DACH · West' },
  { canonical: 'RWE',                aliases: ['rwe ag', ' rwe '], sector: 'Energy & Utilities', region: 'DACH · West' },
  { canonical: 'EnBW',               aliases: ['enbw'], sector: 'Energy & Utilities', region: 'DACH · South' },
  { canonical: 'ThyssenKrupp',       aliases: ['thyssenkrupp', 'thyssen krupp'], sector: 'Industrial AI', region: 'DACH · West' },
  { canonical: 'Heidelberg Materials', aliases: ['heidelberg materials', 'heidelberg cement'], sector: 'Industrial AI', region: 'DACH · South' },
  { canonical: 'Rheinmetall',        aliases: ['rheinmetall'], sector: 'Defense & Aerospace', region: 'DACH · West' },
  { canonical: 'Hensoldt',           aliases: ['hensoldt'], sector: 'Defense & Aerospace', region: 'DACH · South' },
  { canonical: 'Airbus',             aliases: ['airbus group', 'airbus se', 'airbus'], sector: 'Defense & Aerospace', region: 'Europe · West' },
  { canonical: 'MTU Aero Engines',   aliases: ['mtu aero engines', 'mtu aero'], sector: 'Defense & Aerospace', region: 'DACH · South' },
  { canonical: 'Vonovia',            aliases: ['vonovia se', 'vonovia'], sector: 'Real Estate', region: 'DACH · West' },
  { canonical: 'LEG Immobilien',     aliases: ['leg immobilien'], sector: 'Real Estate', region: 'DACH · West' },
  { canonical: 'Aroundtown',         aliases: ['aroundtown sa', 'aroundtown'], sector: 'Real Estate', region: 'DACH · West' },
  { canonical: 'Knorr-Bremse',       aliases: ['knorr-bremse', 'knorr bremse'], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'Symrise',            aliases: ['symrise ag', 'symrise'], sector: 'Chemicals & Energy', region: 'DACH · North' },
  { canonical: 'Brenntag',           aliases: ['brenntag'], sector: 'Chemicals & Energy', region: 'DACH · West' },
  { canonical: 'Fresenius',          aliases: ['fresenius medical care', 'fresenius se', 'fresenius'], sector: 'Pharma & Healthcare', region: 'DACH · West' },
  { canonical: 'Sartorius',          aliases: ['sartorius ag', 'sartorius'], sector: 'Pharma & Healthcare', region: 'DACH · North' },
  { canonical: 'Qiagen',             aliases: ['qiagen'], sector: 'Pharma & Healthcare', region: 'DACH · West' },
  { canonical: 'Zalando',            aliases: ['zalando se', 'zalando'], sector: 'E-commerce', region: 'DACH · North' },
  { canonical: 'HelloFresh',         aliases: ['hellofresh'], sector: 'E-commerce', region: 'DACH · North' },
  { canonical: 'Delivery Hero',      aliases: ['delivery hero'], sector: 'E-commerce', region: 'DACH · North' },
  { canonical: 'N26',                aliases: [' n26 ', 'n26 bank'], sector: 'Fintech', region: 'DACH · North' },
  { canonical: 'Trade Republic',     aliases: ['trade republic'], sector: 'Fintech', region: 'DACH · North' },
  // Global tech / often referenced in DE wires
  { canonical: 'Apple',              aliases: ['apple inc', ' apple '], sector: 'Tech', region: 'Global · US' },
  { canonical: 'Microsoft',          aliases: ['microsoft corp', 'microsoft'], sector: 'Tech', region: 'Global · US' },
  { canonical: 'Google',             aliases: ['google llc', 'alphabet inc', 'alphabet', 'google'], sector: 'Tech', region: 'Global · US' },
  { canonical: 'Meta',               aliases: ['meta platforms', 'facebook inc', ' meta '], sector: 'Tech', region: 'Global · US' },
  { canonical: 'Amazon',             aliases: ['amazon.com', 'amazon inc', ' amazon '], sector: 'Tech', region: 'Global · US' },
  { canonical: 'Tesla',              aliases: [' tesla '], sector: 'Mobility & Automotive', region: 'Global · US' },
  { canonical: 'Nvidia',             aliases: ['nvidia'], sector: 'Semiconductors', region: 'Global · US' },
  { canonical: 'OpenAI',             aliases: ['openai'], sector: 'Tech', region: 'Global · US' },
  { canonical: 'Netflix',            aliases: ['netflix'], sector: 'Media & Entertainment', region: 'Global · US' },
  { canonical: 'Disney',             aliases: ['walt disney', ' disney '], sector: 'Media & Entertainment', region: 'Global · US' },
  { canonical: 'eBay',               aliases: ['ebay inc', ' ebay '], sector: 'E-commerce', region: 'Global · US' },
  { canonical: 'GameStop',           aliases: ['gamestop'], sector: 'Retail', region: 'Global · US' },
  { canonical: 'Boeing',             aliases: [' boeing '], sector: 'Defense & Aerospace', region: 'Global · US' },
  { canonical: 'Stellantis',         aliases: ['stellantis'], sector: 'Mobility & Automotive', region: 'Europe · West' },
  { canonical: 'Renault',            aliases: ['renault'], sector: 'Mobility & Automotive', region: 'Europe · West' },
  { canonical: 'BNP Paribas',        aliases: ['bnp paribas'], sector: 'Financial Services', region: 'Europe · West' },
  { canonical: 'Société Générale',   aliases: ['société générale', 'societe generale'], sector: 'Financial Services', region: 'Europe · West' },
  { canonical: 'Nestlé',             aliases: ['nestlé', 'nestle'], sector: 'Consumer Goods', region: 'Europe · CH' },
  { canonical: 'Roche',              aliases: ['roche holding', ' roche '], sector: 'Pharma & Healthcare', region: 'Europe · CH' },
  { canonical: 'Novartis',           aliases: ['novartis'], sector: 'Pharma & Healthcare', region: 'Europe · CH' },
  { canonical: 'UBS',                aliases: ['ubs group', ' ubs '], sector: 'Financial Services', region: 'Europe · CH' },
  { canonical: 'Credit Suisse',      aliases: ['credit suisse'], sector: 'Financial Services', region: 'Europe · CH' },
  { canonical: 'Shell',              aliases: ['shell plc', 'royal dutch shell', ' shell '], sector: 'Energy & Utilities', region: 'Europe · NL' },
  { canonical: 'BP',                 aliases: ['bp plc', ' bp '], sector: 'Energy & Utilities', region: 'Europe · UK' },
  { canonical: 'TotalEnergies',      aliases: ['totalenergies', 'total energies'], sector: 'Energy & Utilities', region: 'Europe · West' },
  // German trade / consumer / pharma names commonly in DE wires
  { canonical: 'Rewe',               aliases: ['rewe-gruppe', 'rewe group', 'rewe'], sector: 'Retail', region: 'DACH · West' },
  { canonical: 'Edeka',              aliases: ['edeka'], sector: 'Retail', region: 'DACH · North' },
  { canonical: 'Aldi',               aliases: ['aldi süd', 'aldi nord', 'aldi'], sector: 'Retail', region: 'DACH · West' },
  { canonical: 'Lidl',               aliases: ['lidl'], sector: 'Retail', region: 'DACH · South' },
  { canonical: 'Schwarz Gruppe',     aliases: ['schwarz gruppe', 'schwarz group'], sector: 'Retail', region: 'DACH · South' },
  { canonical: 'DocMorris',          aliases: ['docmorris', 'doc morris'], sector: 'Pharma & Healthcare', region: 'Europe · CH' },
  { canonical: 'Celesio',            aliases: ['celesio'], sector: 'Pharma & Healthcare', region: 'DACH · South' },
  { canonical: 'Audi',               aliases: [' audi '], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'Maybach',            aliases: ['maybach'], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'Alpina',             aliases: ['alpina'], sector: 'Mobility & Automotive', region: 'DACH · South' },
  { canonical: 'Skoda',              aliases: ['skoda', 'škoda'], sector: 'Mobility & Automotive', region: 'Europe · CZ' },
  { canonical: 'SEAT',               aliases: [' seat '], sector: 'Mobility & Automotive', region: 'Europe · West' },
  { canonical: 'Berkshire Hathaway', aliases: ['berkshire hathaway', 'berkshire'], sector: 'Financial Services', region: 'Global · US' },
  { canonical: 'JPMorgan',           aliases: ['jpmorgan', 'jp morgan', 'j.p. morgan'], sector: 'Financial Services', region: 'Global · US' },
  { canonical: 'Goldman Sachs',      aliases: ['goldman sachs'], sector: 'Financial Services', region: 'Global · US' },
  { canonical: 'BlackRock',          aliases: ['blackrock'], sector: 'Financial Services', region: 'Global · US' },
  { canonical: 'TikTok',             aliases: ['tiktok'], sector: 'Tech', region: 'Global · CN' },
  { canonical: 'ByteDance',          aliases: ['bytedance'], sector: 'Tech', region: 'Global · CN' },
  { canonical: 'Spotify',            aliases: ['spotify'], sector: 'Tech', region: 'Europe · SE' },
  { canonical: 'Uber',               aliases: [' uber '], sector: 'Mobility & Automotive', region: 'Global · US' },
  { canonical: 'Bolt',               aliases: [' bolt '], sector: 'Mobility & Automotive', region: 'Europe · East' },
  { canonical: 'Airbnb',             aliases: ['airbnb'], sector: 'Tech', region: 'Global · US' },
  { canonical: 'Otto Group',         aliases: ['otto group', 'otto-konzern'], sector: 'E-commerce', region: 'DACH · North' },
  { canonical: 'Tchibo',             aliases: ['tchibo'], sector: 'Retail', region: 'DACH · North' },
  { canonical: 'Stihl',              aliases: ['stihl'], sector: 'Industrial AI', region: 'DACH · South' },
  { canonical: 'Trumpf',             aliases: ['trumpf'], sector: 'Industrial AI', region: 'DACH · South' },
  { canonical: 'Carl Zeiss',         aliases: ['carl zeiss', 'zeiss '], sector: 'Industrial AI', region: 'DACH · South' },
  { canonical: 'TUI',                aliases: [' tui '], sector: 'Travel & Logistics', region: 'DACH · North' },
  { canonical: 'Fraport',            aliases: ['fraport'], sector: 'Travel & Logistics', region: 'DACH · West' },
  { canonical: 'Deutsche Bahn',      aliases: ['deutsche bahn', ' db ag'], sector: 'Travel & Logistics', region: 'DACH · West' },
  { canonical: 'Flixbus',            aliases: ['flixbus', 'flixmobility'], sector: 'Travel & Logistics', region: 'DACH · South' },
  { canonical: 'Hapag-Lloyd',        aliases: ['hapag-lloyd', 'hapag lloyd'], sector: 'Travel & Logistics', region: 'DACH · North' },
];

/**
 * Generic legal-suffix wildcard matcher. Catches news mentioning a
 * capitalized company name followed by a recognised entity suffix
 * (AG, GmbH, SE, KGaA, Inc, Corp, Ltd, Holding, Group). Used as a
 * last-resort entity extractor when none of the curated names match —
 * this is what surfaces "Globex AG ist insolvent" as a real entity.
 */
const WILDCARD_RE =
  /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9.&+\-/]*(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9.&+\-/]*){0,3})\s+(AG|GmbH(?:\s*&\s*Co\.?\s*KGaA?)?|KGaA|SE|Holding|Group|Konzern|Inc\.?|Corp\.?|Ltd\.?|plc|Plc|S\.A\.|N\.V\.|B\.V\.)\b/;

/**
 * Pre-built lookup table — sorted by alias length descending so a longer
 * alias always wins over a shorter prefix (e.g. "Daimler Truck" before
 * "Daimler"). Aliases are wrapped in word-boundary spaces during match
 * to dodge in-word collisions.
 */
interface ResolvedEntity {
  canonical: string;
  sector?: string;
  region?: string;
}

const ENTITY_INDEX: Array<{ alias: string; canonical: string; sector?: string; region?: string }> = (() => {
  const list: Array<{ alias: string; canonical: string; sector?: string; region?: string }> = [];
  // Master records first
  for (const c of COMPANY_MASTER) {
    list.push({ alias: c.name.toLowerCase(), canonical: c.name, sector: c.sector, region: c.region });
    for (const a of c.aliases) {
      list.push({ alias: a.toLowerCase(), canonical: c.name, sector: c.sector, region: c.region });
    }
  }
  for (const e of EXTENDED_DACH_COMPANIES) {
    list.push({ alias: e.canonical.toLowerCase(), canonical: e.canonical, sector: e.sector, region: e.region });
    for (const a of e.aliases) {
      list.push({ alias: a.toLowerCase(), canonical: e.canonical, sector: e.sector, region: e.region });
    }
  }
  // Longer aliases first
  return list.sort((a, b) => b.alias.length - a.alias.length);
})();

export function extractEntity(text: string): ResolvedEntity | null {
  const t = ` ${text.toLowerCase()} `; // padded for word-boundary safety
  for (const entry of ENTITY_INDEX) {
    if (t.includes(entry.alias)) {
      return {
        canonical: entry.canonical,
        sector: entry.sector,
        region: entry.region,
      };
    }
  }
  // Wildcard fallback — capitalized name followed by a legal suffix.
  // Rules out common false-positives by requiring the name part to be
  // at least 3 chars and not a generic German/English filler word.
  const m = text.match(WILDCARD_RE);
  if (m) {
    const name = m[1].trim();
    const suffix = m[2].trim();
    if (name.length >= 3 && !STOP_HEADS.has(name.toLowerCase())) {
      return { canonical: `${name} ${suffix}` };
    }
  }
  return null;
}

/** Words that look capitalized in headlines but aren't a company. */
const STOP_HEADS = new Set([
  'der', 'die', 'das', 'eine', 'einen', 'mit', 'für', 'von', 'bei',
  'after', 'while', 'when', 'as', 'the', 'a', 'an', 'and', 'or',
  'wirtschaft', 'börse', 'unternehmen', 'firma', 'konzern',
]);

export interface ClassifiedNewsItem {
  source: string;
  sourceLabel: string;
  trust: number;
  title: string;
  description: string;
  link: string;
  publishedAt: string;
  ageHours: number;
  entity: ResolvedEntity;
  signalType: HiringSignalType;
  impact: number;
  confidence: number;
  classification: ClassificationResult;
  /** True for hot, recent, severity-bearing news. */
  breaking: boolean;
  /** Other wires that reported the same (entity × signalType) story. */
  corroboratingSources?: Array<{ source: string; link: string }>;
}

const BREAKING_TYPES = new Set<HiringSignalType>([
  'insolvency',
  'restructuring',
  'mna_buy',
  'mna_sell',
  'funding_grant',
  'gf_change',
]);

export function classifyNewsItem(item: RawNewsItem): ClassifiedNewsItem | null {
  // Entity extraction sees ONLY the title. The description often
  // references tangential third parties ("competitors like Amazon")
  // which would otherwise hijack the entity slot.
  const entity =
    extractEntity(item.title) ?? extractEntity(item.description);
  if (!entity) return null;

  const classification = classifySignal(item.title, item.description);
  if (!classification) return null;

  // Apply source-trust to confidence (don't over-weight unknown blogs).
  const confidence = Math.max(
    0,
    Math.min(1, classification.confidence * item.trust)
  );

  const breaking =
    BREAKING_TYPES.has(classification.signalType) && item.ageHours <= 12;

  return {
    source: item.source,
    sourceLabel: item.sourceLabel,
    trust: item.trust,
    title: item.title,
    description: item.description,
    link: item.link,
    publishedAt: item.publishedAt,
    ageHours: item.ageHours,
    entity,
    signalType: classification.signalType,
    impact: classification.impact,
    confidence,
    classification,
    breaking,
  };
}

export function classifyNewsBatch(items: RawNewsItem[]): ClassifiedNewsItem[] {
  // Group by (entity × signalType) so the same story from multiple wires
  // collapses into a single master record. The most-trusted source wins
  // the headline slot; the others are surfaced via `corroboratingSources`
  // so the UI can show "+2 sources" without re-listing the same story.
  const buckets = new Map<string, ClassifiedNewsItem[]>();

  for (const item of items) {
    const c = classifyNewsItem(item);
    if (!c) continue;
    const key = `${c.entity.canonical}|${c.signalType}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(c);
    buckets.set(key, bucket);
  }

  const out: ClassifiedNewsItem[] = [];
  buckets.forEach((bucket) => {
    // Master = max trust × confidence × recency
    bucket.sort((a, b) => {
      const aw = a.trust * a.confidence * (1 / Math.max(1, a.ageHours));
      const bw = b.trust * b.confidence * (1 / Math.max(1, b.ageHours));
      return bw - aw;
    });
    const master = bucket[0];
    const corroborators = bucket
      .slice(1)
      .map((b) => ({ source: b.sourceLabel, link: b.link }));
    out.push({
      ...master,
      corroboratingSources: corroborators,
    });
  });

  // Newest, breaking, strongest first.
  out.sort((a, b) => {
    if (a.breaking !== b.breaking) return a.breaking ? -1 : 1;
    return +new Date(b.publishedAt) - +new Date(a.publishedAt);
  });

  return out;
}
