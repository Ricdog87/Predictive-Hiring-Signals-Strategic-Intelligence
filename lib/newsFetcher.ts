/**
 * Live business-news fetcher · v2 (DACH-Wirtschaftsforum komplett).
 *
 * Curated, free, public German/Austrian/Swiss business-wire RSS feeds.
 * Tiny pure-JS RSS / Atom parser (no deps). Per-feed timeout so a slow
 * source can never hold up the pipeline. Edge-cached for 5 min.
 *
 * v2 expands coverage:
 *   - Big-press: FAZ, Handelsblatt, Süddeutsche, Tagesspiegel, NZZ
 *   - Trade press: Heise, t3n, Gründerszene, Deutsche Startups
 *   - Existing: Tagesschau, Spiegel, Zeit, WiwO, manager-magazin
 *
 * Total feeds: ~16 (up from 9). Expected ~30-50 classified signals/day.
 */

const FEEDS: ReadonlyArray<{
  source: string;
  label: string;
  url: string;
  trust: number;
}> = [
  // ─── Tier-1: National-Public + Top-Press ─────────────────────────────────
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

  // ─── Tier-1: FAZ + Handelsblatt (Pflicht für Recruiter) ──────────────────
  {
    source: 'faz-wirtschaft',
    label: 'FAZ · Wirtschaft',
    url: 'https://www.faz.net/rss/aktuell/wirtschaft/',
    trust: 0.92,
  },
  {
    source: 'faz-unternehmen',
    label: 'FAZ · Unternehmen',
    url: 'https://www.faz.net/rss/aktuell/wirtschaft/unternehmen/',
    trust: 0.92,
  },
  {
    source: 'handelsblatt-unternehmen',
    label: 'Handelsblatt · Unternehmen',
    url: 'https://www.handelsblatt.com/contentexport/feed/unternehmen',
    trust: 0.92,
  },
  {
    source: 'handelsblatt-wirtschaft',
    label: 'Handelsblatt · Wirtschaft',
    url: 'https://www.handelsblatt.com/contentexport/feed/wirtschaft',
    trust: 0.92,
  },

  // ─── Tier-2: Wirtschaftspresse ─────────────────────────────────────────
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
  {
    source: 'sueddeutsche-wirtschaft',
    label: 'Süddeutsche · Wirtschaft',
    url: 'https://rss.sueddeutsche.de/rss/Wirtschaft',
    trust: 0.85,
  },
  {
    source: 'tagesspiegel-wirtschaft',
    label: 'Tagesspiegel · Wirtschaft',
    url: 'https://www.tagesspiegel.de/contentexport/feed/wirtschaft',
    trust: 0.80,
  },

  // ─── Schweiz / Österreich (DACH-South) ──────────────────────────────────
  {
    source: 'nzz-wirtschaft',
    label: 'NZZ · Wirtschaft',
    url: 'https://www.nzz.ch/wirtschaft.rss',
    trust: 0.90,
  },

  // ─── Tech-Hiring-Heavy: Tech / Startup-Szene ────────────────────────────
  {
    source: 'gruenderszene',
    label: 'Gründerszene',
    url: 'https://www.gruenderszene.de/feed',
    trust: 0.80,
  },
  {
    source: 'deutsche-startups',
    label: 'Deutsche-Startups',
    url: 'https://www.deutsche-startups.de/feed/',
    trust: 0.78,
  },
  {
    source: 't3n',
    label: 't3n Magazin',
    url: 'https://t3n.de/news/feed/',
    trust: 0.78,
  },

  // ─── Insolvenz-fokussierte Feeds (Goldmine für Recruiter) ───────────────
  // Bundesanzeiger selber bietet kein RSS, aber Handelsblatt+manager-magazin
  // berichten zeitnah. Klassifier filtert auf signalType=insolvency.
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
      next: { revalidate: 300 },
      headers: {
        'User-Agent': 'rsg-hiring-radar/2.0 (+https://rsg-hiring-radar.local)',
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
