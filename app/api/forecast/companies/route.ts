import { NextRequest } from 'next/server';
import { getAggregates } from '../../../../lib/mockData';
import {
  computeForecasts,
  summariseForecasts,
  FORECAST_WINDOWS,
} from '../../../../lib/hiringForecast';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/forecast/companies?topN=10&minConfidence=0.4&horizon=90
 *
 *   topN          1..100 — how many forecasts to return (default 25)
 *   minConfidence 0..1   — drop companies with weaker signal corroboration
 *   horizon       30|60|90|180 — sort key. Default 90.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const topN = Math.max(1, Math.min(100, Number(url.searchParams.get('topN') ?? '25')));
  const minConfidence = Math.max(
    0,
    Math.min(1, Number(url.searchParams.get('minConfidence') ?? '0'))
  );
  const horizonRaw = Number(url.searchParams.get('horizon') ?? '90');
  const horizon: (typeof FORECAST_WINDOWS)[number] = (FORECAST_WINDOWS as readonly number[]).includes(horizonRaw)
    ? (horizonRaw as (typeof FORECAST_WINDOWS)[number])
    : 90;

  const aggregates = await getAggregates();
  const forecasts = computeForecasts(aggregates, {
    minConfidence,
    // Sort by selected horizon's max probability across families,
    // not the default forwardScore. We compute that here so callers
    // can switch lens without re-ranking client-side.
  });

  // Re-rank by horizon if requested (default already correct for 90).
  if (horizon !== 90) {
    forecasts.sort((a, b) => {
      const aMax = Math.max(0, ...a.byFamily.map((f) => f[`probability${horizon}` as const]));
      const bMax = Math.max(0, ...b.byFamily.map((f) => f[`probability${horizon}` as const]));
      return bMax - aMax;
    });
  }

  const sliced = forecasts.slice(0, topN);
  return Response.json({
    ok: true,
    horizon,
    minConfidence,
    count: sliced.length,
    summary: summariseForecasts(forecasts),
    data: sliced,
    generatedAt: new Date().toISOString(),
  });
}
