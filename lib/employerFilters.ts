/**
 * lib/employerFilters.ts
 *
 * Filtert Personaldienstleister, Zeitarbeitsfirmen und Personalberater
 * aus den Top-Arbeitgeber-Listen des Jobs-Tabs. Reine String-Match-
 * Heuristik — kein LLM-Call, kein Netzwerk-Roundtrip — deterministisch
 * und unit-getestet.
 *
 * Drei Stufen:
 *
 *   1. CORPORATE_INHOUSE_PREFIXES  — Whitelist. Konzern-interne
 *      "Dienstleistungs"-Töchter (z. B. "Lidl Dienstleistung GmbH",
 *      "REWE International Dienstleistungsgesellschaft mbH") sind
 *      ECHTES Hiring und damit Sales-relevant. Wenn der Name mit
 *      einem dieser Präfixe beginnt, ist er KEIN Personaldienstleister
 *      — egal was die Keyword-Regex sagt.
 *
 *   2. PDL_BLACKLIST                — Hard Drop. Bekannte DACH-PDLs,
 *      Zeitarbeitskonzerne und Executive-Search-Boutiquen, normalisiert
 *      auf lowercase ohne Rechtsform-Suffix.
 *
 *   3. PDL_KEYWORD_PATTERNS         — Heuristik. Erkennt typische
 *      Namensbestandteile (Personaldienstleist*, Zeitarbeit,
 *      Personalvermittl*, Executive Search, Headhunt*, …) sobald die
 *      Whitelist nicht greift.
 *
 * Whitelabel-Notiz: alle Strings in dieser Datei sind Branchen-Begriffe
 * oder Firmen-Namen aus öffentlich bekannten Quellen — keine Vendor-
 * Identifier (OpenAI/Anthropic/Claude/…).
 */

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const RECHTSFORMEN = [
  'gmbh & co. kg',
  'gmbh & co kg',
  'se & co. kg',
  'se & co kg',
  'se & co. ohg',
  'se & co ohg',
  'gmbh & co.kgaa',
  'gmbh & co. kgaa',
  'gesellschaft mbh',
  'gesellschaft m.b.h.',
  'gmbh',
  'ag',
  'kgaa',
  'kg',
  'ohg',
  'mbh',
  'se',
  'eg',
  'e.k.',
  'ek',
];

function stripRechtsform(s: string): string {
  let out = s;
  // Strip trailing legal forms iteratively (handles "GmbH & Co. KG" first).
  let changed = true;
  while (changed) {
    changed = false;
    for (const rf of RECHTSFORMEN) {
      const re = new RegExp(`(\\s|,|\\.|-)+${rf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b\\s*$`, 'i');
      if (re.test(out)) {
        out = out.replace(re, '');
        changed = true;
        break;
      }
    }
  }
  return out;
}

/** Normalisiert einen Firmennamen für Vergleich + Lookup. */
export function normaliseEmployerName(raw: string): string {
  return stripRechtsform(
    raw
      .trim()
      .toLowerCase()
      .replace(/[­​‌‍]/g, '') // soft hyphen + zero-width
      .replace(/[.,;:!?'`’ʼ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  ).trim();
}

// ---------------------------------------------------------------------------
// 1. Corporate-Inhouse-Whitelist
// ---------------------------------------------------------------------------

/**
 * Konzern-Präfixe, deren "Dienstleistungs"-Töchter ECHTES Hiring sind.
 * Match ist Wort-präfix-basiert: der normalisierte Firmenname muss mit
 * einem dieser Tokens beginnen.
 */
export const CORPORATE_INHOUSE_PREFIXES: readonly string[] = [
  'lidl',
  'aldi süd',
  'aldi nord',
  'aldi',
  'rewe',
  'edeka',
  'kaufland',
  'schwarz',
  'penny',
  'netto',
  'real',
  'bmw',
  'daimler',
  'mercedes',
  'mercedes-benz',
  'volkswagen',
  'vw',
  'porsche',
  'audi',
  'siemens',
  'bosch',
  'robert bosch',
  'thyssenkrupp',
  'thyssen krupp',
  'sap',
  'bayer',
  'basf',
  'henkel',
  'continental',
  'zf friedrichshafen',
  'zf',
  'mahle',
  'lufthansa',
  'deutsche bahn',
  'db',
  'deutsche post',
  'deutsche telekom',
  'allianz',
  'munich re',
  'munich-re',
  'eon',
  'e.on',
  'rwe',
  'enbw',
  'vattenfall',
  'edeka zentrale',
];

const corporatePrefixSet = new Set(
  CORPORATE_INHOUSE_PREFIXES.map((p) => p.toLowerCase()),
);

/**
 * Returns true when the normalised name starts with a known
 * corporate-group prefix. We tokenise on whitespace so "lidl"
 * matches "lidl dienstleistung gmbh" but not "lidlomatic gmbh".
 */
export function isCorporateInhouseSubsidiary(rawName: string): boolean {
  const normalised = normaliseEmployerName(rawName);
  if (!normalised) return false;
  for (const prefix of corporatePrefixSet) {
    if (normalised === prefix) return true;
    if (normalised.startsWith(`${prefix} `)) return true;
    if (normalised.startsWith(`${prefix}-`)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 2. Blacklist
// ---------------------------------------------------------------------------

/**
 * Bekannte DACH-Personaldienstleister, Zeitarbeitsfirmen und
 * Executive-Search-Boutiquen. Stand 2026. Match ist normalisierter
 * Vollname (ohne Rechtsform-Suffix).
 */
export const PDL_BLACKLIST: ReadonlySet<string> = new Set([
  'randstad',
  'randstad deutschland',
  'dis',
  'dis ag',
  'dis ag germany',
  'dis deutscher industrie service',
  'adecco',
  'manpower',
  'manpowergroup',
  'hays',
  'hays talent',
  'hays talent solutions',
  'michael page',
  'page personnel',
  'pagegroup',
  'robert half',
  'kelly services',
  'kelly',
  'brunel',
  'orizon',
  'persona service',
  'persona',
  'tempton',
  'piening',
  'piening personal',
  'i k hofmann',
  'i.k. hofmann',
  'hofmann personal',
  'trenkwalder',
  'experis',
  'akquinet personal',
  'arwa',
  'arwa personaldienstleistungen',
  'timepartner',
  'timepartner personalmanagement',
  'office people',
  'avantgarde experts',
  'gulp',
  'gulp information services',
  'amadeus fire',
  'licavital',
  'rocket match',
  'rocket match powered by notificai',
  'notificai',
  'stepstone',
  'indeed flexability',
  'dekra arbeit',
  'gi group',
  'adesta personal',
  'zeitkonzepte',
  'jobimpulse',
  'capera',
  'kienbaum',
  'kienbaum executive',
  'heidrick',
  'heidrick struggles',
  'heidrick & struggles',
  'korn ferry',
  'egon zehnder',
  'eurosearch',
  'lhh',
  'lee hecht harrison',
  'raven51',
  'absolventa',
  'absolventa staffing',
  'von rundstedt',
  'milch & zucker',
  'milch zucker',
  'signium',
  'addecco',
  'unique personal',
  'unique personalservice',
]);

// ---------------------------------------------------------------------------
// 3. Keyword regexes
// ---------------------------------------------------------------------------

/**
 * Regex-Heuristik, die nur greift wenn der Name NICHT auf der
 * Corporate-Inhouse-Whitelist steht. Case-insensitive Word-Boundary-
 * Matches; bewusst eng formuliert um False-Positives ("Lidl
 * Dienstleistung GmbH") zu vermeiden.
 */
export const PDL_KEYWORD_PATTERNS: readonly RegExp[] = [
  /\bpersonaldienstleist/i,
  /\bzeitarbeit/i,
  /\bpersonalvermittl/i,
  /\bpersonalberatung/i,
  /\bpersonalmanagement/i,
  /\bpersonalservice/i,
  /\bexecutive search\b/i,
  /\bheadhunt/i,
  /\brecruiting\s+(gmbh|ag|kg|services|solutions|partners|group)\b/i,
  /\bstaffing\s+(gmbh|ag|kg|services|solutions|group)\b/i,
  /\btalent\s+(acquisition|partners|solutions|sourcing|consulting)\b/i,
  /\bhr\s+(solutions|services|partners|consulting)\b/i,
  /\bworkforce\s+solutions\b/i,
  /\bpersonalrecruiting\b/i,
  /\bjob\s+agentur\b/i,
  /\bjobagentur\b/i,
  /\b(temp|interim)\s+(staffing|services|management)\b/i,
];

// ---------------------------------------------------------------------------
// Predicate
// ---------------------------------------------------------------------------

/**
 * Liefert true, wenn `name` ein Personaldienstleister / Recruiter /
 * Executive-Search-Anbieter ist. Whitelist (Corporate Inhouse) hat
 * Vorrang vor Keyword-Heuristik.
 */
export function isPersonaldienstleister(name: string): boolean {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (!trimmed) return false;

  // Step 1: Whitelist wins early. "Lidl Dienstleistung GmbH" → false.
  if (isCorporateInhouseSubsidiary(trimmed)) return false;

  const normalised = normaliseEmployerName(trimmed);

  // Step 2: Hard blacklist.
  if (PDL_BLACKLIST.has(normalised)) return true;
  // Also check the un-normalised (rechtsform-stripped only) variant for
  // edge cases where dot/comma normalisation collapses too aggressively.
  if (PDL_BLACKLIST.has(normalised.replace(/\s+/g, ' '))) return true;

  // Step 3: Keyword heuristics, scanned against both the raw trimmed
  // form (preserves capitalisation for boundary semantics) and the
  // normalised form (for forms that strip punctuation).
  for (const re of PDL_KEYWORD_PATTERNS) {
    if (re.test(trimmed) || re.test(normalised)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Filter helper
// ---------------------------------------------------------------------------

export interface FilterReport<T> {
  keep: T[];
  dropped: T[];
}

/**
 * Wendet `isPersonaldienstleister` auf eine Liste von Items mit
 * `name`-Feld an. Reihenfolge in `keep` ist stabil gegenüber Input.
 */
export function filterB2BEmployers<T extends { name: string }>(
  items: T[],
): FilterReport<T> {
  const keep: T[] = [];
  const dropped: T[] = [];
  for (const it of items) {
    if (isPersonaldienstleister(it.name)) dropped.push(it);
    else keep.push(it);
  }
  return { keep, dropped };
}
