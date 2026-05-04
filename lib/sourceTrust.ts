/**
 * Source-trust score · v1.
 *
 * Every signal provider gets a 0..1 trust score that modulates the
 * confidence and impact downstream surfaces actually believe.
 * Centralised here so the score is consistent across:
 *   - the dedup engine (`pickMaster` doesn't trust an unknown blog
 *     more than the company newsroom even if it screams louder)
 *   - the opportunity engine (`SourceTrust` factor)
 *   - the admin pipeline view (`/admin/pipeline · trust scores`)
 *
 * Sources are matched in two passes: exact key first (cheap), then
 * substring fallback against a curated alias map. Unknown sources fall
 * to a conservative default — never zero, so genuinely new feeds are
 * surfaced rather than silently suppressed.
 */

const DEFAULT_TRUST = 0.6;

interface TrustEntry {
  trust: number;
  /** Human-readable label used in the admin view. */
  label: string;
  /** Substrings (lower-cased) that should resolve to this entry. */
  aliases: string[];
}

const TRUST_TABLE: Record<string, TrustEntry> = {
  company_newsroom: {
    trust: 0.95,
    label: 'Company newsroom',
    aliases: ['newsroom', 'company-news', 'corporate-news'],
  },
  newsroom_rss: {
    trust: 0.95,
    label: 'Company newsroom (RSS)',
    aliases: ['newsroom_rss', 'newsroom-rss'],
  },
  press_rss: {
    trust: 0.85,
    label: 'Corporate press feed',
    aliases: ['press_rss', 'press-rss', 'press-room', 'pressreleases'],
  },
  press_release: {
    trust: 0.80,
    label: 'Press release wire',
    aliases: ['press_release', 'pressrelease'],
  },
  pressebox: {
    trust: 0.80,
    label: 'Pressebox',
    aliases: ['pressebox', 'presseportal'],
  },
  major_news: {
    trust: 0.85,
    label: 'Major news outlet',
    aliases: ['reuters', 'bloomberg', 'handelsblatt', 'faz', 'manager-magazin'],
  },
  bundesanzeiger: {
    trust: 0.92,
    label: 'Bundesanzeiger',
    aliases: ['bundesanzeiger'],
  },
  handelsregister: {
    trust: 0.92,
    label: 'Handelsregister',
    aliases: ['handelsregister'],
  },
  patent_signals: {
    trust: 0.88,
    label: 'Patent registry',
    aliases: ['patent', 'epo', 'dpma', 'wipo'],
  },
  funding_signals: {
    trust: 0.85,
    label: 'Funding registry',
    aliases: ['foerderdatenbank', 'funding', 'grant'],
  },
  job_posting_trend: {
    trust: 0.70,
    label: 'Job-posting aggregator',
    aliases: ['job_posting', 'job-posting', 'adzuna', 'indeed', 'stepstone'],
  },
  linkedin_company: {
    trust: 0.75,
    label: 'LinkedIn company page',
    aliases: ['linkedin'],
  },
  unknown_blog: {
    trust: 0.45,
    label: 'Unknown blog / forum',
    aliases: ['blog', 'forum', 'medium.com'],
  },
  manual_test: {
    trust: 0.5,
    label: 'Manual / test',
    aliases: ['manual', 'curl', 'test'],
  },
  external: {
    trust: DEFAULT_TRUST,
    label: 'External (uncategorised)',
    aliases: [],
  },
};

function normalise(source: string | undefined | null): string {
  return (source ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function resolve(source: string | undefined | null): TrustEntry | undefined {
  const key = normalise(source);
  if (!key) return undefined;
  if (TRUST_TABLE[key]) return TRUST_TABLE[key];
  // Substring / alias match
  for (const entry of Object.values(TRUST_TABLE)) {
    for (const alias of entry.aliases) {
      if (key.includes(alias)) return entry;
    }
  }
  return undefined;
}

export function sourceTrustScore(source: string | undefined | null): number {
  const entry = resolve(source);
  return entry ? entry.trust : DEFAULT_TRUST;
}

export function sourceTrustLabel(source: string | undefined | null): string {
  const entry = resolve(source);
  return entry ? entry.label : 'External (uncategorised)';
}

/**
 * Apply source trust to a confidence (0..1). The result never raises
 * confidence above its raw value — trust can only attenuate.
 */
export function applyTrustToConfidence(
  confidence: number,
  source: string | undefined | null
): number {
  const trust = sourceTrustScore(source);
  return Math.max(0, Math.min(1, confidence * trust));
}

/**
 * Apply source trust to an impact magnitude (-100..100). Sign is
 * preserved; only the absolute value is attenuated by trust. This
 * keeps risk signals (negative impact) from being amplified by
 * untrusted sources but still preserves the "this is bad news"
 * direction.
 */
export function applyTrustToImpact(
  impact: number,
  source: string | undefined | null
): number {
  const trust = sourceTrustScore(source);
  const sign = impact < 0 ? -1 : 1;
  const adj = Math.abs(impact) * trust;
  return Math.max(-100, Math.min(100, Math.round(sign * adj)));
}

export interface SourceTrustEntry {
  source: string;
  label: string;
  trust: number;
}

/** Returns the canonical trust table for read-only surfaces (admin view). */
export function listSourceTrustEntries(): SourceTrustEntry[] {
  return Object.entries(TRUST_TABLE)
    .map(([source, entry]) => ({
      source,
      label: entry.label,
      trust: entry.trust,
    }))
    .sort((a, b) => b.trust - a.trust);
}
