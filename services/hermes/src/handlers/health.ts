import type { Request, Response } from 'express';
import { snapshot } from '../lib/budget';
import { isAuthEnforced } from '../lib/auth';
import { OPENROUTER_INFO } from '../openrouter';

const STARTED_AT = Date.now();

export function healthHandler(_req: Request, res: Response): void {
  res.json({
    ok: true,
    service: 'rsg-hermes',
    version: '0.1.0',
    uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
    auth: isAuthEnforced() ? 'enforced' : 'open',
    openrouter: {
      configured: OPENROUTER_INFO.configured(),
      fastModel: OPENROUTER_INFO.fastModel(),
      deepModel: OPENROUTER_INFO.deepModel(),
      timeoutMs: OPENROUTER_INFO.timeoutMs(),
    },
    budget: snapshot(),
    generatedAt: new Date().toISOString(),
  });
}
