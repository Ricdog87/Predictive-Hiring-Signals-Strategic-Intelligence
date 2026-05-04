/**
 * RSG Hermes · entry point.
 *
 * Tiny Express service that exposes:
 *   GET  /health
 *   POST /analyze-signal
 *   POST /analyze-company
 *   POST /generate-opportunity-brief
 *
 * Bearer-auth is enforced when `HERMES_API_KEY` is set. OpenRouter is
 * the LLM provider; both model tiers + timeouts + budget guardrails
 * are configured from env. See `.env.example`.
 */

import express from 'express';
import { bearerAuth } from './lib/auth';
import { healthHandler } from './handlers/health';
import { analyzeSignalHandler } from './handlers/analyzeSignal';
import { analyzeCompanyHandler } from './handlers/analyzeCompany';
import { opportunityBriefHandler } from './handlers/opportunityBrief';
import { regionalInsightHandler } from './handlers/regionalInsight';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));

// Health is intentionally outside auth so n8n / monitoring can ping
// without sharing secrets.
app.get('/health', healthHandler);

app.use(bearerAuth);

app.post('/analyze-signal', (req, res) => {
  void analyzeSignalHandler(req, res);
});

app.post('/analyze-company', (req, res) => {
  void analyzeCompanyHandler(req, res);
});

app.post('/generate-opportunity-brief', (req, res) => {
  void opportunityBriefHandler(req, res);
});

app.post('/regional-insight', (req, res) => {
  void regionalInsightHandler(req, res);
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'not_found' });
});

const PORT = Number(process.env.PORT ?? process.env.HERMES_PORT ?? 4001);
const HOST = process.env.HERMES_HOST ?? '0.0.0.0';

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[hermes] listening on ${HOST}:${PORT}`);
});
