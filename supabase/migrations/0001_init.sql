-- =====================================================================
-- RSG Hiring Signals · Supabase init migration
-- =====================================================================
-- Idempotent — safe to re-run. Three tables back the persistence
-- layer behind `lib/supabaseStore.ts`. Service-role-only by default;
-- enable Row Level Security and add tenant policies before exposing
-- to authenticated end-users.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ingest_signals · every accepted /api/ingest signal
-- ---------------------------------------------------------------------
create table if not exists public.ingest_signals (
  id            text primary key,                   -- deterministic hash
  company_name  text not null,
  signal_type   text not null,
  source        text not null,
  title         text not null,
  description   text,
  impact        smallint not null check (impact between -100 and 100),
  confidence    real not null check (confidence between 0 and 1),
  observed_at   timestamptz not null,
  received_at   timestamptz not null default now(),
  metadata      jsonb default '{}'::jsonb,
  inserted_at   timestamptz not null default now()
);

create index if not exists ingest_signals_received_at_idx
  on public.ingest_signals (received_at desc);

create index if not exists ingest_signals_company_idx
  on public.ingest_signals (lower(company_name));

create index if not exists ingest_signals_signal_type_idx
  on public.ingest_signals (signal_type);

-- The radar's `lib/ingestStore.ts` produces records with both camelCase
-- and snake_case keys depending on the storage backend. The GET path of
-- `lib/supabaseStore.ts` normalises both shapes back to camelCase, so
-- columns here intentionally use snake_case (Postgres convention).

-- ---------------------------------------------------------------------
-- news_items · historical archive of classified wire feed
-- ---------------------------------------------------------------------
create table if not exists public.news_items (
  link               text primary key,
  title              text not null,
  source             text not null,
  source_label       text not null,
  trust              real not null,
  signal_type        text not null,
  impact             smallint not null check (impact between -100 and 100),
  confidence         real not null check (confidence between 0 and 1),
  entity_canonical   text not null,
  entity_sector      text,
  entity_region      text,
  published_at       timestamptz not null,
  classified_at      timestamptz not null default now(),
  breaking           boolean not null default false
);

create index if not exists news_items_classified_at_idx
  on public.news_items (classified_at desc);

create index if not exists news_items_signal_type_idx
  on public.news_items (signal_type);

create index if not exists news_items_breaking_idx
  on public.news_items (breaking) where breaking = true;

-- ---------------------------------------------------------------------
-- intel_snapshots · daily archive of /api/intel/snapshot
-- ---------------------------------------------------------------------
create table if not exists public.intel_snapshots (
  id            uuid primary key default gen_random_uuid(),
  generated_at  timestamptz not null default now(),
  payload       jsonb not null
);

create index if not exists intel_snapshots_generated_at_idx
  on public.intel_snapshots (generated_at desc);

-- ---------------------------------------------------------------------
-- Row level security · default DENY for non-service-role
-- ---------------------------------------------------------------------
-- The radar's API routes use the SERVICE_ROLE key, which bypasses RLS.
-- We enable RLS so anon users can never reach this data, even if the
-- ANON key leaks. SaaS tenant policies will be layered in a later
-- migration (e.g. 0002_tenants.sql) once we have a `tenants` table.

alter table public.ingest_signals  enable row level security;
alter table public.news_items      enable row level security;
alter table public.intel_snapshots enable row level security;

-- No policies are defined here on purpose — service_role already has
-- bypass; anon and authenticated roles get nothing until a future
-- migration grants per-tenant SELECT.
