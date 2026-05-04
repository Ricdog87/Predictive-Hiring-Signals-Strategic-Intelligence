/**
 * Lightweight session shim — there is no auth backend yet, so the active
 * user is read from `NEXT_PUBLIC_USER_NAME` (build-time, public) with a
 * sensible default. When auth lands this is the single place to swap.
 */

export interface SessionUser {
  fullName: string;
  firstName: string;
  initials: string;
  role: string;
}

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "RD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getSessionUser(): SessionUser {
  const fullName = process.env.NEXT_PUBLIC_USER_NAME?.trim() || "Ricardo";
  const firstName = fullName.split(/\s+/)[0] || fullName;
  return {
    fullName,
    firstName,
    initials: buildInitials(fullName),
    role: process.env.NEXT_PUBLIC_USER_ROLE?.trim() || "Recruiting SG · Internal",
  };
}

export function timeOfDayGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  if (h < 22) return "Guten Abend";
  return "Gute Nacht";
}
