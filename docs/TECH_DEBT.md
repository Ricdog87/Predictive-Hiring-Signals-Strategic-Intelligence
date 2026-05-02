# TECH_DEBT – Branch `claude/build-dashboard-v1-SFWEP`

## Status
Da der Zielbranch nicht bereitsteht, kann keine codebasierte Debt-Messung erfolgen. Nachfolgend steht der **Review-Backlog für die erste echte Analyse**.

## Debt-Backlog für den realen Branch-Review

### P0 – Muss unmittelbar geprüft/belegt werden
1. **Scoring Determinismus (`lib/scoring.ts`)**
   - Risiko: Nicht reproduzierbare Scores.
   - Nachweis: identische Inputs => identische Outputs (inkl. Float-Rounding-Strategie).

2. **Typkonsistenz (`lib/types.ts` + `lib/mockData.ts`)**
   - Risiko: Laufzeitfehler trotz TypeScript.
   - Nachweis: Mockdaten erfüllen vollständig das Domänenmodell.

3. **UI-Zustandsabdeckung (Dashboard)**
   - Risiko: Fehlende Fehler-/Leer-/Ladezustände.
   - Nachweis: definierte UX für alle Zustandswege.

### P1 – Architekturhärtung
4. **Component Boundary Hygiene**
   - Risiko: Prop Drilling / unklare Ownership.
   - Nachweis: klare Feature-Boundaries und Hook/Service-Schnittstellen.

5. **Performance-Baseline**
   - Risiko: Re-Render-Spikes und langsame Interaktionen.
   - Nachweis: Rendering-Profil und Zielwerte (z. B. p95 Interaction Latency).

6. **Security-Basics**
   - Risiko: unsichere Datenpfade/Exposition.
   - Nachweis: Input Validation, sichere Defaults, keine Secrets im Client.

### P2 – Betrieb & Erweiterbarkeit
7. **Integrationsfähigkeit (Hermes/n8n/MiroFish)**
   - Risiko: Vendor-Kopplung.
   - Nachweis: Port-Adapter Contracts dokumentiert und testbar.

8. **Doku-Lücken**
   - Risiko: Wissensinseln, längere Onboarding-Zeit.
   - Nachweis: ADRs + Scoring/Operations-Doku aktuell.

## Definition of Done (für den nächsten echten Review-Durchlauf)
- Alle Findings sind datei- und zeilenkonkret belegt.
- Jede P0-Feststellung hat einen Patch-Vorschlag.
- Relevante Tests/Checks wurden ausgeführt und dokumentiert.
