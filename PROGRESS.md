# PROGRESS

## Phase 0 — 2026-08-09
- Spec read in full (~/Downloads/israel-sim-spec.md, 540 lines; the two Download copies are byte-identical).
- Written: docs/SPEC-DIGEST.md (147 lines), PLAN.md, TASKS.md, this file.
- Project root: /Users/yoavtoren/israel-sim. No code yet; nothing scaffolded.
- Key decisions (see PLAN.md): pnpm monorepo; constants registry passed into tick() as an argument; per-module RNG forks for determinism stability; StatePath as the single addressing scheme (ministries/pipeline/events/log); hazard exprs as whitelisted DSL, no eval; localities as SoA typed arrays with JSON serializer; money in ₪M, rates as fractions, quarterly ticks.
- Next: awaiting approval of PLAN.md + TASKS.md, then M1.

## M1 — 2026-08-09 — GATE GREEN (round 1 of 3)
- Exists: pnpm monorepo (engine + data); pure engine with 13-step tick (steps 8, 10–12 stubbed); constants registry (C2-validated, 51 entries); 17 ministry defs in data (3 with outputs: education/health/defense); pipeline with gamma/step/immediate kernels + decays_if; causal tick log; placeholder 2026 initial state + sidecar.
- Public interface: `tick(state, decisions, ctx)`, `buildInitialState`, `buildRegistry`, `parseMinistryDefs`, `hashState`, `get/add/setPath`, `totalRevenue/Spend/Population` — all from packages/engine/src/index.ts. ctx = {registry, ministries, start_year}. RNG: per-(seed,tick,module) forked sfc32.
- Conventions: ₪M, annualized flows, fractions 0–1, quarterly tick; deficit_t uses debt_service carried from t−1 (markets step reprices after budget check).
- Gate: tsc clean, 0 `any` (scripts/check-no-any.mjs); 6/6 invariant tests; smoke 10y sane (GDP 2,095→2,428₪B, debt/GDP ~68–71%, u 3.6–4.2%, pop 10.24→12.12M ≈1.85%/yr).
- Stubbed/known gaps: localities empty; tax_policy is a single multiplier; ministry budgets exclude non-ministry spend so revenue shares understated (documented in PLACEHOLDERS.md); degradation rules absent until M3; `pnpm` runs via `corepack pnpm@10` (no global install possible on this machine).
- Next: M2 ETL (CBS localities, Open Budget, BoI) → real initial state within 1% of published figures.
