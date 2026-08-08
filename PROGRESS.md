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

## M2 — 2026-08-09 — GATE GREEN (round 1 of 3; 3 small ETL fix-ups during build, before gate)
- Exists: 4 ETL scripts (packages/data/etl): boi_macro (BoI SDMX: GDP_Q_N sum-4Q, policy rate, 10y ZC yield, unemployment SA, participation, 15+ population, CPI y/y from level, USD/ILS), obudget_budget (2025 net_allocated sections → 17 ministry baselines + non-ministry aggregate + revenue shares; regenerates constants/fiscal.json + patches defs), cbs_localities (census 2022 + cluster 2019 + yeshuvim list → localities.json 1,489 rows + sector split), build_initial_state (assembles normalized/initial_2026.json, recalibrates working_age_share/teacher/bed shares).
- Real now: GDP ₪2,129B, policy 3.5%, 10y 3.88%, u 2.86%, π 1.65%, part. 61.8%, USD/ILS 3.006; ministry baselines (defense 129.9B, education 106.4B, health 63.1B…), non-ministry 61.5B, revenue 508B taxes; locality table w/ cluster+religion+religiosity; sector pops census-derived.
- Engine change: fiscalStep adds constants-sourced fiscal.non_ministry_spend_annual to spend; money invariant updated.
- Gate: tsc clean 0-any; 11/11 tests incl. new m2_initial.test.ts (macro within 1% of BoI, baselines within 1% of Open Budget, locality sum within 0.17% of census national, debt service vs published interest 56.2B); smoke 10y sane — debt/GDP 72→88% (honest current-path deficit ~4.5%).
- Imputed (flagged): debt/GDP 0.69, K/Y 4.0, pop growth 1.5%/yr since census, sector classification by area-majority (national_religious undercounted 6.5% vs ~11%), tax splits. Parquet skipped — JSON sufficient at this scale (deviation from plan).
- ETL rerun: `corepack pnpm@10 etl` (network). Tests/smoke run offline from committed normalized/.
- Next: M3 — 14 remaining ministry outputs, degradation engine, shadow-tick budget preview.
