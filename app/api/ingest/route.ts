import { rateLimit } from "../../../lib/rateLimit";

export const revalidate = 0;

type IngestPayload = {
  companyName: string;
  signalType: string;
  source: string;
  title: string;
  description: string;
  impact: number;
  confidence: number;
  observedAt: string;
  metadata?: Record<string, unknown>;
};

function normalize(payload: IngestPayload) {
  return {
    companyName: payload.companyName.trim(),
    signalType: payload.signalType.trim().toLowerCase(),
    source: payload.source.trim(),
    title: payload.title.trim(),
    description: payload.description.trim(),
    impact: Math.max(-100, Math.min(100, payload.impact)),
    confidence: Math.max(0, Math.min(1, payload.confidence)),
    observedAt: new Date(payload.observedAt).toISOString(),
    metadata: payload.metadata ?? {},
  };
}

function validate(input: unknown): { ok: true; payload: IngestPayload } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object") return { ok: false, errors: ["payload must be an object"] };
  const payload = input as Partial<IngestPayload>;
  const errors: string[] = [];
  const requiredText: Array<keyof IngestPayload> = ["companyName", "signalType", "source", "title", "description"];
  for (const key of requiredText) {
    if (typeof payload[key] !== "string" || !payload[key]?.trim()) errors.push(`${key} is required`);
  }
  if (typeof payload.impact !== "number" || Number.isNaN(payload.impact)) errors.push("impact must be a number");
  if (typeof payload.confidence !== "number" || Number.isNaN(payload.confidence)) errors.push("confidence must be a number");
  if (typeof payload.observedAt !== "string" || Number.isNaN(Date.parse(payload.observedAt))) errors.push("observedAt must be a valid ISO date string");
  if (payload.metadata !== undefined && (typeof payload.metadata !== "object" || Array.isArray(payload.metadata))) errors.push("metadata must be an object");

  if (errors.length) return { ok: false, errors };
  return { ok: true, payload: payload as IngestPayload };
}

export async function POST(req: Request) {
  const limited = rateLimit({ key: `ingest:${req.headers.get("x-forwarded-for") ?? "anon"}`, limit: 30 });
  if (limited) return limited;

  const body = await req.json();
  const result = validate(body);
  if (!result.ok) return Response.json({ status: "error", errors: result.errors }, { status: 400 });

  return Response.json({
    status: "accepted",
    preview: normalize(result.payload),
    receivedAt: new Date().toISOString(),
  });
}
