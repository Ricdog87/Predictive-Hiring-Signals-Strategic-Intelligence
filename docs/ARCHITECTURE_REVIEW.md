# Architecture Review — Company Hiring Intelligence

## Scope
Engine-only refactor from candidate-centric scoring to company-centric hiring intelligence.

## Core domain decision
- The system scores companies only (no person-level entities).
- Inputs are company-level hiring signals/events.
- Outputs are hiring score, confidence score, hiring window expectation, and role-cluster prediction.

## API surface
- `GET /api/companies`
- `GET /api/company/:id`
- `GET /api/signals`
- `GET /api/score?companyId=...`
- `GET /api/predictions`

## Notes
- No CV, applicant, or matching logic remains in the scoring path.
- Adapters normalize external payloads to `CompanySignal`.
