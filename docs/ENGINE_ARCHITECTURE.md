# Engine Architecture

## Layers
1. Ingestion (`src/sources`, `src/parsers`)
2. Normalization (`src/normalizers`, `src/pipeline`)
3. Company Intelligence (`lib/scoring`, `lib/mockData`)
4. Market Intelligence (`src/market/engine.ts`)
5. API (`app/api/*`)

No UI logic, outreach, CRM, or email automation in engine scope.
