"use client";

import { useEffect, useMemo, useState } from "react";

interface ConfigEntry {
  key: string;
  category: 'engine' | 'intel' | 'jobmarket' | 'gating' | 'pipeline' | 'tuning';
  label: string;
  description: string;
  isSecret: boolean;
  placeholder?: string;
  value: string | null;
  display: string | null;
  source: 'supabase' | 'env' | 'unset';
  bootstrap: boolean;
}

interface BootstrapStatus {
  ok: boolean;
  adminBootstrapped: boolean;
  supabaseConfigured: boolean;
  runtimeConfigSupabaseConfigured: boolean;
  runtimeConfigTtlMs: number;
}

const STORAGE_KEY = 'rsg.admin.token.v1';

const CATEGORY_LABEL: Record<ConfigEntry['category'], string> = {
  engine: 'Intelligence Engine',
  intel: 'Intelligence',
  jobmarket: 'Job Market',
  gating: 'API Gate · SaaS',
  pipeline: 'Ingest Pipeline',
  tuning: 'Cost Guardrails',
};

const CATEGORY_ORDER: ConfigEntry['category'][] = [
  'engine',
  'pipeline',
  'jobmarket',
  'gating',
  'tuning',
  'intel',
];

export default function AdminSettingsPage() {
  const [bootstrap, setBootstrap] = useState<BootstrapStatus | null>(null);
  const [token, setToken] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [verified, setVerified] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  // Load bootstrap status (no auth)
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/health', { cache: 'no-store' });
      const j = (await res.json()) as BootstrapStatus;
      setBootstrap(j);
    })();
    const t = window.localStorage.getItem(STORAGE_KEY);
    if (t) setToken(t);
  }, []);

  // Verify token if present
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/health?verify=1', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setVerified(true);
          setVerifyError(null);
          loadEntries(token);
        } else {
          setVerified(false);
          setVerifyError('token invalid');
          window.localStorage.removeItem(STORAGE_KEY);
          setToken('');
        }
      } catch (e) {
        setVerifyError((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadEntries(t: string) {
    try {
      const res = await fetch('/api/admin/config', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        setError(`status ${res.status}`);
        return;
      }
      const j = (await res.json()) as { ok: boolean; data: ConfigEntry[] };
      setEntries(j.data ?? []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveOne(key: string) {
    if (!token) return;
    const value = drafts[key] ?? '';
    setSavingKey(key);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(`save failed · ${(j as { error?: string }).error ?? res.status}`);
        return;
      }
      setSavedAt((s) => ({ ...s, [key]: Date.now() }));
      setDrafts((d) => {
        const n = { ...d };
        delete n[key];
        return n;
      });
      await loadEntries(token);
    } finally {
      setSavingKey(null);
    }
  }

  async function clearOne(key: string) {
    if (!token) return;
    if (!confirm(`Wert für ${key} wirklich löschen?`)) return;
    setSavingKey(key);
    try {
      await fetch(`/api/admin/config?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadEntries(token);
    } finally {
      setSavingKey(null);
    }
  }

  function applyToken(t: string) {
    if (!t.trim()) return;
    window.localStorage.setItem(STORAGE_KEY, t.trim());
    setToken(t.trim());
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
    setToken('');
    setVerified(false);
    setEntries([]);
  }

  const grouped = useMemo(() => {
    const m = new Map<ConfigEntry['category'], ConfigEntry[]>();
    for (const e of entries) {
      const list = m.get(e.category) ?? [];
      list.push(e);
      m.set(e.category, list);
    }
    return CATEGORY_ORDER.map((c) => ({ category: c, items: m.get(c) ?? [] })).filter(
      (g) => g.items.length > 0
    );
  }, [entries]);

  // ========== render ==========

  // 0) Bootstrap not done — show static instruction.
  if (bootstrap && !bootstrap.adminBootstrapped) {
    return (
      <Frame>
        <BootstrapBlocked />
      </Frame>
    );
  }

  // 1) Need to auth.
  if (!verified) {
    return (
      <Frame>
        <div className="max-w-md mx-auto p-6 rounded-md border border-bg-border bg-bg-panel mt-12">
          <div className="label-eyebrow text-accent-cyan mb-1">Admin Settings</div>
          <h1 className="text-[16px] font-semibold text-text-primary">
            Zugriff freischalten
          </h1>
          <p className="mt-1 text-[12.5px] text-text-secondary">
            Gib das Admin-Token ein. Es wird lokal in deinem Browser gespeichert
            und bei jedem API-Aufruf als Bearer-Token mitgesendet.
          </p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyToken(tokenInput);
            }}
            placeholder="ADMIN_TOKEN"
            className="mt-3 w-full rounded-sm border border-bg-border bg-bg-surface px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent-cyan"
          />
          {verifyError && (
            <div className="mt-2 text-[12px] text-accent-red">{verifyError}</div>
          )}
          <button
            type="button"
            onClick={() => applyToken(tokenInput)}
            className="mt-3 w-full rounded-sm border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 text-[12.5px] font-mono uppercase tracking-terminal text-accent-cyan hover:bg-accent-cyan/20"
          >
            ▸ Unlock
          </button>
          <div className="mt-3 font-mono text-2xs uppercase tracking-terminal text-text-muted">
            {bootstrap?.supabaseConfigured
              ? '✓ Supabase ready · runtime config will persist'
              : '✗ Supabase not configured · changes will only live in this lambda'}
          </div>
        </div>
      </Frame>
    );
  }

  // 2) Authed — show the form.
  return (
    <Frame>
      <div className="px-5 py-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="label-eyebrow text-accent-cyan">Admin · Runtime Configuration</div>
            <h1 className="text-[18px] font-semibold text-text-primary">
              Dashboard Settings
            </h1>
            <p className="mt-0.5 text-[12.5px] text-text-secondary max-w-2xl">
              Alle Werte werden in Supabase persistiert und vom Dashboard live
              gelesen. Keine Vercel-UI nötig, kein Redeploy nach Änderungen —
              die Caches rotieren innerhalb von 60 Sekunden.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs uppercase tracking-terminal text-text-muted">
              ✓ admin · {bootstrap?.runtimeConfigSupabaseConfigured ? 'persisted' : 'in-memory'}
            </span>
            <button
              type="button"
              onClick={logout}
              className="rounded-sm border border-bg-border bg-bg-panel px-2 py-0.5 font-mono text-2xs uppercase tracking-terminal text-text-secondary hover:text-text-primary"
            >
              ↪ logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-sm border border-accent-red/40 bg-accent-red/[0.06] px-3 py-2 font-mono text-[11px] text-accent-red">
            {error}
          </div>
        )}

        <div className="mt-5 space-y-6">
          {grouped.map((g) => (
            <section
              key={g.category}
              className="rounded-md border border-bg-border bg-bg-panel"
            >
              <header className="border-b border-bg-border px-4 py-2">
                <div className="label-eyebrow text-accent-cyan">
                  {CATEGORY_LABEL[g.category]}
                </div>
              </header>
              <ul className="divide-y divide-bg-line/50">
                {g.items.map((e) => {
                  const draft = drafts[e.key] ?? '';
                  const justSaved = savedAt[e.key] && Date.now() - savedAt[e.key] < 4000;
                  return (
                    <li key={e.key} className="px-4 py-3 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-text-primary">
                          {e.label}
                        </div>
                        <div className="font-mono text-2xs uppercase tracking-wider text-text-muted">
                          {e.key}
                        </div>
                        <div className="mt-1 text-[12px] text-text-secondary leading-snug">
                          {e.description}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-text-muted">
                          <SourceBadge source={e.source} />
                          {e.isSecret && <span className="text-accent-amber">secret</span>}
                          {e.bootstrap && <span className="text-accent-red">bootstrap-locked</span>}
                        </div>
                      </div>

                      <div className="min-w-0">
                        {e.value && (
                          <div className="font-mono text-2xs uppercase tracking-wider text-text-muted mb-1">
                            current · {e.display}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type={e.isSecret ? 'password' : 'text'}
                            value={draft}
                            onChange={(ev) =>
                              setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))
                            }
                            placeholder={e.placeholder ?? (e.value ? '(unverändert)' : '')}
                            className="flex-1 min-w-0 rounded-sm border border-bg-border bg-bg-surface px-3 py-1.5 text-[12.5px] text-text-primary outline-none focus:border-accent-cyan disabled:opacity-50"
                            disabled={e.bootstrap || savingKey === e.key}
                          />
                          <button
                            type="button"
                            onClick={() => saveOne(e.key)}
                            disabled={
                              e.bootstrap ||
                              savingKey === e.key ||
                              !draft.trim()
                            }
                            className="rounded-sm border border-accent-green/40 bg-accent-green/10 px-3 py-1 font-mono text-2xs uppercase tracking-terminal text-accent-green hover:bg-accent-green/20 disabled:opacity-30"
                          >
                            {savingKey === e.key
                              ? 'speichert…'
                              : justSaved
                              ? '✓ saved'
                              : '▸ save'}
                          </button>
                          {e.value && !e.bootstrap && (
                            <button
                              type="button"
                              onClick={() => clearOne(e.key)}
                              disabled={savingKey === e.key}
                              className="rounded-sm border border-bg-border bg-bg-panel px-2 py-1 font-mono text-2xs uppercase tracking-terminal text-text-muted hover:border-accent-red/40 hover:text-accent-red"
                            >
                              ✕ clear
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-6 font-mono text-2xs uppercase tracking-terminal text-text-muted">
          Cache TTL · {bootstrap?.runtimeConfigTtlMs ?? 60000}ms · Änderungen werden innerhalb dieser Zeit dashboardweit aktiv.
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <div className="border-b border-bg-border bg-bg-surface px-5 py-3">
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="font-mono text-2xs uppercase tracking-terminal text-text-muted hover:text-text-primary"
          >
            ← Dashboard
          </a>
          <span className="text-text-faint">/</span>
          <span className="font-mono text-2xs uppercase tracking-terminal text-accent-cyan">
            Admin
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}

function BootstrapBlocked() {
  return (
    <div className="max-w-xl mx-auto p-6 rounded-md border border-accent-amber/40 bg-accent-amber/[0.06] mt-12">
      <div className="label-eyebrow text-accent-amber mb-1">Bootstrap erforderlich</div>
      <h1 className="text-[16px] font-semibold text-text-primary">
        ADMIN_TOKEN ist auf diesem Deployment nicht gesetzt
      </h1>
      <p className="mt-2 text-[12.5px] text-text-secondary leading-relaxed">
        Damit das In-Dashboard-Settings-Panel sicher freigeschaltet werden kann,
        muss bei Vercel ein einziger Bootstrap-Wert gesetzt werden:
      </p>
      <pre className="mt-3 rounded-sm border border-bg-border bg-bg-panel p-3 font-mono text-[11.5px] text-text-secondary overflow-auto">
{`# Vercel · Project Settings → Environment Variables
ADMIN_TOKEN=<openssl rand -hex 32>
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
`}</pre>
      <p className="mt-3 text-[12.5px] text-text-secondary">
        Diese drei Werte sind die einzigen die je in Vercel landen. Alle anderen
        Konfigurationen (Engine-URL, Engine-Bearer, Sonar-Modell, Adzuna-Keys,
        SaaS-Keys, …) werden ab dann komplett über diese Settings-Page gesetzt
        und in Supabase persistiert — ohne Vercel-UI, ohne Redeploy.
      </p>
    </div>
  );
}

function SourceBadge({ source }: { source: ConfigEntry['source'] }) {
  if (source === 'supabase')
    return <span className="text-accent-green">● supabase</span>;
  if (source === 'env')
    return <span className="text-accent-cyan">● env (bootstrap)</span>;
  return <span className="text-text-muted">○ unset</span>;
}
