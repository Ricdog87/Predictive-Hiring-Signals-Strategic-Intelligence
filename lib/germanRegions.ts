/**
 * German regions · v1.
 *
 * Two-level taxonomy used across the dashboard:
 *
 *   Quadrant (4)  ─┬─ Nord:  SH, HH, HB, NI, MV
 *                  ├─ Ost:   BE, BB, ST, SN, TH
 *                  ├─ Süd:   BY, BW
 *                  └─ West:  NW, HE, RP, SL
 *
 *   Bundesland (16) — full canonical names + ISO 3166-2:DE codes +
 *   Eurostat NUTS-1 codes (used for the Eurostat regional API).
 *
 * Every record carries the major cities (lower-cased) that should
 * resolve to that Land — used by `cityToLand()` to turn raw company
 * headquarters strings ("Hamburg, DE", "Stuttgart, Germany") into a
 * canonical Bundesland id.
 */

export type Quadrant = 'nord' | 'ost' | 'sued' | 'west';

export interface BundeslandRecord {
  /** ISO 3166-2:DE code without the "DE-" prefix, e.g. "BY". */
  code: string;
  /** Eurostat NUTS-1 code, e.g. "DE2" for Bayern. */
  nuts: string;
  /** Canonical German name, e.g. "Bayern". */
  name: string;
  /** Quadrant assignment. */
  quadrant: Quadrant;
  /** Major / capital cities (lower-cased, no trailing country). */
  cities: string[];
  /** Approximate population — used for relative weighting only. */
  population: number;
}

export const BUNDESLAENDER: BundeslandRecord[] = [
  {
    code: 'BW',
    nuts: 'DE1',
    name: 'Baden-Württemberg',
    quadrant: 'sued',
    cities: ['stuttgart', 'mannheim', 'karlsruhe', 'freiburg', 'heidelberg', 'tübingen', 'tuebingen', 'ulm', 'heilbronn', 'pforzheim', 'reutlingen'],
    population: 11_280_000,
  },
  {
    code: 'BY',
    nuts: 'DE2',
    name: 'Bayern',
    quadrant: 'sued',
    cities: ['münchen', 'munich', 'muenchen', 'nürnberg', 'nuernberg', 'augsburg', 'regensburg', 'würzburg', 'wuerzburg', 'ingolstadt', 'fürth', 'fuerth', 'erlangen', 'bayreuth', 'aschaffenburg', 'bamberg', 'landshut'],
    population: 13_180_000,
  },
  {
    code: 'BE',
    nuts: 'DE3',
    name: 'Berlin',
    quadrant: 'ost',
    cities: ['berlin'],
    population: 3_770_000,
  },
  {
    code: 'BB',
    nuts: 'DE4',
    name: 'Brandenburg',
    quadrant: 'ost',
    cities: ['potsdam', 'cottbus', 'brandenburg', 'frankfurt (oder)', 'frankfurt oder'],
    population: 2_540_000,
  },
  {
    code: 'HB',
    nuts: 'DE5',
    name: 'Bremen',
    quadrant: 'nord',
    cities: ['bremen', 'bremerhaven'],
    population: 680_000,
  },
  {
    code: 'HH',
    nuts: 'DE6',
    name: 'Hamburg',
    quadrant: 'nord',
    cities: ['hamburg'],
    population: 1_900_000,
  },
  {
    code: 'HE',
    nuts: 'DE7',
    name: 'Hessen',
    quadrant: 'west',
    cities: ['frankfurt', 'frankfurt am main', 'wiesbaden', 'kassel', 'darmstadt', 'offenbach', 'gießen', 'giessen', 'fulda', 'marburg'],
    population: 6_290_000,
  },
  {
    code: 'MV',
    nuts: 'DE8',
    name: 'Mecklenburg-Vorpommern',
    quadrant: 'nord',
    cities: ['rostock', 'schwerin', 'neubrandenburg', 'stralsund', 'greifswald', 'wismar'],
    population: 1_610_000,
  },
  {
    code: 'NI',
    nuts: 'DE9',
    name: 'Niedersachsen',
    quadrant: 'nord',
    cities: ['hannover', 'hanover', 'braunschweig', 'oldenburg', 'osnabrück', 'osnabrueck', 'wolfsburg', 'göttingen', 'goettingen', 'salzgitter', 'hildesheim', 'celle'],
    population: 8_010_000,
  },
  {
    code: 'NW',
    nuts: 'DEA',
    name: 'Nordrhein-Westfalen',
    quadrant: 'west',
    cities: ['köln', 'koeln', 'cologne', 'düsseldorf', 'duesseldorf', 'dortmund', 'essen', 'duisburg', 'bochum', 'wuppertal', 'bonn', 'bielefeld', 'münster', 'muenster', 'mönchengladbach', 'moenchengladbach', 'gelsenkirchen', 'aachen', 'krefeld', 'oberhausen', 'hagen', 'leverkusen', 'paderborn', 'neuss'],
    population: 17_900_000,
  },
  {
    code: 'RP',
    nuts: 'DEB',
    name: 'Rheinland-Pfalz',
    quadrant: 'west',
    cities: ['mainz', 'koblenz', 'trier', 'kaiserslautern', 'ludwigshafen', 'speyer', 'worms'],
    population: 4_100_000,
  },
  {
    code: 'SL',
    nuts: 'DEC',
    name: 'Saarland',
    quadrant: 'west',
    cities: ['saarbrücken', 'saarbruecken', 'neunkirchen'],
    population: 980_000,
  },
  {
    code: 'SN',
    nuts: 'DED',
    name: 'Sachsen',
    quadrant: 'ost',
    cities: ['dresden', 'leipzig', 'chemnitz', 'zwickau', 'plauen', 'görlitz', 'goerlitz'],
    population: 4_060_000,
  },
  {
    code: 'ST',
    nuts: 'DEE',
    name: 'Sachsen-Anhalt',
    quadrant: 'ost',
    cities: ['magdeburg', 'halle', 'dessau', 'wittenberg'],
    population: 2_180_000,
  },
  {
    code: 'SH',
    nuts: 'DEF',
    name: 'Schleswig-Holstein',
    quadrant: 'nord',
    cities: ['kiel', 'lübeck', 'luebeck', 'flensburg', 'neumünster', 'neumuenster'],
    population: 2_920_000,
  },
  {
    code: 'TH',
    nuts: 'DEG',
    name: 'Thüringen',
    quadrant: 'ost',
    cities: ['erfurt', 'jena', 'gera', 'weimar', 'eisenach'],
    population: 2_120_000,
  },
];

export const QUADRANTS: ReadonlyArray<{ id: Quadrant; label: string; sortOrder: number }> = [
  { id: 'nord', label: 'Nord', sortOrder: 0 },
  { id: 'ost',  label: 'Ost',  sortOrder: 1 },
  { id: 'sued', label: 'Süd',  sortOrder: 2 },
  { id: 'west', label: 'West', sortOrder: 3 },
];

const CITY_LOOKUP: Map<string, BundeslandRecord> = (() => {
  const m = new Map<string, BundeslandRecord>();
  for (const land of BUNDESLAENDER) {
    for (const city of land.cities) {
      m.set(city, land);
    }
  }
  return m;
})();

const NAME_LOOKUP: Map<string, BundeslandRecord> = (() => {
  const m = new Map<string, BundeslandRecord>();
  for (const land of BUNDESLAENDER) {
    m.set(land.name.toLowerCase(), land);
    // Also accept "Bavaria" / "Saxony" English names
    if (land.code === 'BY') m.set('bavaria', land);
    if (land.code === 'SN') m.set('saxony', land);
    if (land.code === 'NI') m.set('lower saxony', land);
    if (land.code === 'NW') m.set('north rhine-westphalia', land);
    if (land.code === 'RP') m.set('rhineland-palatinate', land);
    if (land.code === 'BB') m.set('brandenburg', land);
    if (land.code === 'TH') m.set('thuringia', land);
    if (land.code === 'SH') m.set('schleswig-holstein', land);
    if (land.code === 'MV') m.set('mecklenburg-western pomerania', land);
    if (land.code === 'HE') m.set('hesse', land);
    if (land.code === 'BW') m.set('baden-wurttemberg', land);
    if (land.code === 'ST') m.set('saxony-anhalt', land);
  }
  return m;
})();

/**
 * Map a free-form headquarters string to a Bundesland record.
 * Returns null when nothing recognisable is found.
 *
 * Strategy:
 *   1. Normalise: lower-case, drop trailing ", DE" / ", Germany".
 *   2. Try to match a city token against `CITY_LOOKUP`.
 *   3. Try to match a Bundesland name token against `NAME_LOOKUP`.
 *   4. Fall back to null (caller decides what "unclassified" means).
 *
 * The function tolerates spelling variants (Umlaut + ASCII fallback)
 * because the existing master records carry both forms ("München"
 * vs "Muenchen" vs "Munich").
 */
export function resolveBundesland(input: string | undefined | null): BundeslandRecord | null {
  if (!input) return null;
  const cleaned = input
    .toLowerCase()
    .replace(/,?\s*(de|deutschland|germany)\s*$/i, '')
    .trim();
  if (!cleaned) return null;

  // Direct exact city match (single token: "berlin")
  const direct = CITY_LOOKUP.get(cleaned);
  if (direct) return direct;

  // Direct Bundesland name match
  const named = NAME_LOOKUP.get(cleaned);
  if (named) return named;

  // Substring scan — handle "Stuttgart, BW" / "Hamburg HQ"
  for (const [city, land] of CITY_LOOKUP) {
    if (cleaned.includes(city)) return land;
  }
  for (const [name, land] of NAME_LOOKUP) {
    if (cleaned.includes(name)) return land;
  }

  return null;
}

export function landByCode(code: string): BundeslandRecord | undefined {
  return BUNDESLAENDER.find((b) => b.code === code);
}

export function quadrantOf(code: string): Quadrant | null {
  return landByCode(code)?.quadrant ?? null;
}

export function bundeslaenderByQuadrant(q: Quadrant): BundeslandRecord[] {
  return BUNDESLAENDER.filter((b) => b.quadrant === q);
}
