-- =====================================================================
-- RSG Hiring Signals · runtime_config table
-- =====================================================================
-- Server-side, service-role-only key/value store. Values may be
-- secrets (Hermes API key, OpenRouter key, Adzuna app key, …) so RLS
-- is on and no anon/authenticated policies exist — only the
-- service_role bypass can read or write.
--
-- Idempotent — safe to re-run.
-- =====================================================================

create table if not exists public.runtime_config (
  key          text primary key,
  value        text not null,
  /** Free-form group / category — used by the admin UI to lay out
   *  the form. */
  category     text default 'general',
  /** Plain-language description shown in the admin UI. */
  description  text,
  /** When true, mask the value in API list responses (e.g. API keys). */
  is_secret    boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   text  -- audit trail (admin token id, free-form)
);

create index if not exists runtime_config_category_idx
  on public.runtime_config (category);

alter table public.runtime_config enable row level security;
-- No SELECT/INSERT/UPDATE policies — service_role bypass only.
