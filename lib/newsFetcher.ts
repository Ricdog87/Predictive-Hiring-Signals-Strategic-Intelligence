/**
 * Live business-news fetcher · v1.
 *
 * Pulls from a curated set of free, public German business-wire RSS
 * feeds, parses them with a tiny pure-JS RSS / Atom parser (no deps),
 * runs each feed in parallel with a hard per-feed timeout so a slow
 * source can never hold up the whole pipeline. Designed to run inside
 * a single Vercel function invocation, behind a `next.revalidate`
 * cache so the upstream gets one hit every N minutes regardless of
 * how many users open the dashboard.
 *
 * Curated for v1 — every feed below is publicly accessible without
 * auth and returns RSS 2.0 / Atom (no JSON-only feeds).
 */

const FEEDS: ReadonlyArray<{
  source: string;
  label: string;
  url: string;
  trust: number;
}> = [
  {
    source: 'tagesschau-wirtschaft',
    label: 'Tagesschau · Wirtschaft',
    url: 'https://www.tagesschau.de/wirtschaft/index~rss2.xml',
    trust: 0.92,
  },
  {
    source: 'spiegel-wirtschaft',
    label: 'Spiegel · Wirtschaft',
    url: 'https://www.spiegel.de/wirtschaft/index.rss',
    trust: 0.85,
  },
  {
    source: 'spiegel-eilmeldungen',
    label: 'Spiegel · Eilmeldungen',
    url: 'https://www.spiegel.de/schlagzeilen/eilmeldungen/index.rss',
    trust: 0.90,
  },
  {
    source: 'spiegel-top',
    label: 'Spiegel · Top-News',
    url: 'https://www.spiegel.de/schlagzeilen/index.rss',
    trust: 0.85,
  },
  // Tagesschau eilmeldungen RSS retired upstream (HTTP 404 since 2025);
  // breaking news from Tagesschau still flows through the main
  // wirtschaft feed above. Re-add a replacement URL here if ARD
  // restores a public eilmeldungen RSS.
  {
    source: 'zeit-wirtschaft',
    label: 'Zeit · Wirtschaft',
    url: 'https://newsfeed.zeit.de/wirtschaft/index',
    trust: 0.85,
  },
  {
    source: 'wirtschaftswoche',
    label: 'WirtschaftsWoche',
    url: 'https://feeds.cms.wiwo.de/rss/schlagzeilen',
    trust: 0.85,
  },
  {
    source: 'manager-magazin',
    label: 'Manager Magazin',
    url: 'https://www.manager-magazin.de/index.rss',
    trust: 0.90,
  },
  {
    source: 'manager-magazin-unternehmen',
    label: 'Manager Magazin · Unternehmen',
    url: 'https://www.manager-magazin.de/unternehmen/index.rss',
    trust: 0.90,
  },
];

const PER_FEED_TIMEOUT_MS = Number(
  process.env.NEWS_PER_FEED_TIMEOUT_MS ?? 5_000
);
const MAX_AGE_DAYS = Number(process.env.NEWS_MAX_AGE_DAYS ?? 7);
const MAX_ITEMS_PER_FEED = 25;

export interface RawNewsItem {
  source: string;
  sourceLabel: string;
  trust: number;
  title: string;
  description: string;
  link: string;
  publishedAt: string;
  ageHours: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : '';
}

function extractAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]+)"`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

function parseFeed(
  source: string,
  sourceLabel: string,
  trust: number,
  body: string
): RawNewsItem[] {
  const blocks = body.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  const cutoffMs = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const out: RawNewsItem[] = [];

  for (const block of blocks.slice(0, MAX_ITEMS_PER_FEED)) {
    const title = extractTag(block, 'title');
    if (!title) continue;

    let link = extractTag(block, 'link');
    if (!link) link = extractAttr(block, 'link', 'href');
    link = (link ?? '').trim();

    const description =
      extractTag(block, 'description') ||
      extractTag(block, 'summary') ||
      extractTag(block, 'content');

    const pubRaw =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'updated') ||
      extractTag(block, 'published') ||
      extractTag(block, 'dc:date');
    const pub = pubRaw ? new Date(pubRaw) : new Date();
    if (Number.isNaN(pub.getTime())) continue;
    if (pub.getTime() < cutoffMs) continue;

    out.push({
      source,
      sourceLabel,
      trust,
      title,
      description: description.slice(0, 400),
      link,
      publishedAt: pub.toISOString(),
      ageHours: Math.max(0, (Date.now() - pub.getTime()) / 3_600_000),
    });
  }

  return out;
}

async function fetchOne(
  feed: (typeof FEEDS)[number]
): Promise<RawNewsItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_FEED_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      // edge cache: every 5 min is plenty for breaking-news polling.
      next: { revalidate: 300 },
      headers: {
        'User-Agent': 'rsg-hiring-radar/1.0 (+https://rsg-hiring-radar.local)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml; q=0.9',
      },
    });
    if (!res.ok) return [];
    const body = await res.text();
    return parseFeed(feed.source, feed.label, feed.trust, body);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export interface FetchAllResult {
  items: RawNewsItem[];
  feeds: Array<{ source: string; label: string; itemCount: number; ok: boolean }>;
}

export async function fetchAllNews(): Promise<FetchAllResult> {
  const settled = await Promise.all(
    FEEDS.map(async (f) => {
      const items = await fetchOne(f);
      return { feed: f, items };
    })
  );

  const items = settled.flatMap((s) => s.items);
  // Newest first.
  items.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

  const feeds = settled.map((s) => ({
    source: s.feed.source,
    label: s.feed.label,
    itemCount: s.items.length,
    ok: s.items.length > 0,
  }));

  return { items, feeds };
}

export const NEWS_FEEDS = FEEDS;
