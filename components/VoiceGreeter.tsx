"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSessionUser, timeOfDayGreeting } from "@/lib/session";
import { quoteForDate } from "@/lib/salesQuotes";
import {
  alreadyGreetedToday,
  isVoiceEnabled,
  isVoiceSupported,
  markGreetedToday,
  setVoiceEnabled,
  speak,
  stopSpeaking,
} from "@/lib/voiceGreeter";

interface VoiceGreeterProps {
  /** Override für Tests — sonst Session-User. */
  firstName?: string;
}

type Status = "idle" | "speaking" | "muted" | "unsupported" | "prompt";

const FIRST_USE_PROMPT_KEY = "rsg.voice.firstUsePromptDismissed.v1";

function buildGreetingText(firstName: string, now: Date): string {
  const greeting = timeOfDayGreeting(now);
  const quote = quoteForDate(now);
  return `${greeting}, ${firstName}. ${quote.text}`;
}

/**
 * Voice-Begrüssung beim Dashboard-Öffnen. Verhalten:
 *
 *   - Erstbesuch: kleiner Opt-In-Prompt unten rechts ("Voice-Begrüssung
 *     aktivieren?" Ja/Nein). Browser-Autoplay-Policies verbieten Audio
 *     ohne User-Gesture; der Click ist die Gesture.
 *   - Nach Ja: Begrüssung läuft sofort, Präferenz wird gespeichert
 *     (localStorage). Bei späteren Sessions spricht der Greeter
 *     automatisch beim ersten Mount des Tages.
 *   - Nach Nein: kleine Lautsprecher-Toggle in der Ecke. Click =
 *     einmaliger Replay.
 *   - 1×/Tag-Drossel (rsg.voice.lastGreetedAt) — gleicher User der das
 *     Dashboard 10× am Tag öffnet wird nicht 10× begrüsst.
 */
export function VoiceGreeter({ firstName }: VoiceGreeterProps = {}) {
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [showPrompt, setShowPrompt] = useState(false);
  const didAutoGreet = useRef(false);

  const user = useMemo(() => getSessionUser(), []);
  const name = firstName ?? user.firstName;

  // Hydrate-Phase: prüfe Support, Preferences, Erstbesuch.
  useEffect(() => {
    setHydrated(true);

    if (!isVoiceSupported()) {
      setStatus("unsupported");
      return;
    }

    const enabled = isVoiceEnabled();
    const promptDismissed = (() => {
      try {
        return window.localStorage.getItem(FIRST_USE_PROMPT_KEY) === "1";
      } catch {
        return false;
      }
    })();

    if (enabled) {
      setStatus("idle");
      // 1×/Tag-Drossel: auto-greet nur wenn heute noch nicht begrüsst
      if (!alreadyGreetedToday() && !didAutoGreet.current) {
        didAutoGreet.current = true;
        void doGreet();
      }
    } else if (!promptDismissed) {
      setStatus("prompt");
      setShowPrompt(true);
    } else {
      setStatus("muted");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup beim Unmount: laufende Utterance abbrechen, sonst spricht
  // sie nach einem Tab-Wechsel weiter.
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const doGreet = useCallback(async () => {
    setStatus("speaking");
    const text = buildGreetingText(name, new Date());
    const result = await speak(text);
    if (result === "ok") {
      markGreetedToday();
    }
    setStatus(isVoiceEnabled() ? "idle" : "muted");
  }, [name]);

  const handleEnable = useCallback(async () => {
    setVoiceEnabled(true);
    try {
      window.localStorage.setItem(FIRST_USE_PROMPT_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowPrompt(false);
    didAutoGreet.current = true;
    await doGreet();
  }, [doGreet]);

  const handleDismissPrompt = useCallback(() => {
    setVoiceEnabled(false);
    try {
      window.localStorage.setItem(FIRST_USE_PROMPT_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowPrompt(false);
    setStatus("muted");
  }, []);

  const handleToggle = useCallback(async () => {
    if (status === "speaking") {
      stopSpeaking();
      setStatus(isVoiceEnabled() ? "idle" : "muted");
      return;
    }
    const wasEnabled = isVoiceEnabled();
    if (wasEnabled) {
      // Aktuell an → ausschalten
      setVoiceEnabled(false);
      stopSpeaking();
      setStatus("muted");
    } else {
      // Aktuell aus → an und einmal sprechen
      setVoiceEnabled(true);
      await doGreet();
    }
  }, [status, doGreet]);

  const handleReplay = useCallback(() => {
    void doGreet();
  }, [doGreet]);

  // Render nichts bis hydriert (vermeidet Hydration-Mismatch).
  if (!hydrated) return null;
  if (status === "unsupported") return null;

  return (
    <>
      {showPrompt && (
        <FirstUsePrompt
          onEnable={handleEnable}
          onDismiss={handleDismissPrompt}
        />
      )}

      <ToggleChip
        status={status}
        enabled={isVoiceEnabled()}
        onToggle={handleToggle}
        onReplay={handleReplay}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// First-use opt-in pill (bottom-right above StatusBar)
// ---------------------------------------------------------------------------

function FirstUsePrompt({
  onEnable,
  onDismiss,
}: {
  onEnable: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Voice-Begrüssung aktivieren"
      className="fixed bottom-12 right-4 z-40 max-w-[320px] rounded-md border border-accent-cyan/40 bg-bg-panel/95 p-3 shadow-glow backdrop-blur animate-slide-down"
    >
      <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-terminal text-accent-cyan">
        <span aria-hidden>🔊</span>
        <span>Voice-Begrüssung</span>
      </div>
      <p className="mt-1 text-[12.5px] text-text-secondary">
        Soll dich das Dashboard ab heute jeden Tag einmal mit Stimme begrüssen
        — inklusive deinem Vertriebs-Push?
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onEnable}
          className="rounded-sm border border-accent-cyan/60 bg-accent-cyan/15 px-3 py-1 font-mono text-2xs uppercase tracking-terminal text-accent-cyan hover:bg-accent-cyan/25"
        >
          Ja, los geht's
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-sm border border-bg-border bg-bg-surface px-3 py-1 font-mono text-2xs uppercase tracking-terminal text-text-muted hover:border-bg-line hover:text-text-secondary"
        >
          Nein, danke
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle chip (always-visible control, bottom-right)
// ---------------------------------------------------------------------------

function ToggleChip({
  status,
  enabled,
  onToggle,
  onReplay,
}: {
  status: Status;
  enabled: boolean;
  onToggle: () => void;
  onReplay: () => void;
}) {
  const speaking = status === "speaking";
  const baseLabel = speaking
    ? "spricht …"
    : enabled
    ? "Voice an"
    : "Voice aus";
  const icon = speaking ? "◐" : enabled ? "🔊" : "🔇";

  return (
    <div className="fixed bottom-12 right-4 z-30 flex items-center gap-1.5">
      {enabled && !speaking && (
        <button
          type="button"
          onClick={onReplay}
          title="Begrüssung erneut abspielen"
          className="rounded-sm border border-bg-border bg-bg-panel/90 px-2 py-1 font-mono text-2xs uppercase tracking-terminal text-text-muted hover:border-accent-cyan/40 hover:text-accent-cyan"
        >
          ↻
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        title={
          speaking
            ? "Sprechen abbrechen"
            : enabled
            ? "Voice-Begrüssung deaktivieren"
            : "Voice-Begrüssung aktivieren + jetzt einmal sprechen"
        }
        className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-2xs uppercase tracking-terminal transition-colors ${
          speaking
            ? "border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan animate-pulse-soft"
            : enabled
            ? "border-accent-green/40 bg-accent-green/10 text-accent-green hover:bg-accent-green/20"
            : "border-bg-border bg-bg-panel/90 text-text-muted hover:border-accent-cyan/40 hover:text-accent-cyan"
        }`}
      >
        <span aria-hidden>{icon}</span>
        <span>{baseLabel}</span>
      </button>
    </div>
  );
}
