# TECH_DEBT – Build V2

## P0 (kritisch, als Nächstes)
1. **Runtime Validation an Integrationsgrenzen**
   - Betroffen: `adapters/*/adapter.ts`
   - Risiko: Unsichere `unknown` Payloads erzeugen invalide Signals.
   - Maßnahme: Schema-Validation + Fehlerkanal.

2. **Scoring-Testabdeckung**
   - Betroffen: `lib/scoring.ts`
   - Risiko: Regressions bei Gewichtungen/Clamping.
   - Maßnahme: Unit Tests für Weight-Normalisierung, Edge Cases, deterministische Outputs.

3. **API-Vertrag vereinheitlichen**
   - Betroffen: `app/api/*/route.ts`
   - Risiko: Uneinheitliche Consumer-Integration.
   - Maßnahme: `ApiResponse<T>` überall nutzen (inkl. TraceId).

## P1 (hoch)
4. **Persistenz vorbereiten**
   - Risiko: Kein auditierbarer Verlauf.
   - Maßnahme: Tabellen für Candidates, Signals, Scores, ScoreBreakdown.

5. **Security Hardening**
   - Risiko: Fehlende Zugriffskontrolle.
   - Maßnahme: AuthN/AuthZ, Rate Limit, Input-Sanitization.

6. **Provider-spezifische Mappings präzisieren**
   - Risiko: Informationsverlust bei Normalisierung.
   - Maßnahme: Mapping-Konfiguration je Signaltyp/Provider.

## P2 (mittel)
7. **Observability**
   - Maßnahme: Structured Logging + Correlation IDs.
8. **Performance**
   - Maßnahme: Caching & batch-fähige Score-Berechnung.
