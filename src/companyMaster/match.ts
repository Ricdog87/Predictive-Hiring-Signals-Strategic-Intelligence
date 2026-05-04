import {
  COMPANY_MASTER,
  CompanyMasterRecord,
  UNKNOWN_CLUSTER,
  UNKNOWN_REGION,
  UNKNOWN_SECTOR,
  fallbackCluster,
} from './master';

const LEGAL_SUFFIXES = [
  'gmbh & co kg',
  'gmbh & co. kg',
  'gmbh',
  'ag',
  'se',
  'kg',
  'ohg',
  'ug',
  'ev',
  'e.v.',
  'inc',
  'inc.',
  'llc',
  'ltd',
  'limited',
  'plc',
  'corp',
  'corporation',
  'co',
];

export function normalizeName(name: string): string {
  let n = name.trim().toLowerCase();
  n = n
    .replace(/&/g, ' and ')
    .replace(/[Ää]/g, 'ae')
    .replace(/[Öö]/g, 'oe')
    .replace(/[Üü]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const suffix of LEGAL_SUFFIXES) {
    if (n.endsWith(' ' + suffix)) n = n.slice(0, -suffix.length - 1).trim();
  }
  return n;
}

function tokenize(n: string): Set<string> {
  return new Set(n.split(' ').filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function stringSimilarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const max = Math.max(a.length, b.length);
  return max === 0 ? 0 : 1 - levenshtein(a, b) / max;
}

interface ScoredMatch {
  record: CompanyMasterRecord;
  score: number;
}

const FUZZY_ACCEPT_THRESHOLD = 0.78;

export function findMasterRecord(rawName: string): CompanyMasterRecord | undefined {
  const candidate = normalizeName(rawName);
  if (!candidate) return undefined;

  const candidateTokens = tokenize(candidate);
  let best: ScoredMatch | undefined;

  for (const record of COMPANY_MASTER) {
    const variants = [record.name, ...record.aliases].map(normalizeName);
    for (const variant of variants) {
      if (!variant) continue;
      if (variant === candidate) return record;
      const tokenScore = jaccard(candidateTokens, tokenize(variant));
      const charScore = stringSimilarity(candidate, variant);
      const score = tokenScore * 0.6 + charScore * 0.4;
      if (!best || score > best.score) best = { record, score };
    }
  }

  if (best && best.score >= FUZZY_ACCEPT_THRESHOLD) return best.record;
  return undefined;
}

export interface ResolvedCompany {
  companyId: string;
  companyName: string;
  matched: boolean;
  record?: CompanyMasterRecord;
}

export function resolveCompany(rawName: string): ResolvedCompany {
  const trimmed = rawName.trim();
  const record = findMasterRecord(trimmed);
  if (record) {
    return { companyId: record.id, companyName: record.name, matched: true, record };
  }
  const slug = normalizeName(trimmed).replace(/\s+/g, '_') || 'unknown';
  return {
    companyId: `comp_${slug}`,
    companyName: trimmed || 'Unknown Company',
    matched: false,
  };
}

export interface CompanyEnrichment {
  sector: string;
  region: string;
  cluster: string;
  headquarters: string;
  employeeCount: number;
  matched: boolean;
}

export function enrichCompany(record: CompanyMasterRecord | undefined): CompanyEnrichment {
  if (!record) {
    return {
      sector: UNKNOWN_SECTOR,
      region: UNKNOWN_REGION,
      cluster: UNKNOWN_CLUSTER,
      headquarters: UNKNOWN_REGION,
      employeeCount: 0,
      matched: false,
    };
  }
  return {
    sector: record.sector,
    region: record.region,
    cluster: record.cluster || fallbackCluster(record.sector, record.region),
    headquarters: record.headquarters,
    employeeCount: record.employeeCount,
    matched: true,
  };
}

export function getMasterRecordById(id: string): CompanyMasterRecord | undefined {
  return COMPANY_MASTER.find((r) => r.id === id);
}

/**
 * Resolve sector/region/cluster for an existing company profile by consulting
 * the company master. Tries id lookup first, then a fuzzy name match. Falls
 * back to the profile's own fields when no master record is available, and
 * finally to the UNKNOWN_* constants — never to the bare literal "unknown".
 */
export interface ProfileLike {
  id?: string;
  name?: string;
  industry?: string;
  headquarters?: string;
}

const PLACEHOLDER_VALUES = new Set(['', 'unknown', 'n/a', 'na', 'none']);

function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

export interface ProfileEnrichment {
  sector: string;
  region: string;
  cluster: string;
  headquarters: string;
  matched: boolean;
  record?: CompanyMasterRecord;
}

export function enrichProfile(profile: ProfileLike): ProfileEnrichment {
  const record =
    (profile.id ? getMasterRecordById(profile.id) : undefined) ??
    (profile.name ? findMasterRecord(profile.name) : undefined);

  if (record) {
    return {
      sector: record.sector,
      region: record.region,
      cluster: record.cluster || fallbackCluster(record.sector, record.region),
      headquarters: record.headquarters,
      matched: true,
      record,
    };
  }

  const sector = isPlaceholder(profile.industry) ? UNKNOWN_SECTOR : profile.industry!;
  const region = isPlaceholder(profile.headquarters) ? UNKNOWN_REGION : profile.headquarters!;
  return {
    sector,
    region,
    cluster: fallbackCluster(sector, region),
    headquarters: region,
    matched: false,
  };
}
