import { NextRequest } from 'next/server';
import { checkAdmin, denyAdmin } from '../../../../lib/adminAuth';
import {
  CONFIG_KEYS,
  BOOTSTRAP_KEYS,
  setConfig,
  deleteConfig,
  snapshotConfig,
  clearRuntimeConfigCache,
} from '../../../../lib/runtimeConfig';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_KEYS = new Set(CONFIG_KEYS.map((k) => k.key));

/** GET — list every config knob with masked values + source. */
export async function GET(req: NextRequest) {
  const auth = checkAdmin(req);
  const denied = denyAdmin(auth);
  if (denied) return denied;

  const data = await snapshotConfig();
  return Response.json({
    ok: true,
    data,
    generatedAt: new Date().toISOString(),
  });
}

interface PostBody {
  key?: string;
  value?: string;
}

/** POST — set/upsert one config value. */
export async function POST(req: NextRequest) {
  const auth = checkAdmin(req);
  const denied = denyAdmin(auth);
  if (denied) return denied;

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const key = (body.key ?? '').trim();
  const value = (body.value ?? '').trim();
  if (!key) {
    return Response.json({ ok: false, error: 'key required' }, { status: 400 });
  }
  if (!ALLOWED_KEYS.has(key)) {
    return Response.json(
      { ok: false, error: 'unknown_key', detail: `${key} is not editable` },
      { status: 400 }
    );
  }
  if (BOOTSTRAP_KEYS.has(key)) {
    return Response.json(
      { ok: false, error: 'bootstrap_locked', detail: 'set this in Vercel env' },
      { status: 400 }
    );
  }

  const r = await setConfig(key, value);
  if (!r.ok) {
    return Response.json(
      { ok: false, error: r.reason ?? 'write_failed' },
      { status: 500 }
    );
  }
  clearRuntimeConfigCache();
  return Response.json({ ok: true, key, generatedAt: new Date().toISOString() });
}

/** DELETE ?key=… — clear a config value. */
export async function DELETE(req: NextRequest) {
  const auth = checkAdmin(req);
  const denied = denyAdmin(auth);
  if (denied) return denied;

  const url = new URL(req.url);
  const key = (url.searchParams.get('key') ?? '').trim();
  if (!key || !ALLOWED_KEYS.has(key) || BOOTSTRAP_KEYS.has(key)) {
    return Response.json(
      { ok: false, error: 'invalid_key' },
      { status: 400 }
    );
  }
  const r = await deleteConfig(key);
  clearRuntimeConfigCache();
  return Response.json({ ok: r.ok, key, generatedAt: new Date().toISOString() });
}
