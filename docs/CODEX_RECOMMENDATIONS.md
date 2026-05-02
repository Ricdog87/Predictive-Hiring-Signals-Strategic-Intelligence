# Codex Recommendations

1. Keep domain language strict: `Company`, `companyId`, `hiringScore`, `CompanySignal`.
2. Keep confidence separate from score; avoid blending into single KPI.
3. Keep adapter contracts provider-agnostic and normalize to a single signal model.
4. Introduce persistence + historical patterns before further model tuning.
5. Extend `/api/predictions` with explainability fields once pattern engine matures.
