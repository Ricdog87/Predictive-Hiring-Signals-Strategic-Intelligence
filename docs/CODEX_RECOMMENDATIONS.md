# CODEX Recommendations – Review Plan für `claude/build-dashboard-v1-SFWEP`

## Ziel
Sobald der echte Branch verfügbar ist, erfolgt eine harte, code-nahe Review mit priorisierten Patch-Empfehlungen.

## Konkreter Prüfplan

1. **Repository/Branch Integrität**
   - Verifizieren: Branch-Existenz, Commit-Stand, Diff-Basis.

2. **Next.js Strukturprüfung**
   - Prüfen auf Routing-Strategie, Data Fetching Pattern, Server/Client Trennung.

3. **Datei-Tiefenreview**
   - `lib/scoring.ts`: Algorithmik, Explainability, Testbarkeit.
   - `lib/mockData.ts`: Datenqualität, Realitätsnähe, Test-Fitness.
   - `lib/types.ts`: Typdesign, Evolvierbarkeit, API-Kompatibilität.

4. **Dashboard UI Review**
   - UX-Zustände, Re-Render-Verhalten, Responsiveness, A11y.

5. **Security & Performance Baseline**
   - Eingabevalidierung, Datenexposition, schwere Render-Pfade.

6. **Dokumentationsabgleich**
   - Architektur-, Scoring- und Integrationsdoku auf Aktualität prüfen.

## Erwartete Patch-Kandidaten (nach Sichtung)
- TS strictness-Härtung (`tsconfig`/Lint).
- Refactor von Score-Logik zu purem Domain-Service.
- Typangleichung zwischen `types` und `mockData`.
- UI State Machine für Loading/Error/Empty.
- Erweiterbarkeit über Integrations-Ports für Hermes/n8n/MiroFish.

## Freigabekriterien für "Review Complete"
- Alle Fokusbereiche belegt (Datei + Zeilen).
- Mindestens ein konkreter Patch pro P0-Risiko.
- Messbare Verbesserungen (Tests/Checks/Profiling) dokumentiert.
