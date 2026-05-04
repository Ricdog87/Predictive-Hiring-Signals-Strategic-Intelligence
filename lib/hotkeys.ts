/**
 * Tiny hotkey hub · v1.
 *
 * Bloomberg-style two-letter chords (`g s`, `g r`, `g c`, `g co`) plus
 * the obligatory `⌘K` / `Ctrl K` for the command palette and `?` for
 * the help overlay. Listens once at the document level; consumers
 * subscribe via `registerHotkey` and unsubscribe on unmount. Ignores
 * all events while the user is typing in an input/textarea/select.
 */

"use client";

import { useEffect } from "react";

type Handler = () => void;

interface Binding {
  /** Sequence of single-character keys (no modifiers). e.g. ["g", "s"]. */
  chord: string[];
  /** Modifier key — only used for the palette open. */
  mod?: "meta" | "ctrl";
  /** Single-char trigger when chord is undefined. */
  single?: string;
  handler: Handler;
}

const bindings = new Set<Binding>();
let pending: { keys: string[]; expires: number } = { keys: [], expires: 0 };
let attached = false;

const CHORD_WINDOW_MS = 900;

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

function ensureListener() {
  if (attached || typeof document === "undefined") return;
  attached = true;
  document.addEventListener("keydown", (e) => {
    // ⌘K / Ctrl K
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      for (const b of bindings) {
        if ((b.mod === "meta" || b.mod === "ctrl") && b.single === "k") {
          e.preventDefault();
          b.handler();
          return;
        }
      }
      return;
    }
    if (isEditableTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    // Single-key triggers (e.g. "?")
    for (const b of bindings) {
      if (!b.chord && b.single && b.single === key && !b.mod) {
        e.preventDefault();
        b.handler();
        return;
      }
    }

    // Chord builder
    if (Date.now() > pending.expires) pending.keys = [];
    pending.keys.push(key);
    pending.expires = Date.now() + CHORD_WINDOW_MS;

    for (const b of bindings) {
      if (!b.chord) continue;
      if (b.chord.length > pending.keys.length) continue;
      const tail = pending.keys.slice(-b.chord.length);
      if (tail.every((k, i) => k === b.chord[i])) {
        e.preventDefault();
        pending.keys = [];
        b.handler();
        return;
      }
    }
  });
}

export function registerHotkey(b: Binding): () => void {
  ensureListener();
  bindings.add(b);
  return () => {
    bindings.delete(b);
  };
}

/**
 * Convenience: chord like "g s" (space-separated).
 */
export function useChord(chord: string, handler: Handler): void {
  useEffect(() => {
    return registerHotkey({ chord: chord.split(/\s+/), handler });
  }, [chord, handler]);
}

export function useSingle(key: string, handler: Handler): void {
  useEffect(() => {
    return registerHotkey({ chord: [], single: key, handler });
  }, [key, handler]);
}

export function usePaletteHotkey(handler: Handler): void {
  useEffect(() => {
    const a = registerHotkey({ mod: "meta", single: "k", handler, chord: [] });
    const b = registerHotkey({ mod: "ctrl", single: "k", handler, chord: [] });
    return () => {
      a();
      b();
    };
  }, [handler]);
}
