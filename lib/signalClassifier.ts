/**
 * Hybrid signal classifier · v2 (DACH-content erweitert).
 *
 * Three layers, evaluated in order:
 *   1. Negative-signal detection — insolvency / restructuring / layoffs
 *      win first, even if positive keywords appear.
 *   2. Keyword layer — single-pattern matches against title + description.
 *   3. Semantic context layer — combinations of weaker keywords.
 *
 * v2 extensions:
 *   - Insolvency: "meldet Insolvenz an", "geht in die Insolvenz", "schutzschirmverfahren"
 *   - Restructuring: "Werksschließung", "Standortzusammenlegung", "Kurzarbeit"
 *   - C-Level (gf_change): "wechselt an die Spitze", "neuer Geschäftsführer", "übernimmt Vorstand"
 *   - Job_spike: "stellt hunderte ein", "schafft Arbeitsplätze", "Ausbildung"
 *   - Tarif/Streik (restructuring): Verdi, IG-Metall Streiks → leading indicator
 *   - Standort-News (location_expansion): "neuer Campus", "Erweiterung des Werks"
 */

import type { HiringSignalType } from './types';

export interface ClassificationResult {
  signalType: HiringSignalType;
  confidence: number;
  impact: number;
  confidenceReason: string;
  matchedPatterns: string[];
  layer: 'negative' | 'keyword' | 'semantic';
  semanticReason: string;
}

interface KeywordRule {
  type: HiringSignalType;
  patterns: RegExp[];
  negate?: RegExp[];
  baseImpact: number;
  baseConfidence: number;
  reason: string;
}

interface SemanticRule {
  type: HiringSignalType;
  groups: RegExp[][];
  baseImpact: number;
  baseConfidence: number;
  reason: string;
}

const NEGATIVE_RULES: KeywordRule[] = [
  {
    type: 'insolvency',
    patterns: [
      /\binsolven[zc]\w*/i,
      /\bbankruptcy\b/i,
      /\bchapter\s*11\b/i,
      /\bzahlungsunf\w+/i,
      /\bpleite\b/i,
      /\binsolvenzverfahren\b/i,
      /\bschutzschirmverfahren\b/i,
      /\bmeldet\s+(?:die\s+)?insolvenz\s+an/i,
      /\binsolvenzantrag\s+gestellt/i,
      /\bgeht\s+in\s+die\s+insolvenz/i,
      /\bstellt\s+insolvenzantrag/i,
      /\bantrag\s+auf\s+insolvenz/i,
      /\bvor\s+der\s+insolvenz/i,
      /\bregelinsolvenz\b/i,
    ],
    baseImpact: -38,
    baseConfidence: 0.92,
    reason: 'Bankruptcy / insolvency disclosure',
  },
  {
    type: 'restructuring',
    patterns: [
      /\brestructur\w*/i,
      /\breorgan\w*/i,
      /\bumstrukturier\w*/i,
      /\bumbau\s+(des|der|im)\s+konzern\w*/i,
      /\bstellenabbau\b/i,
      /\blay-?offs?\b/i,
      /\bjob\s*cuts?\b/i,
      /\bworkforce reduction\b/i,
      /\babbau\s+von\s+stellen/i,
      /\bentlassung\w*/i,
      /\bstreich\w*\s+stellen/i,
      /\bstellen\s+streich\w*/i,
      /\bsparmaßnahm\w+/i,
      /\bwerk(?:s)?schließung\w*/i,
      /\bstandortschließung\w*/i,
      /\bwill\s+\d{2,}\s+(mitarbeitende|stellen|jobs)/i,
      // v2 additions
      /\bschließt\s+werk/i,
      /\bschließt\s+standort/i,
      /\bstandort\s+wird\s+geschlossen/i,
      /\bstandortzusammenlegung\b/i,
      /\bstandortverlagerung\b/i,
      /\bverlagert\s+(produktion|werk|standort)/i,
      /\bkurzarbeit\b/i,
      /\bmassenentlassung\w*/i,
      /\bbetriebsbedingte?\s+kündigung\w*/i,
      /\baufhebungsvertra\w+/i,
      /\bsozialplan\b/i,
      /\bfreisetz\w+\s+\d+/i,
      /\bfreiwilligenprogramm\w*/i,
      /\babbau\s+(?:von|um)\s+\d+/i,
      // Tarif / Streik (leading indicator for restructuring)
      /\bstreik\b/i,
      /\bwarnstreik\b/i,
      /\btarifkonflikt\b/i,
      /\bpersonalprobleme\b/i,
    ],
    baseImpact: -22,
    baseConfidence: 0.78,
    reason: 'Restructuring / workforce reduction / labor conflict',
  },
  {
    type: 'mna_sell',
    patterns: [
      /\bdivest\w*/i,
      /\bsells?\s+(its|the)\s+\w+\s+(unit|division|business)/i,
      /\bverkauft\s+(seine|die|den|das)?\s*\w*\s*(sparte|einheit|geschäft|tochter|beteiligung)/i,
      /\babspaltung\w*/i,
      /\bspin-?off\b/i,
      /\btrennt\s+sich\s+von\b/i,
      /\bveräußerung\b/i,
      /\bcarve-?out\b/i,
    ],
    baseImpact: -14,
    baseConfidence: 0.78,
    reason: 'Divestiture / sale of business unit',
  },
];

const KEYWORD_RULES: KeywordRule[] = [
  {
    type: 'mna_buy',
    patterns: [
      /\bacquir(?:es|ed|ing|ition)\b/i,
      /\bbuys?\b/i,
      /\bbuy-?out\b/i,
      /\btakeover\b/i,
      /\bmerger\b/i,
      /\büberni[mn]m\w*/i,
      /\bübernehm\w*/i,
      /\bübernomm\w*/i,
      /\bübernahme\w*/i,
      /\berwirb\w*/i,
      /\berwerb\w*/i,
      /\berworb\w*/i,
      /\bkauft\b/i,
      /\bkaufen\b/i,
      /\bgekauft\b/i,
      /\bkauf\s+von\b/i,
      /\bfusion\w*/i,
      /\bzusammenschluss\b/i,
      /\bmehrheits(?:antei|beteiligung)\w*/i,
      /\bschluckt\b/i,
      /\bbeteiligt\s+sich\s+(?:an|mit)/i,
    ],
    negate: [/\bdivest\w*/i, /\bsells?\s+(its|the)\s+\w+\s+(unit|division|business)/i],
    baseImpact: 24,
    baseConfidence: 0.82,
    reason: 'Acquisition / takeover announcement',
  },
  {
    type: 'gf_change',
    patterns: [
      // Existing English + German basics
      /\bnew\s+(ceo|cto|cfo|coo|chief)\b/i,
      /\bappoint(s|ed|ment)\b/i,
      /\bernennt\s+\w+/i,
      /\bnamed\s+(ceo|cto|cfo|coo)\b/i,
      /\b(ceo|cfo|cto|coo)\s+(tritt\s+zurück|geht|verlässt)/i,
      /\b(neue|neuer)\s+(vorstand\w*|chef\w*|vorstandsvorsitz\w*)/i,
      /\bführungswechsel\b/i,
      /\b(rücktritt|abberufung)\b/i,
      /\bfolgt\s+\w+\s+als\s+(ceo|cfo|cto|chef)/i,
      // v2 additions: more German leadership change patterns
      /\bwechsel\s+an\s+der\s+spitze/i,
      /\bwechsel\s+im\s+(?:vorstand|management|führungsteam)/i,
      /\bübergibt\s+an\b/i,
      /\bübernimmt\s+(?:den\s+)?vorstand/i,
      /\bübernimmt\s+(?:die\s+)?(?:geschäftsführung|leitung)/i,
      /\bneue[rn]?\s+geschäftsführer\w*/i,
      /\bneue[rn]?\s+ceo\b/i,
      /\bneue\s+cfo\b/i,
      /\bvorsitz(?:ende[rn]?|er)?\s+(?:wechsel|ändert|ändern)/i,
      /\bgibt\s+(?:die\s+)?(?:führung|leitung|vorstand)\s+ab/i,
      /\bnachfolge\s+(?:steht\s+fest|geregelt|geklärt)/i,
      /\bsteht\s+nicht\s+mehr\s+zur\s+verfügung/i,
      /\bverlässt\s+den\s+vorstand/i,
      /\baufsichtsrat\s+(?:bestellt|beruft|benennt)/i,
      /\binterimschef\w*/i,
      /\bübergangschef\w*/i,
    ],
    baseImpact: 10,
    baseConfidence: 0.74,
    reason: 'Leadership / executive change',
  },
  {
    type: 'patent_filing',
    patterns: [
      /\bpatent\s+(filing|application|granted|filed)\b/i,
      /\bpatentanmeldung\b/i,
      /\bpatent\s+erteilt\b/i,
      /\bschutzrecht\w*/i,
      /\bgebrauchsmuster\b/i,
    ],
    baseImpact: 16,
    baseConfidence: 0.78,
    reason: 'Patent filing / grant',
  },
  {
    type: 'funding_grant',
    patterns: [
      /\braised?\s+\$?€?\s*\d/i,
      /\bseries\s*[a-e]\b/i,
      /\bfunding\s+round\b/i,
      /\bförderung\b/i,
      /\bförderbescheid\w*/i,
      /\bbundes(?:zuschuss|förderung|mittel)\w*/i,
      /\b(grant|grant\s+award)\b/i,
      /\bfinanzierungsrunde\b/i,
      /\bsammelt\s+(?:über|mehr\s+als|ca\.?)?\s*[\d.,]+\s*(mio|millionen|mrd|milliarden|m\b|bn\b)/i,
      /\binvestor\w*\s+(steig\w+\s+ein|über[a-z]+|investier\w+)/i,
      /\bkapitalerhöh\w+/i,
      /\bschließt\s+(?:eine|seine)?\s*(?:series\s*[a-e]\s+|finanzierung\w+|runde)/i,
      /\bfrisches\s+kapital/i,
      /\bsicherte?\s+sich\s+\d/i,
    ],
    baseImpact: 22,
    baseConfidence: 0.86,
    reason: 'Funding round or public grant',
  },
  {
    type: 'job_spike',
    patterns: [
      /\bhiring\s+spree\b/i,
      /\bjob(?:s)?\s+(spike|boom)\b/i,
      /\bstellenanzeigen\b/i,
      /\bramp(?:ing)?\s+up\s+hiring\b/i,
      /\bsucht\s+\d{2,}\s+(mitarbeitende|fachkräfte)/i,
      /\bschafft\s+\d{2,}\s+(stellen|jobs|arbeitsplätze)/i,
      // v2 additions
      /\bstellt\s+(?:hunderte|tausende|\d{2,})\s+(ein|mitarbeitende|fachkräfte)/i,
      /\beinstellungsoffensive\b/i,
      /\bpersonal\w*\s+aufbau\b/i,
      /\baufbau\s+von\s+\d+\s+(?:stellen|arbeitsplätzen)/i,
      /\bneue\s+arbeitsplätze\b/i,
      /\bausbildungsoffensive\b/i,
      /\bschafft\s+(?:hunderte|tausende)\s+(?:neue\s+)?stellen/i,
      /\bstockt\s+(?:die\s+)?belegschaft\s+auf/i,
    ],
    baseImpact: 26,
    baseConfidence: 0.78,
    reason: 'Hiring spike / job postings boom',
  },
  {
    type: 'employee_growth',
    patterns: [
      /\bheadcount\s+(growth|increase|up)\b/i,
      /\bworkforce\s+growth\b/i,
      /\bmitarbeiter[-\s]?(?:wachstum|zahl|aufbau)\b/i,
      /\bteam\s+grew\s+by\b/i,
      /\bbaut\s+\d{2,}\s+(mitarbeitende|stellen|fachkräfte)/i,
      /\bbelegschaft\s+(?:wächst|aufbau)/i,
      /\bpersonal\w*bestand\s+(?:steigt|wächst|wird\s+ausgebaut)/i,
    ],
    baseImpact: 20,
    baseConfidence: 0.74,
    reason: 'Headcount / workforce growth',
  },
  {
    type: 'product_launch',
    patterns: [
      /\blaunch(?:es|ed|ing)\b/i,
      /\bunveil(?:s|ed|ing)\b/i,
      /\bstellt\s+\w+\s+vor\b/i,
      /\bmarkteinführung\b/i,
      /\bvorgestellt\b/i,
      /\bpräsentiert\s+\w+\b/i,
    ],
    baseImpact: 14,
    baseConfidence: 0.72,
    reason: 'Product or feature launch',
  },
  {
    type: 'new_business_unit',
    patterns: [
      /\bnew\s+(division|business unit|subsidiary)\b/i,
      /\b(neue[rs]?\s+)?geschäftsbereich\b/i,
      /\bspin-?off\b/i,
      /\btochterunternehmen\s+gegründet/i,
      /\bgründet\s+(?:neue\s+|eine\s+)?tochter/i,
      /\bneue\s+sparte\b/i,
    ],
    baseImpact: 18,
    baseConfidence: 0.78,
    reason: 'New business unit / spin-off',
  },
];

const SEMANTIC_RULES: SemanticRule[] = [
  {
    type: 'location_expansion',
    groups: [
      [
        /\bopens?\b/i,
        /\bopened\b/i,
        /\bopening\b/i,
        /\beröffn\w+/i,
        /\bnew\b/i,
        /\bzweite\b/i,
        /\bneue\b/i,
        /\berweiter\w+/i,
        /\bvergrößer\w+/i,
        /\bbaut\s+(?:auf|neu)/i,
        /\bplant\s+(?:einen|eine|den|die)/i,
      ],
      [
        /\boffice\b/i,
        /\bniederlassung\b/i,
        /\bstandort\b/i,
        /\bcampus\b/i,
        /\bhq\b/i,
        /\bheadquarter/i,
        /\bplant\b/i,
        /\bwerk\b/i,
        /\bzentrum\b/i,
        /\bgigafactory\b/i,
        /\bproduktionsstätte\b/i,
        /\bbüro\b/i,
      ],
    ],
    baseImpact: 20,
    baseConfidence: 0.80,
    reason: 'Geographic expansion: new office / location / plant',
  },
  {
    type: 'mna_buy',
    groups: [
      [/\bagreement\b/i, /\bvertrag\b/i, /\btransaction\b/i, /\bdeal\b/i],
      [/\bmajority\b/i, /\bcontrolling\b/i, /\bmehrheit\b/i, /\bcomplete\s+ownership\b/i, /\b100%\b/i],
    ],
    baseImpact: 22,
    baseConfidence: 0.78,
    reason: 'Implicit acquisition (majority / controlling stake)',
  },
  {
    type: 'funding_grant',
    groups: [
      [/\binvestment\b/i, /\binvestor\b/i, /\binvestoren\b/i, /\bventure\b/i, /\bcapital\b/i],
      [/\bmillion\b/i, /\bbillion\b/i, /\b€\d/i, /\b\$\d/i, /\bmrd\b/i, /\bmio\b/i],
    ],
    baseImpact: 20,
    baseConfidence: 0.78,
    reason: 'Implicit funding (investor + currency amount)',
  },
  // v2: Insolvenz-fallback wenn nur "antrag" + "amtsgericht" etc.
  {
    type: 'insolvency',
    groups: [
      [/\bantrag\b/i, /\bverfahren\b/i, /\beröffnet\b/i],
      [/\bamtsgericht\b/i, /\binsolvenzgericht\b/i, /\bvermögensverfall\b/i],
    ],
    baseImpact: -36,
    baseConfidence: 0.85,
    reason: 'Implicit insolvency (court proceedings)',
  },
];

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function evaluateKeywordRule(rule: KeywordRule, text: string): string[] | null {
  if (rule.negate?.some((re) => re.test(text))) return null;
  const hits: string[] = [];
  for (const re of rule.patterns) {
    const m = text.match(re);
    if (m) hits.push(m[0].trim());
  }
  return hits.length > 0 ? uniq(hits) : null;
}

function evaluateSemanticRule(rule: SemanticRule, text: string): string[] | null {
  const hits: string[] = [];
  for (const group of rule.groups) {
    let groupHit: string | null = null;
    for (const re of group) {
      const m = text.match(re);
      if (m) {
        groupHit = m[0].trim();
        break;
      }
    }
    if (!groupHit) return null;
    hits.push(groupHit);
  }
  return uniq(hits);
}

export function classifySignal(
  title: string,
  description: string = ''
): ClassificationResult | null {
  const text = `${title}\n${description}`.trim();
  if (!text) return null;

  for (const rule of NEGATIVE_RULES) {
    const hits = evaluateKeywordRule(rule, text);
    if (hits) {
      return {
        signalType: rule.type,
        confidence: rule.baseConfidence,
        impact: rule.baseImpact,
        confidenceReason: rule.reason,
        matchedPatterns: hits,
        layer: 'negative',
        semanticReason: `Negative signal detected: ${rule.reason.toLowerCase()}.`,
      };
    }
  }

  for (const rule of KEYWORD_RULES) {
    const hits = evaluateKeywordRule(rule, text);
    if (hits) {
      return {
        signalType: rule.type,
        confidence: rule.baseConfidence,
        impact: rule.baseImpact,
        confidenceReason: rule.reason,
        matchedPatterns: hits,
        layer: 'keyword',
        semanticReason: `Direct keyword match (${rule.reason.toLowerCase()}).`,
      };
    }
  }

  for (const rule of SEMANTIC_RULES) {
    const hits = evaluateSemanticRule(rule, text);
    if (hits) {
      return {
        signalType: rule.type,
        confidence: rule.baseConfidence,
        impact: rule.baseImpact,
        confidenceReason: rule.reason,
        matchedPatterns: hits,
        layer: 'semantic',
        semanticReason: `Multi-keyword pattern: ${hits.join(' + ')}.`,
      };
    }
  }

  return null;
}

export interface ClassifyOptions {
  fallbackToPressRelease?: boolean;
  fallbackConfidence?: number;
}

export function classifyOrFallback(
  title: string,
  description: string,
  opts: ClassifyOptions = {}
): ClassificationResult {
  const r = classifySignal(title, description);
  if (r) return r;
  return {
    signalType: 'press_release',
    confidence: opts.fallbackConfidence ?? 0.45,
    impact: 6,
    confidenceReason: 'Soft fallback (no rule matched)',
    matchedPatterns: [],
    layer: 'keyword',
    semanticReason: 'Fallback: no rule matched, treated as generic press release.',
  };
}
