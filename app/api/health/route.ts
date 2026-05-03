import { getCompanies, getSignals } from "../../../lib/mockData";
import { rateLimit } from "../../../lib/rateLimit";

export const revalidate = 60;

const AVAILABLE_ROUTES = [
  "/api/health",
  "/api/ingest",
  "/api/companies",
  "/api/company/[id]",
  "/api/signals",
  "/api/sectors",
  "/api/regions",
  "/api/clusters",
  "/api/predictions",
  "/api/score",
  "/api/market-overview",
];

export async function GET(req: Request) {
  const limited = rateLimit({ key: `health:${req.headers.get("x-forwarded-for") ?? "anon"}`, limit: 120 });
  if (limited) return limited;

  const [companies, signals] = await Promise.all([getCompanies(), getSignals()]);

  return Response.json({
    status: "ok",
    version: process.env.npm_package_version ?? "0.0.0",
    build: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_BUILD_ID ?? "local",
    environment: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
    companiesCount: companies.length,
    signalsCount: signals.length,
    routesAvailable: AVAILABLE_ROUTES,
  });
}
