/**
 * lib/mittelstandSeed.ts
 *
 * Kuratierte Liste öffentlich bekannter DACH-Mittelständler. Dient als
 * Bias-Korrektor für den Discovery-Layer und garantiert eine
 * Mindestpopulation an Mittelstands-Namen im Companies-Tab, auch wenn
 * der Tier-1-News-Stream gerade DAX-Konzerne hochspült.
 *
 * Disclaimer
 * ----------
 * Diese Liste dient als Mittelstand-Bias-Korrektor für den
 * Discovery-Layer. Die genannten Firmen sind öffentlich bekannte
 * DACH-Mittelständler. Es besteht KEINE Kunden- oder Mandantenbeziehung
 * mit einem der genannten Unternehmen; alle Daten (Name, Sektor,
 * Region, grobe Grössenklasse, HQ-Stadt) stammen aus öffentlich
 * zugänglichen Quellen (Wikipedia, Unternehmens-Newsrooms, IHK-Listen).
 *
 * Die Liste ist absichtlich überlappend zu Standard-Industrieverbänden
 * (VDMA, ZVEI, VDA-Zulieferer-Bereich, BVMW), damit der Discovery-Layer
 * über mehrere Sektoren hinweg auf dem Radar bleibt.
 *
 * Update-Policy: manuell, ca. quartalsweise — kein automatischer
 * Refresh, kein API-Lookup. Das ist Absicht: die Liste soll stabil
 * sein, sonst killt sie Dedup-Joins gegen Discovery-Output.
 */

export type SeedSector =
  | 'Automotive'
  | 'Maschinenbau'
  | 'Energie & Netz'
  | 'Defense & Aerospace'
  | 'MedTech & Healthcare'
  | 'IT & SaaS'
  | 'Chemie & Pharma'
  | 'Logistik'
  | 'Handel & Konsum'
  | 'Bau & Trade'
  | 'Lebensmittel & Agrar';

export type SeedSizeRange =
  | '200-500'
  | '500-1000'
  | '1000-2500'
  | '2500-5000'
  | '5000-10000';

export interface MittelstandSeed {
  name: string;
  sector: SeedSector;
  region: string; // Bundesland-Name oder Land bei AT/CH
  sizeRange: SeedSizeRange;
  hq: string;
  source: 'seed';
}

/**
 * ~120 DACH-Mittelständler. Reihenfolge ist nicht signifikant —
 * Sortierung passiert downstream nach Score / Recency.
 */
export const MITTELSTAND_SEED: readonly MittelstandSeed[] = [
  // ─── Automotive-Zulieferer ─────────────────────────────────────────
  { name: 'Brose Fahrzeugteile', sector: 'Automotive', region: 'Bayern', sizeRange: '5000-10000', hq: 'Coburg', source: 'seed' },
  { name: 'EDAG Group', sector: 'Automotive', region: 'Hessen', sizeRange: '5000-10000', hq: 'Wiesbaden', source: 'seed' },
  { name: 'IAV', sector: 'Automotive', region: 'Berlin', sizeRange: '5000-10000', hq: 'Berlin', source: 'seed' },
  { name: 'Kostal Gruppe', sector: 'Automotive', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Lüdenscheid', source: 'seed' },
  { name: 'Webasto Group', sector: 'Automotive', region: 'Bayern', sizeRange: '5000-10000', hq: 'Stockdorf', source: 'seed' },
  { name: 'Knorr-Bremse', sector: 'Automotive', region: 'Bayern', sizeRange: '5000-10000', hq: 'München', source: 'seed' },
  { name: 'ElringKlinger', sector: 'Automotive', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Dettingen an der Erms', source: 'seed' },
  { name: 'Eberspächer', sector: 'Automotive', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Esslingen am Neckar', source: 'seed' },
  { name: 'Hella', sector: 'Automotive', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Lippstadt', source: 'seed' },
  { name: 'Leoni', sector: 'Automotive', region: 'Bayern', sizeRange: '5000-10000', hq: 'Nürnberg', source: 'seed' },
  { name: 'Mann+Hummel', sector: 'Automotive', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Ludwigsburg', source: 'seed' },
  { name: 'Recaro Automotive', sector: 'Automotive', region: 'Baden-Württemberg', sizeRange: '500-1000', hq: 'Kirchheim unter Teck', source: 'seed' },
  { name: 'Behr-Hella Thermocontrol', sector: 'Automotive', region: 'Nordrhein-Westfalen', sizeRange: '1000-2500', hq: 'Lippstadt', source: 'seed' },
  { name: 'Pierburg', sector: 'Automotive', region: 'Nordrhein-Westfalen', sizeRange: '2500-5000', hq: 'Neuss', source: 'seed' },

  // ─── Maschinenbau ──────────────────────────────────────────────────
  { name: 'Trumpf', sector: 'Maschinenbau', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Ditzingen', source: 'seed' },
  { name: 'Stihl', sector: 'Maschinenbau', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Waiblingen', source: 'seed' },
  { name: 'Sennheiser', sector: 'Maschinenbau', region: 'Niedersachsen', sizeRange: '2500-5000', hq: 'Wedemark', source: 'seed' },
  { name: 'Festo', sector: 'Maschinenbau', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Esslingen am Neckar', source: 'seed' },
  { name: 'Bizerba', sector: 'Maschinenbau', region: 'Baden-Württemberg', sizeRange: '2500-5000', hq: 'Balingen', source: 'seed' },
  { name: 'Hilti', sector: 'Maschinenbau', region: 'Schweiz', sizeRange: '5000-10000', hq: 'Schaan (LI)', source: 'seed' },
  { name: 'Liebherr', sector: 'Maschinenbau', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Biberach an der Riß', source: 'seed' },
  { name: 'Voith', sector: 'Maschinenbau', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Heidenheim', source: 'seed' },
  { name: 'Dürr', sector: 'Maschinenbau', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Bietigheim-Bissingen', source: 'seed' },
  { name: 'Heidelberg Druckmaschinen', sector: 'Maschinenbau', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Heidelberg', source: 'seed' },
  { name: 'Bystronic', sector: 'Maschinenbau', region: 'Schweiz', sizeRange: '2500-5000', hq: 'Niederönz', source: 'seed' },
  { name: 'Sennebogen', sector: 'Maschinenbau', region: 'Bayern', sizeRange: '1000-2500', hq: 'Straubing', source: 'seed' },
  { name: 'GEA Group', sector: 'Maschinenbau', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Düsseldorf', source: 'seed' },
  { name: 'Krones', sector: 'Maschinenbau', region: 'Bayern', sizeRange: '5000-10000', hq: 'Neutraubling', source: 'seed' },
  { name: 'Andritz Hydro', sector: 'Maschinenbau', region: 'Österreich', sizeRange: '5000-10000', hq: 'Graz', source: 'seed' },
  { name: 'KraussMaffei', sector: 'Maschinenbau', region: 'Bayern', sizeRange: '2500-5000', hq: 'München', source: 'seed' },

  // ─── Energie & Netz ────────────────────────────────────────────────
  { name: 'Bayernwerk', sector: 'Energie & Netz', region: 'Bayern', sizeRange: '2500-5000', hq: 'Regensburg', source: 'seed' },
  { name: 'Netze BW', sector: 'Energie & Netz', region: 'Baden-Württemberg', sizeRange: '2500-5000', hq: 'Stuttgart', source: 'seed' },
  { name: 'TransnetBW', sector: 'Energie & Netz', region: 'Baden-Württemberg', sizeRange: '500-1000', hq: 'Stuttgart', source: 'seed' },
  { name: 'EWE', sector: 'Energie & Netz', region: 'Niedersachsen', sizeRange: '5000-10000', hq: 'Oldenburg', source: 'seed' },
  { name: 'MVV Energie', sector: 'Energie & Netz', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Mannheim', source: 'seed' },
  { name: 'Westnetz', sector: 'Energie & Netz', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Dortmund', source: 'seed' },
  { name: 'Avacon', sector: 'Energie & Netz', region: 'Niedersachsen', sizeRange: '1000-2500', hq: 'Helmstedt', source: 'seed' },
  { name: 'Stadtwerke München', sector: 'Energie & Netz', region: 'Bayern', sizeRange: '5000-10000', hq: 'München', source: 'seed' },
  { name: 'Stadtwerke Hannover (enercity)', sector: 'Energie & Netz', region: 'Niedersachsen', sizeRange: '2500-5000', hq: 'Hannover', source: 'seed' },
  { name: 'Mainova', sector: 'Energie & Netz', region: 'Hessen', sizeRange: '2500-5000', hq: 'Frankfurt am Main', source: 'seed' },
  { name: 'Verbund AG', sector: 'Energie & Netz', region: 'Österreich', sizeRange: '2500-5000', hq: 'Wien', source: 'seed' },
  { name: 'OMV', sector: 'Energie & Netz', region: 'Österreich', sizeRange: '5000-10000', hq: 'Wien', source: 'seed' },

  // ─── Defense & Aerospace ───────────────────────────────────────────
  { name: 'Hensoldt', sector: 'Defense & Aerospace', region: 'Bayern', sizeRange: '5000-10000', hq: 'Taufkirchen', source: 'seed' },
  { name: 'Diehl Defence', sector: 'Defense & Aerospace', region: 'Bayern', sizeRange: '2500-5000', hq: 'Überlingen', source: 'seed' },
  { name: 'Krauss-Maffei Wegmann (KMW)', sector: 'Defense & Aerospace', region: 'Bayern', sizeRange: '2500-5000', hq: 'München', source: 'seed' },
  { name: 'Rohde & Schwarz', sector: 'Defense & Aerospace', region: 'Bayern', sizeRange: '5000-10000', hq: 'München', source: 'seed' },
  { name: 'Diehl Aerospace', sector: 'Defense & Aerospace', region: 'Bayern', sizeRange: '1000-2500', hq: 'Überlingen', source: 'seed' },
  { name: 'MBDA Deutschland', sector: 'Defense & Aerospace', region: 'Bayern', sizeRange: '1000-2500', hq: 'Schrobenhausen', source: 'seed' },
  { name: 'Liebherr-Aerospace', sector: 'Defense & Aerospace', region: 'Baden-Württemberg', sizeRange: '2500-5000', hq: 'Lindenberg im Allgäu', source: 'seed' },
  { name: 'Airbus Helicopters Donauwörth', sector: 'Defense & Aerospace', region: 'Bayern', sizeRange: '5000-10000', hq: 'Donauwörth', source: 'seed' },
  { name: 'OHB SE', sector: 'Defense & Aerospace', region: 'Bremen', sizeRange: '2500-5000', hq: 'Bremen', source: 'seed' },

  // ─── MedTech & Healthcare ──────────────────────────────────────────
  { name: 'Otto Bock', sector: 'MedTech & Healthcare', region: 'Niedersachsen', sizeRange: '5000-10000', hq: 'Duderstadt', source: 'seed' },
  { name: 'Sartorius', sector: 'MedTech & Healthcare', region: 'Niedersachsen', sizeRange: '5000-10000', hq: 'Göttingen', source: 'seed' },
  { name: 'Brainlab', sector: 'MedTech & Healthcare', region: 'Bayern', sizeRange: '1000-2500', hq: 'München', source: 'seed' },
  { name: 'Karl Storz', sector: 'MedTech & Healthcare', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Tuttlingen', source: 'seed' },
  { name: 'Richard Wolf', sector: 'MedTech & Healthcare', region: 'Baden-Württemberg', sizeRange: '1000-2500', hq: 'Knittlingen', source: 'seed' },
  { name: 'Drägerwerk', sector: 'MedTech & Healthcare', region: 'Schleswig-Holstein', sizeRange: '5000-10000', hq: 'Lübeck', source: 'seed' },
  { name: 'Erbe Elektromedizin', sector: 'MedTech & Healthcare', region: 'Baden-Württemberg', sizeRange: '500-1000', hq: 'Tübingen', source: 'seed' },
  { name: 'Geuder', sector: 'MedTech & Healthcare', region: 'Baden-Württemberg', sizeRange: '200-500', hq: 'Heidelberg', source: 'seed' },
  { name: 'B. Braun Melsungen', sector: 'MedTech & Healthcare', region: 'Hessen', sizeRange: '5000-10000', hq: 'Melsungen', source: 'seed' },
  { name: 'Paul Hartmann', sector: 'MedTech & Healthcare', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Heidenheim an der Brenz', source: 'seed' },
  { name: 'Aesculap', sector: 'MedTech & Healthcare', region: 'Baden-Württemberg', sizeRange: '2500-5000', hq: 'Tuttlingen', source: 'seed' },

  // ─── IT & SaaS ─────────────────────────────────────────────────────
  { name: 'GFT Technologies', sector: 'IT & SaaS', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Stuttgart', source: 'seed' },
  { name: 'Software AG', sector: 'IT & SaaS', region: 'Hessen', sizeRange: '5000-10000', hq: 'Darmstadt', source: 'seed' },
  { name: 'Bechtle', sector: 'IT & SaaS', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Neckarsulm', source: 'seed' },
  { name: 'DATEV eG', sector: 'IT & SaaS', region: 'Bayern', sizeRange: '5000-10000', hq: 'Nürnberg', source: 'seed' },
  { name: 'Cancom', sector: 'IT & SaaS', region: 'Bayern', sizeRange: '2500-5000', hq: 'München', source: 'seed' },
  { name: 'iteratec', sector: 'IT & SaaS', region: 'Bayern', sizeRange: '500-1000', hq: 'München', source: 'seed' },
  { name: 'eyeo', sector: 'IT & SaaS', region: 'Nordrhein-Westfalen', sizeRange: '200-500', hq: 'Köln', source: 'seed' },
  { name: 'Personio', sector: 'IT & SaaS', region: 'Bayern', sizeRange: '1000-2500', hq: 'München', source: 'seed' },
  { name: 'Celonis', sector: 'IT & SaaS', region: 'Bayern', sizeRange: '2500-5000', hq: 'München', source: 'seed' },
  { name: 'Hawk:AI', sector: 'IT & SaaS', region: 'Bayern', sizeRange: '200-500', hq: 'München', source: 'seed' },
  { name: 'Adesso SE', sector: 'IT & SaaS', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Dortmund', source: 'seed' },
  { name: 'Materna', sector: 'IT & SaaS', region: 'Nordrhein-Westfalen', sizeRange: '2500-5000', hq: 'Dortmund', source: 'seed' },
  { name: 'msg systems', sector: 'IT & SaaS', region: 'Bayern', sizeRange: '5000-10000', hq: 'Ismaning', source: 'seed' },
  { name: 'Atos Information Technology', sector: 'IT & SaaS', region: 'Bayern', sizeRange: '5000-10000', hq: 'München', source: 'seed' },

  // ─── Chemie & Pharma ───────────────────────────────────────────────
  { name: 'Lanxess', sector: 'Chemie & Pharma', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Köln', source: 'seed' },
  { name: 'Wacker Chemie', sector: 'Chemie & Pharma', region: 'Bayern', sizeRange: '5000-10000', hq: 'München', source: 'seed' },
  { name: 'Symrise', sector: 'Chemie & Pharma', region: 'Niedersachsen', sizeRange: '5000-10000', hq: 'Holzminden', source: 'seed' },
  { name: 'Evonik Industries', sector: 'Chemie & Pharma', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Essen', source: 'seed' },
  { name: 'Brenntag', sector: 'Chemie & Pharma', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Essen', source: 'seed' },
  { name: 'Stada Arzneimittel', sector: 'Chemie & Pharma', region: 'Hessen', sizeRange: '5000-10000', hq: 'Bad Vilbel', source: 'seed' },
  { name: 'Boehringer Ingelheim', sector: 'Chemie & Pharma', region: 'Rheinland-Pfalz', sizeRange: '5000-10000', hq: 'Ingelheim am Rhein', source: 'seed' },
  { name: 'Merz Pharma', sector: 'Chemie & Pharma', region: 'Hessen', sizeRange: '2500-5000', hq: 'Frankfurt am Main', source: 'seed' },
  { name: 'Schaeffler Industrial Engineering', sector: 'Chemie & Pharma', region: 'Bayern', sizeRange: '5000-10000', hq: 'Herzogenaurach', source: 'seed' },

  // ─── Logistik ──────────────────────────────────────────────────────
  { name: 'Kühne+Nagel Deutschland', sector: 'Logistik', region: 'Hessen', sizeRange: '5000-10000', hq: 'Frankfurt am Main', source: 'seed' },
  { name: 'Dachser', sector: 'Logistik', region: 'Bayern', sizeRange: '5000-10000', hq: 'Kempten (Allgäu)', source: 'seed' },
  { name: 'Fiege', sector: 'Logistik', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Greven', source: 'seed' },
  { name: 'Hellmann Worldwide Logistics', sector: 'Logistik', region: 'Niedersachsen', sizeRange: '5000-10000', hq: 'Osnabrück', source: 'seed' },
  { name: 'Rhenus Logistics', sector: 'Logistik', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Holzwickede', source: 'seed' },
  { name: 'Duvenbeck', sector: 'Logistik', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Bocholt', source: 'seed' },
  { name: 'Geis Group', sector: 'Logistik', region: 'Bayern', sizeRange: '5000-10000', hq: 'Bad Neustadt an der Saale', source: 'seed' },

  // ─── Handel & Konsum ───────────────────────────────────────────────
  { name: 'Würth-Gruppe', sector: 'Handel & Konsum', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Künzelsau', source: 'seed' },
  { name: 'Kärcher', sector: 'Handel & Konsum', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Winnenden', source: 'seed' },
  { name: 'Miele', sector: 'Handel & Konsum', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Gütersloh', source: 'seed' },
  { name: 'Vorwerk', sector: 'Handel & Konsum', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Wuppertal', source: 'seed' },
  { name: 'dm-drogerie markt', sector: 'Handel & Konsum', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Karlsruhe', source: 'seed' },
  { name: 'Globus SB-Warenhaus', sector: 'Handel & Konsum', region: 'Saarland', sizeRange: '5000-10000', hq: 'St. Wendel', source: 'seed' },
  { name: 'Tchibo', sector: 'Handel & Konsum', region: 'Hamburg', sizeRange: '5000-10000', hq: 'Hamburg', source: 'seed' },
  { name: 'Otto Group', sector: 'Handel & Konsum', region: 'Hamburg', sizeRange: '5000-10000', hq: 'Hamburg', source: 'seed' },
  { name: 'Hornbach Baumarkt', sector: 'Handel & Konsum', region: 'Rheinland-Pfalz', sizeRange: '5000-10000', hq: 'Bornheim (Pfalz)', source: 'seed' },

  // ─── Bau & Trade ───────────────────────────────────────────────────
  { name: 'Bauer AG', sector: 'Bau & Trade', region: 'Bayern', sizeRange: '5000-10000', hq: 'Schrobenhausen', source: 'seed' },
  { name: 'Goldbeck', sector: 'Bau & Trade', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Bielefeld', source: 'seed' },
  { name: 'Strabag Deutschland', sector: 'Bau & Trade', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Köln', source: 'seed' },
  { name: 'Max Bögl', sector: 'Bau & Trade', region: 'Bayern', sizeRange: '5000-10000', hq: 'Neumarkt in der Oberpfalz', source: 'seed' },
  { name: 'Wolff & Müller', sector: 'Bau & Trade', region: 'Baden-Württemberg', sizeRange: '1000-2500', hq: 'Stuttgart', source: 'seed' },
  { name: 'Implenia Deutschland', sector: 'Bau & Trade', region: 'Schweiz', sizeRange: '5000-10000', hq: 'Dietlikon', source: 'seed' },
  { name: 'Köster GmbH', sector: 'Bau & Trade', region: 'Niedersachsen', sizeRange: '1000-2500', hq: 'Osnabrück', source: 'seed' },
  { name: 'Leonhard Weiss', sector: 'Bau & Trade', region: 'Baden-Württemberg', sizeRange: '5000-10000', hq: 'Göppingen', source: 'seed' },

  // ─── Lebensmittel & Agrar ──────────────────────────────────────────
  { name: 'Bahlsen', sector: 'Lebensmittel & Agrar', region: 'Niedersachsen', sizeRange: '2500-5000', hq: 'Hannover', source: 'seed' },
  { name: 'Storck', sector: 'Lebensmittel & Agrar', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Halle (Westfalen)', source: 'seed' },
  { name: 'Hipp', sector: 'Lebensmittel & Agrar', region: 'Bayern', sizeRange: '2500-5000', hq: 'Pfaffenhofen an der Ilm', source: 'seed' },
  { name: 'Katjes', sector: 'Lebensmittel & Agrar', region: 'Nordrhein-Westfalen', sizeRange: '500-1000', hq: 'Emmerich am Rhein', source: 'seed' },
  { name: 'Ritter Sport', sector: 'Lebensmittel & Agrar', region: 'Baden-Württemberg', sizeRange: '1000-2500', hq: 'Waldenbuch', source: 'seed' },
  { name: 'Haribo', sector: 'Lebensmittel & Agrar', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Bonn', source: 'seed' },
  { name: 'Kärcher Agrar', sector: 'Lebensmittel & Agrar', region: 'Baden-Württemberg', sizeRange: '200-500', hq: 'Winnenden', source: 'seed' },
  { name: 'Westfleisch', sector: 'Lebensmittel & Agrar', region: 'Nordrhein-Westfalen', sizeRange: '5000-10000', hq: 'Münster', source: 'seed' },
  { name: 'PHW-Gruppe (Wiesenhof)', sector: 'Lebensmittel & Agrar', region: 'Niedersachsen', sizeRange: '5000-10000', hq: 'Rechterfeld', source: 'seed' },
];

/** Discovery-Layer-Score-Boost für seed-Companies. Additiv auf den
 *  Roh-Hiring-Score, damit sie nicht von DAX-News übertüncht werden. */
export const SEED_SCORE_BOOST = 5;

/** Schnelles Mapping name → seed-Eintrag für Dedup-Joins. */
const seedByLowerName = new Map<string, MittelstandSeed>();
for (const s of MITTELSTAND_SEED) {
  seedByLowerName.set(s.name.toLowerCase(), s);
}

export function findSeedByName(name: string): MittelstandSeed | null {
  return seedByLowerName.get(name.trim().toLowerCase()) ?? null;
}

export function seedCount(): number {
  return MITTELSTAND_SEED.length;
}

/** Sektor-Buckets — z. B. für eine künftige "Mittelstand only"-UI-Pille. */
export function seedsBySector(): Record<SeedSector, MittelstandSeed[]> {
  const out = {} as Record<SeedSector, MittelstandSeed[]>;
  for (const s of MITTELSTAND_SEED) {
    if (!out[s.sector]) out[s.sector] = [];
    out[s.sector].push(s);
  }
  return out;
}
