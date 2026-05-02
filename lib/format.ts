import type { Strength, ConfidenceTier, ForecastBand } from "./marketView";

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatRelativeDays(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "1 day ago";
  if (diff < 30) return `${diff} days ago`;
  const months = Math.floor(diff / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export const strengthStyles: Record<
  Strength,
  { label: string; dot: string; ring: string; text: string }
> = {
  weak: {
    label: "Weak",
    dot: "bg-text-muted",
    ring: "ring-text-muted/30",
    text: "text-text-secondary",
  },
  moderate: {
    label: "Moderate",
    dot: "bg-accent-amber",
    ring: "ring-accent-amber/40",
    text: "text-accent-amber",
  },
  strong: {
    label: "Strong",
    dot: "bg-accent-cyan",
    ring: "ring-accent-cyan/40",
    text: "text-accent-cyan",
  },
  critical: {
    label: "Critical",
    dot: "bg-accent-violet",
    ring: "ring-accent-violet/50",
    text: "text-accent-violet",
  },
};

export const confidenceStyles: Record<
  ConfidenceTier,
  { label: string; dot: string; ring: string; text: string }
> = {
  low: {
    label: "Low",
    dot: "bg-accent-amber",
    ring: "ring-accent-amber/40",
    text: "text-accent-amber",
  },
  medium: {
    label: "Medium",
    dot: "bg-accent-ink",
    ring: "ring-accent-ink/40",
    text: "text-accent-ink",
  },
  high: {
    label: "High",
    dot: "bg-accent-green",
    ring: "ring-accent-green/40",
    text: "text-accent-green",
  },
};

export const forecastStyles: Record<
  ForecastBand,
  { label: string; dot: string; ring: string; text: string }
> = {
  imminent: {
    label: "Imminent",
    dot: "bg-accent-violet",
    ring: "ring-accent-violet/40",
    text: "text-accent-violet",
  },
  "near-term": {
    label: "Near-term",
    dot: "bg-accent-cyan",
    ring: "ring-accent-cyan/40",
    text: "text-accent-cyan",
  },
  "mid-term": {
    label: "Mid-term",
    dot: "bg-accent-amber",
    ring: "ring-accent-amber/40",
    text: "text-accent-amber",
  },
  watch: {
    label: "Watch",
    dot: "bg-text-muted",
    ring: "ring-bg-rule",
    text: "text-text-secondary",
  },
};
