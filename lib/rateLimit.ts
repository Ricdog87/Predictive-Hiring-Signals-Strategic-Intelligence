import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  key: string;
  limit?: number;
  windowMs?: number;
}

export function rateLimit({ key, limit = 60, windowMs = 60_000 }: RateLimitOptions): NextResponse | null {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= limit) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many requests. Please retry shortly.",
        retryAfterMs: bucket.resetAt - now,
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((bucket.resetAt - now) / 1000).toString(),
        },
      }
    );
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return null;
}
