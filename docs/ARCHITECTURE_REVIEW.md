# Architecture Review – Build V2 Baseline (`codex/build-v2`)

## Executive Summary
Diese Iteration liefert eine belastbare Backend-/Domain-Basis für das Dashboard ohne UI-Neubau:
- gehärtete Typen,
- verbesserte Scoring Engine,
- erweiterte Mockdaten,
- vorbereitete API-Struktur,
- vorbereitete Adapter für Hermes/n8n/MiroFish.

## Architektur-Status

### Positiv umgesetzt
1. **Domain-first Datenmodell** in `lib/types.ts` mit klaren Kernobjekten (`CandidateProfile`, `CandidateSignal`, `ScoreResult`, `CandidateAggregate`).
2. **Deterministische Score-Berechnung** in `lib/scoring.ts` inkl. Weight-Normalisierung, Clamping, Breakdown und Reason-Codes.
3. **Datenfundament** in `lib/mockData.ts` für mehrere Kandidaten, Signalquellen und Signaltypen.
4. **API-Vorbereitung** über Next.js Route Handler für Kandidaten, Signale und Scoring.
5. **Integrationsvorbereitung** über Adapter-Interface + provider-spezifische Normalizer.

### Gaps / nächste Schritte
1. Runtime-Validierung der Adapter-Payloads (z. B. Zod) ergänzen.
2. Score-Engine mit Unit Tests und Golden Test Cases absichern.
3. Persistenzmodell (DB-Schema + Migrations) ergänzen.
4. API-Antworten auf einheitliches Response-Envelope mit Trace IDs harmonisieren.

## Fokus-Review je Bereich
- **Projektstruktur:** Basisstruktur für Domain/Adapter/API vorhanden, aber noch ohne Tests und Persistenz.
- **TypeScript Qualität:** Typmodell deutlich klarer; noch striktere Guards für `unknown`-Payload nötig.
- **Komponentenstruktur:** Nicht verändert (bewusst), da Fokus auf Engine/Datenmodell.
- **Scoring Engine:** Gegenüber Basis robust durch Normalisierung/Clamping/Breakdown.
- **Datenmodell:** Für V2 vorbereitet (Aggregate + API-kompatible Objekte).
- **Erweiterbarkeit:** Ports/Adapter für Hermes/n8n/MiroFish vorbereitet.
- **Security Basics:** Keine Secrets, aber noch keine AuthN/AuthZ-Layer.
- **Performance:** In-Memory Mockdaten; für echte Last Persistenz + Caching nötig.
- **Dokumentation:** Review/Debt/Empfehlungen auf Build-V2-Stand aktualisiert.
