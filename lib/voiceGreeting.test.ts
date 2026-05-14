import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheKeyFor,
  generateGreetingAudio,
  isVoiceGreetingConfigured,
  pickGreeting,
  sanitiseName,
  timeBucket,
} from "./voiceGreeting";

describe("sanitiseName", () => {
  it("trims whitespace", () => {
    expect(sanitiseName("  Ricardo  ")).toBe("Ricardo");
  });
  it("falls back to 'there' for empty", () => {
    expect(sanitiseName("")).toBe("there");
    expect(sanitiseName("   ")).toBe("there");
  });
  it("strips control / markup chars", () => {
    expect(sanitiseName("<script>Ricardo</script>")).toBe("scriptRicardoscript");
  });
  it("caps length at 48", () => {
    const long = "X".repeat(100);
    expect(sanitiseName(long).length).toBeLessThanOrEqual(48);
  });
});

describe("timeBucket", () => {
  it("morning 09:00 → morning", () => {
    expect(timeBucket(new Date("2026-05-13T09:00:00"))).toBe("morning");
  });
  it("midday 12:00 → midday", () => {
    expect(timeBucket(new Date("2026-05-13T12:00:00"))).toBe("midday");
  });
  it("evening 18:00 → evening", () => {
    expect(timeBucket(new Date("2026-05-13T18:00:00"))).toBe("evening");
  });
  it("night 23:00 → night", () => {
    expect(timeBucket(new Date("2026-05-13T23:00:00"))).toBe("night");
  });
});

describe("pickGreeting", () => {
  it("is deterministic per (name, bucket)", () => {
    expect(pickGreeting("Ricardo", "morning")).toBe(
      pickGreeting("Ricardo", "morning"),
    );
  });
  it("contains the name", () => {
    const t = pickGreeting("Ricardo", "evening");
    expect(t.toLowerCase()).toContain("ricardo");
  });
  it("differs per name", () => {
    const a = pickGreeting("Ricardo", "morning");
    const b = pickGreeting("Sven", "morning");
    expect(a).not.toBe(b);
  });
  it("sanitises name in output", () => {
    const t = pickGreeting("<bad>Ricardo", "midday");
    expect(t).not.toContain("<");
    expect(t).not.toContain(">");
  });
});

describe("cacheKeyFor", () => {
  it("is stable per (name, bucket, voice, model)", () => {
    const now = new Date("2026-05-13T09:00:00");
    expect(cacheKeyFor("Ricardo", { now })).toBe(cacheKeyFor("RICARDO", { now }));
  });
  it("differs across buckets", () => {
    const morning = cacheKeyFor("Ricardo", { now: new Date("2026-05-13T09:00:00") });
    const evening = cacheKeyFor("Ricardo", { now: new Date("2026-05-13T18:00:00") });
    expect(morning).not.toBe(evening);
  });
});

describe("isVoiceGreetingConfigured", () => {
  const prev = process.env.ELEVENLABS_API_KEY;
  afterEach(() => {
    if (prev == null) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = prev;
  });

  it("returns false when API key missing", () => {
    delete process.env.ELEVENLABS_API_KEY;
    expect(isVoiceGreetingConfigured()).toBe(false);
  });
  it("returns true when API key set", () => {
    process.env.ELEVENLABS_API_KEY = "sk_test_xyz";
    expect(isVoiceGreetingConfigured()).toBe(true);
  });
});

describe("generateGreetingAudio", () => {
  const prevKey = process.env.ELEVENLABS_API_KEY;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.ELEVENLABS_API_KEY = "sk_test_xyz";
  });
  afterEach(() => {
    if (prevKey == null) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = prevKey;
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("returns ok:false unconfigured when API key missing", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const r = await generateGreetingAudio("Ricardo");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unconfigured");
  });

  it("returns ok:true with mp3 buffer on success", async () => {
    const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00]).buffer;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(mp3, {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      }),
    ) as unknown as typeof fetch;
    const r = await generateGreetingAudio("Ricardo");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.mp3.length).toBe(4);
      expect(r.text.toLowerCase()).toContain("ricardo");
    }
  });

  it("returns ok:false upstream on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    const r = await generateGreetingAudio("Ricardo");
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === "upstream") {
      expect(r.status).toBe(429);
    } else {
      throw new Error("expected upstream failure");
    }
  });

  it("returns ok:false timeout on abort", async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit)?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }
      });
    }) as unknown as typeof fetch;
    process.env.ELEVENLABS_TIMEOUT_MS = "10";
    const r = await generateGreetingAudio("Ricardo");
    delete process.env.ELEVENLABS_TIMEOUT_MS;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("timeout");
  });
});
