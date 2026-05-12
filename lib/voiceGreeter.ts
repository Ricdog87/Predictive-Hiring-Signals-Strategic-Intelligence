/**
 * lib/voiceGreeter.ts
 *
 * Dünner Wrapper um die Web Speech API (`window.speechSynthesis`).
 * Kein externer Provider, kein API-Key, keine Latenz — die TTS läuft
 * komplett im Browser.
 *
 * Verhalten
 *   - Browser-Autoplay-Policy: SpeechSynthesis darf erst nach einer
 *     User-Gesture spielen (Chrome/Safari). Wenn der erste Aufruf
 *     versehentlich vor einer Gesture passiert, schluckt der Browser
 *     ihn lautlos — kein Crash, keine UI-Wirkung. Der Caller darf
 *     deshalb optimistisch speak() aufrufen.
 *   - Stimmen werden async geladen: bei manchen Browsern ist
 *     getVoices() beim ersten Tick leer und füllt sich später via
 *     voiceschanged-Event. Wir warten bis zu 1.5s auf das Event.
 *
 * Whitelabel: bewusst keine Vendor-Strings. Die Web Speech API ist eine
 * Browser-Standard-Schnittstelle, nicht "OpenAI TTS" oder ähnliches.
 */

const VOICE_LANG = 'de-DE';
const VOICE_RATE = 0.98;
const VOICE_PITCH = 1.0;
const VOICE_VOLUME = 1.0;

export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Wartet bis das Browser-Voice-Inventory geladen ist (max 1.5s) und
 * gibt die beste verfügbare Stimme für `de-DE` zurück. Priorität:
 *   1. Lokale Stimmen (`localService: true`) — schneller, keine
 *      Netzwerk-Roundtrips
 *   2. Stimmen mit explizitem `lang === 'de-DE'`
 *   3. Erste Stimme mit Prefix `de-`
 */
async function getPreferredVoice(): Promise<SpeechSynthesisVoice | null> {
  if (!isVoiceSupported()) return null;
  const synth = window.speechSynthesis;

  const pickFrom = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (!voices.length) return null;
    const localDe = voices.find(
      (v) => v.localService && v.lang.toLowerCase() === VOICE_LANG.toLowerCase(),
    );
    if (localDe) return localDe;
    const anyDe = voices.find(
      (v) => v.lang.toLowerCase() === VOICE_LANG.toLowerCase(),
    );
    if (anyDe) return anyDe;
    const dePrefix = voices.find((v) => v.lang.toLowerCase().startsWith('de'));
    return dePrefix ?? null;
  };

  const immediate = pickFrom(synth.getVoices());
  if (immediate) return immediate;

  return new Promise<SpeechSynthesisVoice | null>((resolve) => {
    let settled = false;
    const finish = (v: SpeechSynthesisVoice | null) => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', onChange);
      clearTimeout(timer);
      resolve(v);
    };
    const onChange = () => finish(pickFrom(synth.getVoices()));
    synth.addEventListener('voiceschanged', onChange);
    const timer = setTimeout(() => finish(pickFrom(synth.getVoices())), 1_500);
  });
}

export interface SpeakOptions {
  /** Sprach-Code, default `de-DE`. */
  lang?: string;
  /** Rate 0.1 – 10, default 0.98 (leicht ruhiger als Standard). */
  rate?: number;
  /** Pitch 0 – 2, default 1. */
  pitch?: number;
  /** Volume 0 – 1, default 1. */
  volume?: number;
}

export type SpeakResult = 'ok' | 'unsupported' | 'cancelled' | 'error';

/**
 * Spricht `text`. Bricht eine laufende Äusserung ab, damit nicht zwei
 * Greetings übereinander spielen. Promise resolved sobald die Utterance
 * fertig ist oder abbricht.
 */
export async function speak(
  text: string,
  opts: SpeakOptions = {},
): Promise<SpeakResult> {
  if (!isVoiceSupported()) return 'unsupported';
  if (!text.trim()) return 'cancelled';

  const synth = window.speechSynthesis;
  synth.cancel();

  const voice = await getPreferredVoice();
  return new Promise<SpeakResult>((resolve) => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = opts.lang ?? VOICE_LANG;
    utt.rate = opts.rate ?? VOICE_RATE;
    utt.pitch = opts.pitch ?? VOICE_PITCH;
    utt.volume = opts.volume ?? VOICE_VOLUME;
    if (voice) utt.voice = voice;
    utt.onend = () => resolve('ok');
    utt.onerror = () => resolve('error');
    try {
      synth.speak(utt);
    } catch {
      resolve('error');
    }
  });
}

export function stopSpeaking(): void {
  if (!isVoiceSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* nothing useful to do here */
  }
}

// ---------------------------------------------------------------------------
// Preferences (localStorage)
// ---------------------------------------------------------------------------

const ENABLED_KEY = 'rsg.voice.enabled.v1';
const LAST_GREET_KEY = 'rsg.voice.lastGreetedAt.v1';

export function isVoiceEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setVoiceEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* private mode → silently ignore */
  }
}

/** ISO-Datum (YYYY-MM-DD) der letzten Begrüssung. */
export function readLastGreetedDate(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LAST_GREET_KEY);
  } catch {
    return null;
  }
}

export function markGreetedToday(now: Date = new Date()): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_GREET_KEY, now.toISOString().slice(0, 10));
  } catch {
    /* ignore */
  }
}

/** Hat der User heute schon eine Begrüssung gehört? */
export function alreadyGreetedToday(now: Date = new Date()): boolean {
  const last = readLastGreetedDate();
  if (!last) return false;
  return last === now.toISOString().slice(0, 10);
}
