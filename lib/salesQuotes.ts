/**
 * lib/salesQuotes.ts
 *
 * Tagesrotierender Vertriebs-Motivationsspruch für den Welcome-Hero.
 * Deterministisch nach Tag-des-Jahres ausgewählt: jeder Kalendertag
 * bekommt genau einen Spruch, am nächsten Tag rotiert es automatisch.
 *
 * Bewusst KEIN Random pro Render — sonst wechselt der Spruch bei jedem
 * State-Tick. Stabilität pro Tag macht ihn merkbar; Rotation macht ihn
 * frisch.
 *
 * Pool ist gross genug (40+ Einträge), dass eine Wiederholung erst nach
 * über einem Monat passiert. Tonalität: deutsch, knapp, Mittelstands-
 * Vertrieb, nüchtern motivierend — kein US-Bro-Hype.
 */

export interface SalesQuote {
  text: string;
  /** Optionaler Kontext / "Coach"-Label unter dem Zitat. */
  context?: string;
}

const QUOTES: SalesQuote[] = [
  { text: "Pipeline ist Sauerstoff. Atme tiefer.", context: "Daily Push" },
  {
    text: "Jeder Anruf, der nicht passiert, ist ein Auftrag, der nicht kommt.",
    context: "Outbound",
  },
  {
    text: "Heute fünf Calls mehr als gestern. Morgen sechs.",
    context: "Routine",
  },
  { text: "Wer nicht fragt, verkauft nicht.", context: "Discovery" },
  {
    text: "Der nächste Kontakt entscheidet den Monat.",
    context: "Fokus",
  },
  {
    text: "Niemand zahlt für Höflichkeit. Sie zahlen für Klarheit.",
    context: "Closing",
  },
  {
    text: "Ein 'Nein' heute ist ein 'Ja' nächste Woche — mit besseren Informationen.",
    context: "Pipeline",
  },
  {
    text: "Wer das Telefon liebt, gewinnt den Vertrieb.",
    context: "Outbound",
  },
  {
    text: "Der Markt wartet nicht auf die perfekt formulierte Mail.",
    context: "Speed",
  },
  {
    text: "Closing ist Handwerk. Übung schlägt Talent.",
    context: "Discipline",
  },
  {
    text: "Wer Signale liest, ist drei Wochen früher dran.",
    context: "Timing",
  },
  {
    text: "Heute ist der beste Tag für den Anruf, den du seit Wochen schiebst.",
    context: "Now",
  },
  {
    text: "Verkaufen ist Helfen — aber zuerst musst du in den Raum kommen.",
    context: "Outreach",
  },
  {
    text: "Disziplin schlägt Inspiration. Immer.",
    context: "Routine",
  },
  {
    text: "Erst den Termin holen, dann die Folien polieren.",
    context: "Priorities",
  },
  {
    text: "Wer den ersten Satz im Cold Call beherrscht, beherrscht den Tag.",
    context: "Cold Call",
  },
  {
    text: "Vertrieb ist kein Sprint. Es sind tausend kleine Sprints in Serie.",
    context: "Stamina",
  },
  {
    text: "Bessere Targets schlagen mehr Targets.",
    context: "ICP",
  },
  {
    text: "Ein guter Recruiter weiss, wer nächste Woche einstellt — nicht, wer letzten Monat eingestellt hat.",
    context: "Predictive",
  },
  {
    text: "Mut zur Stille im Gespräch. Wer zuerst spricht, verliert oft.",
    context: "Negotiation",
  },
  {
    text: "Du brauchst keine Motivation. Du brauchst einen Plan und 90 Minuten Fokus.",
    context: "Deep Work",
  },
  {
    text: "Wer drei No's nicht aushält, sollte den Job nicht machen.",
    context: "Resilience",
  },
  {
    text: "Verkaufst du — oder wartest du, dass jemand kauft?",
    context: "Ownership",
  },
  {
    text: "Jeder Tag ohne Outreach ist ein Geschenk an die Konkurrenz.",
    context: "Speed",
  },
  {
    text: "Der wichtigste Deal ist der, den du heute startest.",
    context: "Now",
  },
  {
    text: "Cold ist nur, was du nicht recherchiert hast.",
    context: "Prep",
  },
  {
    text: "Recruiter, die warten, verlieren. Recruiter, die fragen, gewinnen.",
    context: "Outbound",
  },
  {
    text: "Eine gute Sales-Mail ist 80% Recherche und 20% Schreiben.",
    context: "Prep",
  },
  {
    text: "Top-Performer haben kein Geheimnis. Sie haben Routine.",
    context: "Routine",
  },
  {
    text: "Vergiss den perfekten Pitch. Stell die Frage, die niemand sonst stellt.",
    context: "Discovery",
  },
  {
    text: "Aktivität schlägt Strategie an einem mittelmässigen Tag.",
    context: "Volume",
  },
  {
    text: "Der schwierigste Anruf ist der, den du dir selbst zumutest. Mach ihn zuerst.",
    context: "Mornings",
  },
  {
    text: "Ein voller Kalender ist kein Ziel. Geschlossene Termine sind das Ziel.",
    context: "Outcomes",
  },
  {
    text: "Empathie öffnet Türen. Klarheit schliesst Deals.",
    context: "Closing",
  },
  {
    text: "Wer den Schmerz des Kunden präzise beschreibt, hat den Auftrag halb verdient.",
    context: "Discovery",
  },
  {
    text: "Follow-up ist kein Spam. Follow-up ohne Mehrwert ist Spam.",
    context: "Follow-up",
  },
  {
    text: "Drei Stunden konzentrierter Vertrieb schlagen acht Stunden Multitasking.",
    context: "Focus",
  },
  {
    text: "Wer den eigenen Markt kennt, braucht keine Skripte.",
    context: "Expertise",
  },
  {
    text: "Der Unterschied zwischen gut und exzellent? Die Vorbereitung auf den Folgetermin.",
    context: "Prep",
  },
  {
    text: "Verbindlichkeit gewinnt Aufträge. Versprechen verlieren sie.",
    context: "Trust",
  },
  {
    text: "Recruiting ist Timing. Timing ist Recherche. Recherche ist dein Vorsprung.",
    context: "Predictive",
  },
  {
    text: "Wer in der ersten Stunde des Tages keinen Kontakt sucht, verschenkt den Tag.",
    context: "Mornings",
  },
];

/**
 * Day-of-year (1..366), locale-stable. Mit fixem TZ, damit zwei
 * Tabs in unterschiedlichen Bedingungen denselben Spruch liefern.
 */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

/**
 * Wählt deterministisch den Spruch für ein gegebenes Datum.
 * Selbe Datum → selber Spruch. Tag rollt → neuer Spruch.
 */
export function quoteForDate(date: Date): SalesQuote {
  const idx = dayOfYear(date) % QUOTES.length;
  return QUOTES[idx];
}

/** Anzahl der Sprüche im Pool — nur für Tests / Sanity. */
export function poolSize(): number {
  return QUOTES.length;
}
