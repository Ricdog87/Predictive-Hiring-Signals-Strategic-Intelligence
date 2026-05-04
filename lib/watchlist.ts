/**
 * Watchlist · v1.
 *
 * Recruiter-side pin/unpin for companies. Persisted in `localStorage`
 * (no backend required). Exposes a hook so any component can react
 * live to changes (cross-tab via `storage` event, intra-tab via a
 * tiny pubsub).
 */

"use client";

import { useEffect, useState, useCallback } from "react";

const KEY = "rsg.hiring-radar.watchlist.v1";

type Listener = (next: string[]) => void;
const listeners = new Set<Listener>();

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function write(next: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / privacy mode — fail silent */
  }
  listeners.forEach((l) => l(next));
}

export function getWatchlist(): string[] {
  return read();
}

export function isPinned(companyId: string): boolean {
  return read().includes(companyId);
}

export function togglePin(companyId: string): string[] {
  const cur = read();
  const next = cur.includes(companyId)
    ? cur.filter((id) => id !== companyId)
    : [...cur, companyId];
  write(next);
  return next;
}

export function clearWatchlist(): void {
  write([]);
}

export function useWatchlist(): {
  pinned: string[];
  toggle: (id: string) => void;
  isPinned: (id: string) => boolean;
  clear: () => void;
} {
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    setPinned(read());
    const onLocal: Listener = (next) => setPinned(next);
    listeners.add(onLocal);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setPinned(read());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    togglePin(id);
  }, []);
  const has = useCallback(
    (id: string) => pinned.includes(id),
    [pinned]
  );
  const clear = useCallback(() => clearWatchlist(), []);

  return { pinned, toggle, isPinned: has, clear };
}
