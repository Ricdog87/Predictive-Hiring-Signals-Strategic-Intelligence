"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll-spy: returns the id of whichever element from `ids` is most
 * prominent in the viewport. Uses IntersectionObserver and falls back
 * to a manual scroll handler when the observer is unavailable.
 */
export function useActiveSection(ids: string[], rootMargin = "-40% 0px -55% 0px"): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const ratios = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.current.set(e.target.id, e.intersectionRatio);
        }
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const id of ids) {
          const r = ratios.current.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestId = id;
          }
        }
        if (bestId) setActive(bestId);
      },
      { rootMargin, threshold: [0, 0.15, 0.35, 0.55, 0.75] },
    );

    const targets: Element[] = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        targets.push(el);
      }
    }
    return () => observer.disconnect();
  }, [ids.join("|"), rootMargin]);

  return active;
}

export function scrollToSection(id: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

const SEARCH_FOCUS_EVENT = "phs:search-focus";

/**
 * Listen for a global "focus the search input" event (raised by the "/"
 * or ⌘K shortcut). The provided callback runs on each event.
 */
export function useSearchFocusListener(handler: () => void): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const listener = () => handler();
    window.addEventListener(SEARCH_FOCUS_EVENT, listener);
    return () => window.removeEventListener(SEARCH_FOCUS_EVENT, listener);
  }, [handler]);
}

export function requestSearchFocus(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SEARCH_FOCUS_EVENT));
}

/**
 * Global "/" or ⌘K shortcut → request search focus. Bypasses when the
 * user is already typing into an input.
 */
export function useSearchShortcut(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || target?.isContentEditable;
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && !isTyping;
      if (isSlash || isCmdK) {
        e.preventDefault();
        requestSearchFocus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
