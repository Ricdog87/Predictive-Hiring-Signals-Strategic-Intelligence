"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSessionUser } from "@/lib/session";
import { useChord } from "@/lib/hotkeys";

interface JarvisGreeterProps {
  /** Override for tests/Storybook — otherwise from getSessionUser. */
  firstName?: string;
}

interface Prefs {
  enabled: boolean;
  lastPlayedAt: number;
  name: string;
}

type Status =
  | "idle" // armed, waiting for first user gesture
  | "armed" // pre-fetched, will play on next gesture
  | "playing"
  | "muted"
  | "unsupported"
  | "fetching"
  | "error";

const STORAGE_KEY = "rsg.voice.greeting.v1";
const SESSION_PLAYED_KEY = "rsg.voice.played";

const DEFAULT_PREFS: Prefs = {
  enabled: true,
  lastPlayedAt: 0,
  name: "",
};

function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
      lastPlayedAt:
        typeof parsed.lastPlayedAt === "number" ? parsed.lastPlayedAt : 0,
      name: typeof parsed.name === "string" ? parsed.name : "",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(p: Prefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode → silently drop */
  }
}

function readSessionPlayed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_PLAYED_KEY) === "1";
  } catch {
    return false;
  }
}

function markSessionPlayed(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_PLAYED_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearSessionPlayed(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_PLAYED_KEY);
  } catch {
    /* ignore */
  }
}

export function JarvisGreeter({ firstName }: JarvisGreeterProps = {}) {
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const user = useMemo(() => getSessionUser(), []);
  const name = firstName ?? user.firstName;

  // ---------- Hydrate ----------
  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;
    if (typeof window.Audio === "undefined") {
      setStatus("unsupported");
      return;
    }
    const stored = readPrefs();
    setPrefs(stored);
    setStatus(stored.enabled ? "idle" : "muted");
  }, []);

  // ---------- Persistence helpers ----------
  const persist = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch, name };
      writePrefs(next);
      return next;
    });
  }, [name]);

  // ---------- Fetch + play ----------
  const fetchAndPlay = useCallback(
    async (force = false) => {
      if (!name) return;
      if (!force && readSessionPlayed()) return;

      setStatus("fetching");
      try {
        const res = await fetch(
          `/api/voice/greeting?name=${encodeURIComponent(name)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          // 503 unconfigured: turn off silently and stop annoying the user
          if (res.status === 503) {
            setStatus("muted");
            return;
          }
          setStatus("error");
          return;
        }
        const blob = await res.blob();
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setStatus(readPrefs().enabled ? "idle" : "muted");
          URL.revokeObjectURL(url);
          if (blobUrlRef.current === url) blobUrlRef.current = null;
        };
        audio.onerror = () => {
          setStatus("error");
        };

        setStatus("playing");
        await audio.play();
        markSessionPlayed();
        persist({ lastPlayedAt: Date.now() });
      } catch {
        setStatus("error");
      }
    },
    [name, persist],
  );

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setStatus(readPrefs().enabled ? "idle" : "muted");
  }, []);

  // ---------- First-gesture trigger ----------
  useEffect(() => {
    if (!hydrated) return;
    if (status === "unsupported") return;
    if (!prefs.enabled) return;
    if (readSessionPlayed()) return;

    const handler = () => {
      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("keydown", handler, true);
      void fetchAndPlay(false);
    };

    window.addEventListener("pointerdown", handler, true);
    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("pointerdown", handler, true);
      window.removeEventListener("keydown", handler, true);
    };
  }, [hydrated, prefs.enabled, status, fetchAndPlay]);

  // ---------- Hotkeys ----------
  useChord("g v", () => {
    setPrefs((prev) => {
      const nextEnabled = !prev.enabled;
      const next = { ...prev, enabled: nextEnabled, name };
      writePrefs(next);
      if (!nextEnabled) {
        stop();
        setStatus("muted");
      } else {
        setStatus("idle");
        clearSessionPlayed();
      }
      return next;
    });
  });
  useChord("g w", () => {
    if (!prefs.enabled) {
      persist({ enabled: true });
      setStatus("idle");
    }
    clearSessionPlayed();
    void fetchAndPlay(true);
  });

  // ---------- Cleanup ----------
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        try {
          a.pause();
        } catch {
          /* ignore */
        }
      }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  // ---------- Render ----------
  if (!hydrated) return null;
  if (status === "unsupported") return null;

  const enabled = prefs.enabled;
  const playing = status === "playing";
  const fetching = status === "fetching";

  const label = playing
    ? "Greeting · spielt"
    : fetching
    ? "Greeting · lädt"
    : enabled
    ? "Voice on"
    : "Voice off";

  const icon = playing ? "◐" : enabled ? "🔊" : "🔇";

  const handleToggle = () => {
    if (playing) {
      stop();
      return;
    }
    const wasEnabled = enabled;
    persist({ enabled: !wasEnabled });
    if (wasEnabled) {
      stop();
      setStatus("muted");
    } else {
      setStatus("idle");
      clearSessionPlayed();
      void fetchAndPlay(true);
    }
  };

  const handleReplay = () => {
    if (!enabled) return;
    clearSessionPlayed();
    void fetchAndPlay(true);
  };

  return (
    <div className="fixed bottom-12 right-4 z-30 flex items-center gap-1.5">
      {enabled && !playing && !fetching && (
        <button
          type="button"
          onClick={handleReplay}
          title="Greeting erneut abspielen · g w"
          className="rounded-sm border border-bg-border bg-bg-panel/90 px-2 py-1 font-mono text-2xs uppercase tracking-terminal text-text-muted hover:border-accent-cyan/40 hover:text-accent-cyan"
        >
          ↻
        </button>
      )}
      <button
        type="button"
        onClick={handleToggle}
        title={
          playing
            ? "Greeting abbrechen"
            : enabled
            ? "Voice Greeting · ein · g v zum Umschalten"
            : "Voice Greeting · aus · g v zum Umschalten"
        }
        className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-2xs uppercase tracking-terminal transition-colors ${
          playing
            ? "border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan animate-pulse-soft"
            : fetching
            ? "border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
            : enabled
            ? "border-accent-green/40 bg-accent-green/10 text-accent-green hover:bg-accent-green/20"
            : "border-bg-border bg-bg-panel/90 text-text-muted hover:border-accent-cyan/40 hover:text-accent-cyan"
        }`}
      >
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </button>
    </div>
  );
}
