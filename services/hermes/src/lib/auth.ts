/**
 * Bearer-token middleware · v1.
 *
 * If `HERMES_API_KEY` is set, every request must carry a matching
 * `Authorization: Bearer <token>` header. If the env var is absent we
 * leave the service open — useful for local development against a
 * Hostinger instance still being wired up, but **never** ship an open
 * production deploy: set the key.
 */

import type { NextFunction, Request, Response } from 'express';

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.HERMES_API_KEY?.trim();
  if (!expected) {
    next();
    return;
  }
  const header = req.header('authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1].trim() !== expected) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }
  next();
}

export function isAuthEnforced(): boolean {
  return Boolean(process.env.HERMES_API_KEY?.trim());
}
