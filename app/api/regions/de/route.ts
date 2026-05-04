import { getAggregates } from '../../../../lib/mockData';
import { aggregateRegional } from '../../../../lib/regionalAggregation';
import { fetchDERegionalUnemployment } from '../../../../lib/macro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [aggregates, regionalUnemployment] = await Promise.all([
    getAggregates(),
    fetchDERegionalUnemployment(),
  ]);

  const result = aggregateRegional({ aggregates });

  // Overlay Eurostat per-NUTS unemployment when available — non-blocking.
  if (regionalUnemployment.ok) {
    const byNuts = regionalUnemployment.data.byNuts;
    const overlay = (rate: number | undefined, period: string | undefined) =>
      rate !== undefined ? { unemploymentRate: rate, unemploymentPeriod: period ?? null } : null;

    result.bundeslaender = result.bundeslaender.map((b) => {
      const m = byNuts[b.nuts];
      const o = overlay(m?.rate, m?.period);
      return o ? { ...b, ...o } : b;
    });
    // also attach into quadrant.bundeslaender list (same objects via reference)
    for (const q of result.quadrants) {
      q.bundeslaender = q.bundeslaender.map((b) => {
        const m = byNuts[b.nuts];
        const o = overlay(m?.rate, m?.period);
        return o ? { ...b, ...o } : b;
      });
    }
  }

  return Response.json({
    ok: true,
    quadrants: result.quadrants,
    bundeslaender: result.bundeslaender,
    unclassifiedCompanyCount: result.unclassifiedCompanyCount,
    macro: regionalUnemployment.ok
      ? {
          source: regionalUnemployment.data.source,
          indicator: regionalUnemployment.data.indicator,
          fetchedAt: regionalUnemployment.data.fetchedAt,
          available: Object.keys(regionalUnemployment.data.byNuts).length,
        }
      : { error: regionalUnemployment.reason ?? 'unavailable' },
    generatedAt: new Date().toISOString(),
  });
}
