/**
 * Shared job-market types. Both the Adzuna adapter
 * (`lib/jobMarketSources.ts`) and the Bundesagentur adapter
 * (`lib/bundesagenturAdapter.ts`) emit the same surface so /api/jobs/*
 * routes can merge them without provider-specific glue.
 */

import { ADZUNA_CATEGORIES } from './jobMarketSources';

export type JobCategoryId = (typeof ADZUNA_CATEGORIES)[number];

/**
 * Per-category aggregate that the dashboard renders. Source-agnostic —
 * whatever provider produced it stays internal to the adapter.
 */
export interface CategorySnapshot {
  category: JobCategoryId;
  postings: number;
  meanSalary: number | null;
  topCompanies: Array<{ name: string; postings: number }>;
  topLocations: Array<{ name: string; postings: number }>;
  fetchedAt: string;
}

/**
 * Auto-discovered company row from the job-feed (e.g. unique employers
 * with multiple active BA postings). Feeds the Companies-Radar so the
 * Mittelstand surface is not constrained to the curated seed.
 */
export interface AggregatedJobRow {
  name: string;
  categories: JobCategoryId[];
  postings: number;
  sampleLocation: string | null;
}
