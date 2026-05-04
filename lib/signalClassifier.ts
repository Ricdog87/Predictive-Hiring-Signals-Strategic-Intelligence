/**
 * Hybrid signal classifier · v1.
 *
 * Three layers, evaluated in order:
 *   1. Negative-signal detection — insolvency / restructuring / layoffs
 *      win first, even if positive keywords appear ("Restructuring
 *      following acquisition" is restructuring, not mna_buy).
 *   2. Keyword layer — single-pattern matches against the title +
 *      description. Each rule carries a base impact and confidence.
 *   3. Semantic context layer — combinations of weaker keywords
 *      ("opens" + "office" / "neue" + "niederlassung") that only
 *      classify when at least two terms co-occur.
 *
 * If nothing fires, the function returns null. A caller is free to
 * fall back to "press_release" with low confidence — the classifier
 * itself does not guess.
 */

import type { HiringSignalType } from './types';

export interface ClassificationResult {
  signalType: HiringSignalType;
  /** Raw confidence before source-trust modulation, 0..1. */
  confidence: number;
  /** Suggested impact, -100..100. */
  impact: number;
  /** Short human-readable label of the rule that fired. */
  confidenceReason: string;
  /** Patterns that matched in the input text. */
  matchedPatterns: string[];
  /** Which layer fired the classification. */
  layer: 'negative' | 'keyword' | 'semantic';
  /** Human-readable rationale for downstream "whyNow" narratives. */
  semanticReason: string;
}

interface KeywordRule {
  type: HiringSignalType;
  patterns: RegExp[];
  /** Negative regexes that disqualify the rule. */
  negate?: RegExp[];
  baseImpact: number;
  baseConfidence: number;
  reason: string;
}

interface SemanticRule {
  type: HiringSignalType;
  /** All groups must hit at least once for the rule to fire. */
  groups: RegExp[][];
  baseImpact: number;
  baseConfidence: number;
  reason: string;
}

const NEGATIVE_RULES: KeywordRule[] = [
  {
    type: 'insolvency',
    patterns: [/\binsolven[zc]\w*/i, /\bbankruptcy\b/i, /\bchapter\s*11\b/i, /\bzahlungsunf\w+/i],
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
      /\bstellenabbau\b/i,
      /\blay-?offs?\b/i,
      /\bworkforce reduction\b/i,
      /\babbau\s+von\s+stellen/i,
    ],
    baseImpact: -22,
    baseConfidence: 0.78,
    reason: 'Restructuring / workforce reduction',
  },
  {
    type: 'mna_sell',
    patterns: [
      /\bdivest\w*/i,
      /\bsells?\s+(its|the)\s+\w+\s+(unit|division|business)/i,
      /\bverkauft\s+(seine|die)\s+\w+\s+(sparte|einheit|geschäft)/i,
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
      /\b(buys|kauft|übernimmt|takeover)\b/i,
    ],
    negate: [/\bdivest\w*/i, /\b(sells?|verkauft)\b/i],
    baseImpact: 24,
    baseConfidence: 0.82,
    reason: 'Acquisition / takeover announcement',
  },
  {
    type: 'gf_change',
    patterns: [
      /\bnew\s+(ceo|cto|cfo|coo|chief)\b/i,
      /\bappoint(s|ed|ment)\b/i,
      /\bernennt\s+\w+/i,
      /\bnamed\s+(ceo|cto|cfo|coo)\b/i,
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
      /\bbundes(?:zuschuss|förderung)\b/i,
      /\b(grant|grant\s+award)\b/i,
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
      /\bmitarbeiter[-\s]?wachstum\b/i,
      /\bteam\s+grew\s+by\b/i,
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
      [/\bopens?\b/i, /\bopened\b/i, /\bopening\b/i, /\beröffn\w+/i, /\bnew\b/i, /\bzweite\b/i, /\bneue\b/i],
      [/\boffice\b/i, /\bniederlassung\b/i, /\bstandort\b/i, /\bcampus\b/i, /\bhq\b/i, /\bheadquarter/i, /\bplant\b/i],
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

  // Layer 1 — Negative signals (highest priority)
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

  // Layer 2 — Strong keywords
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

  // Layer 3 — Semantic context (multi-keyword co-occurrence)
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

/**
 * Bulk classify with a soft fallback. If the classifier returns null,
 * yield a low-confidence `press_release` so callers don't lose the
 * record entirely. The fallback flag lets downstream surfaces filter
 * out un-classified noise if they want stricter input.
 */
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
