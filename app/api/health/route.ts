import { ingestStoreTier } from '../../../lib/ingestStore';
import { pingSupabase, isSupabaseConfigured } from '../../../lib/supabaseStore';
import { isHermesConfigured, hermesHealth } from '../../../lib/hermesClient';
import { isMirofishConfigured } from '../../../lib/mirofishClient';
import { isAdzunaConfigured } from '../../../lib/jobMarketSources';
import { isAuthEnforced as isApiKeyAuthEnforced, listConfiguredKeyIds } from '../../../lib/apiKeys';
import { fetchDEUnemployment } from '../../../lib/macro';
import { fetchECBRate } from '../../../lib/macroSources';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface IntegrationStatus {
  name: string;
  configured: boolean;
  ok?: boolean;
  detail?: string;
  latencyMs?: number;
}

/**
 * One endpoint to ask: "is the system breathing?" Pings every external
 * dependency in parallel, returns a single status doc the user can
 * curl from a monitor / wire into UptimeRobot.
 *
 * Always responds 200 — body's `ok` flag tells you whether everything
 * is green. The status code stays 200 so a single integration outage
 * doesn't trigger a deployment-level alarm.
 */
export async function GET() {
  const t0 = Date.now();

  const ingestTier = ingestStoreTier();

  // Run probes in parallel; cap each one at the per-source timeout
  // already configured in the underlying modules.
  const probes = await Promise.allSettled([
    isSupabaseConfigured() ? pingSupabase() : Promise.resolve({ ok: false as const, reason: 'unconfigured' }),
    isHermesConfigured() ? hermesHealth() : Promise.resolve({ ok: false as const, reason: 'unconfigured' }),
    fetchDEUnemployment(),
    fetchECBRate(),
  ]);

  const [supabase, hermes, eurostat, ecb] = probes;

  const settledOk = (s: PromiseSettledResult<unknown>): { ok: boolean; reason?: string } => {
    if (s.status === 'rejected') return { ok: false, reason: 'rejected' };
    const v = s.value as { ok: boolean; reason?: string };
    return { ok: v.ok, reason: v.reason };
  };

  const integrations: IntegrationStatus[] = [
    {
      name: 'ingest_store',
      configured: true,
      ok: true,
      detail: `tier: ${ingestTier}`,
    },
    {
      name: 'supabase',
      configured: isSupabaseConfigured(),
      ok: isSupabaseConfigured() ? settledOk(supabase).ok : false,
      detail: isSupabaseConfigured()
        ? settledOk(supabase).reason
        : 'not configured (memory fallback active)',
      latencyMs:
        supabase.status === 'fulfilled'
          ? (supabase.value as { latencyMs?: number }).latencyMs
          : undefined,
    },
    {
      name: 'hermes',
      configured: isHermesConfigured(),
      ok: isHermesConfigured() ? settledOk(hermes).ok : false,
      detail: isHermesConfigured()
        ? settledOk(hermes).reason
        : 'not configured (LLM endpoints will fall back gracefully)',
    },
    {
      name: 'mirofish',
      configured: isMirofishConfigured(),
      ok: false,
      detail: isMirofishConfigured() ? 'configured' : 'stub (v1 expected)',
    },
    {
      name: 'adzuna',
      configured: isAdzunaConfigured(),
      ok: isAdzunaConfigured(),
      detail: isAdzunaConfigured() ? 'configured' : 'not configured (job market unavailable)',
    },
    {
      name: 'eurostat_unemployment',
      configured: true,
      ok: settledOk(eurostat).ok,
      detail: settledOk(eurostat).reason ?? 'live',
    },
    {
      name: 'ecb_main_rate',
      configured: true,
      ok: settledOk(ecb).ok,
      detail: settledOk(ecb).reason ?? 'live',
    },
  ];

  // The dashboard is "green" when the data layer is reachable. Hermes
  // / Adzuna / Supabase being optional means their absence is `false`
  // but doesn't drag the overall flag.
  const required = integrations.filter((i) =>
    ['ingest_store', 'eurostat_unemployment', 'ecb_main_rate'].includes(i.name)
  );
  const overallOk = required.every((i) => i.ok);

  return Response.json({
    ok: overallOk,
    service: 'rsg-hiring-radar',
    deploymentLabel: process.env.VERCEL_GIT_COMMIT_REF ?? 'local',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    auth: {
      saasGate: isApiKeyAuthEnforced() ? 'enforced' : 'open',
      saasKeyCount: listConfiguredKeyIds().length,
    },
    integrations,
    latencyMs: Date.now() - t0,
    generatedAt: new Date().toISOString(),
  });
}
