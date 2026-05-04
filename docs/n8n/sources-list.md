# Live Source Registry · v1

This is the seed list shipped in `sources-sample.csv` for the `RSG Hiring
Signals Live Ingest v1` workflow. Every row here is a publicly accessible
press / newsroom RSS feed — no scraping, no auth.

| # | Company           | Source type   | Feed                                                              | Region        | Industry              | Priority |
|---|-------------------|---------------|-------------------------------------------------------------------|---------------|-----------------------|----------|
| 1 | SAP SE            | newsroom_rss  | https://news.sap.com/feed/                                        | DACH · South  | Enterprise Software   | 1        |
| 2 | Siemens AG        | press_rss     | https://press.siemens.com/global/en/rss.xml                       | DACH · South  | Industrial AI         | 1        |
| 3 | Bosch GmbH        | press_rss     | https://www.bosch-presse.de/pressportal/de/de/feed.rss            | DACH · South  | Mobility & Automotive | 1        |
| 4 | Volkswagen AG     | newsroom_rss  | https://www.volkswagen-newsroom.com/en/rss-feed-1612              | DACH · North  | Mobility & Automotive | 2        |
| 5 | Deutsche Bank AG  | press_rss     | https://www.db.com/news/rss-feed.xml                              | DACH · North  | Financial Services    | 2        |
| 6 | BASF SE           | press_rss     | https://www.basf.com/global/en/news/rss-feeds.html                | DACH · West   | Chemicals & Energy    | 2        |
| 7 | Deutsche Telekom  | press_rss     | https://www.telekom.com/resource/blob/rss/de/medien.xml           | DACH · West   | Telecom & Cloud       | 2        |
| 8 | Allianz SE        | press_rss     | https://www.allianz.com/en/press.xml                              | DACH · South  | Financial Services    | 3        |

## Future expansion (planned, not in v1)

- **Bundesanzeiger** – legal disclosures, registered changes (`bundesanzeiger.de`). Requires a custom HTML adapter or paid API.
- **Handelsregister** – company-register changes via `handelsregister.de`. Custom adapter.
- **DPMA / EPO** – patent filings via the official EPO OPS REST API (free, key-gated).
- **Bundesförderdatenbank** – funding / grants. RSS available.
- **LinkedIn company posts** – via 3rd-party (PhantomBuster / Apify). Skip until we have a paid-tier slot.
- **Job posting trends** – Adzuna / Indeed publisher APIs.

## Source-type taxonomy

The `source_type` column is informational and is forwarded into the ingest
payload's `source` field. Recognised values:

- `newsroom_rss` – the company's own newsroom feed
- `press_rss` – press department feed (often longer, includes financial PR)
- `bundesanzeiger` – legal disclosures (planned)
- `handelsregister` – company-register changes (planned)
- `patent` – patent filings (planned)
- `funding` – grants / public funding (planned)
- `job_posting_trend` – aggregated job-board signals (planned)

## Priority semantics

| Priority | Trust modifier (multiplier on confidence) |
|----------|-------------------------------------------|
| 1        | 1.00 — flagship source, near-zero noise   |
| 2        | 0.92                                      |
| 3        | 0.84                                      |
| 4        | 0.76                                      |
| 5        | 0.68 — community / experimental           |

Set this conservatively. The classifier in `Code · Classify + Score` multiplies
the rule's base confidence by this trust modifier.
