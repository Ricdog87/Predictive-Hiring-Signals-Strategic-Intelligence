import type { SignalCategory, SignalStrength } from "./types";

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

export const categoryLabels: Record<SignalCategory, string> = {
  hiring_velocity: "Hiring velocity",
  leadership_change: "Leadership change",
  funding_round: "Funding round",
  tech_stack_shift: "Tech stack shift",
  office_expansion: "Office expansion",
  layoff_pivot: "Layoff / pivot",
};

export const strengthStyles: Record<
  SignalStrength,
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
