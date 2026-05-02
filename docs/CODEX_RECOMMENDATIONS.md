# CODEX Recommendations – Next Implementation Steps (V2)

## 1) Scoring Engine weiter härten
- `computeCandidateScore` um:
  - min. required signals,
  - stale-signal penalty,
  - optional provider trust multipliers erweitern.
- Modellversion bei jeder Regeländerung erhöhen.

## 2) Typen und Datenmodell
- Discriminated unions für provider-spezifische Metadaten einführen.
- `CandidateSignal.meta` schrittweise von loose Record auf typed submodels umstellen.

## 3) API-Struktur produktionsreif machen
- Response-Envelope standardisieren (`data`, `traceId`, `generatedAt`).
- Fehlerobjekte vereinheitlichen (`code`, `message`, `details`).
- `POST /api/signals` und `POST /api/score/recompute` ergänzen.

## 4) Adapter-Reifegrad erhöhen
- Jeder Adapter erhält:
  - parser/validator,
  - mapping layer,
  - recoverable error handling.
- Contract tests je Adapter gegen fixture payloads.

## 5) Betriebsfähigkeit
- Feature Flags für neue Scoring-Regeln.
- Audit-Log für Score-Berechnungen.
- Metrics: score latency, adapter parse errors, missing signal ratio.
