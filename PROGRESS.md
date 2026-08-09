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

## M3 — 2026-08-09 — GATE GREEN (round 1 of 3)
- Exists: all 17 ministries have output rows and/or degradation rules in defs/ministries.json. Two new output kinds in the generic executor: funded_flow (housing starts) and inverse_level (welfare→poverty, police→protest). New engine module modules/degradation.ts (step 6b): consecutive-quarter counters in MinistryState.degradation_counters, wildcard "….*" effect paths, additive|multiplicative rates, triggers_event emitted once on activation via TickResult.events. Housing stock accumulation added to stocks step.
- Public interface additions: previewBudget(state, decisions, ctx) → { diffs (shadow-tick numeric diff vs zero-change tick, sorted by relative size), breaks (rules activated by the REQUESTED funding level, with fires_after_quarters), events }. DegradationDef exported.
- Behavior change: rigidity is now a per-quarter cut floor on the CURRENT budget (rigidity^(1/4)) so multi-year cuts compound below one-year limits — this makes deep-cut degradation rules reachable and is truer to spec §5.
- Gate: tsc clean 0-any; 16/16 tests (new m3_preview.test.ts: no-op preview is empty; education cut surfaces quality break + 8q approval delay + negative teacher/deficit diffs; defense 0.75 activates readiness but not deterrence; health raise has no breaks; sustained internal-security cut compounds through rigidity and fires public_safety_crisis exactly once). Smoke unchanged vs M2 (baseline calibrated to steady state).
- Constants: +31 placeholder entries (ministry_outputs.json); registry now 95 entries.
- Stubbed still: localities (M4), hazards/events beyond degradation triggers (M5), security/diplomacy dynamics (M6), politics step (M7).
- Next: M4 — sector response functions, locality SoA agents, migration, participation backtest.

## M4 — 2026-08-09 — GATE GREEN (round 1 of 3; 1 fix: clamp locality employment target)
- Exists: sectorsStep (7b) — participation converges to logistic curves per sector×gender fit to 2000–2025 anchors (etl/calibrate_participation.ts grid search, fit-MAPE ≤1.1%/series), policy shifters (edu/welfare funding), sector poverty responds to participation + welfare underfunding, macro.participation (via 25-64→15+ def_bridge) and macro.poverty_rate now aggregated from sectors. localitiesStep (8) — 1,489 SoA agents (LocalitySoA replaces LocalityState[]): service access ← national service index (teachers/beds/roads), employment ← census base × labour market × services (clamped [.05,.98]), zero-sum internal migration around weighted mean attractiveness, populations rescaled to sector total each tick (conservation across sectors AND localities, invariant-tested). Periphery lever: Decisions.periphery {annual_budget, target_clusters} → fiscal.periphery_spend (in budget constraint + money invariant) → attractiveness bonus per targeted capita.
- Interface: buildInitialState(..., opts {localities, startYear}); sector participation initialized from curves at t0; sector poverty rescaled to match headline; exports sectorsStep/localitiesStep/participationCurve/aggregates/LocalitySoA.
- Gate: tsc clean 0-any; 19/19 tests. Backtest 2000→2025 MAPE per series printed by m4_backtest.test.ts: OVERALL 0.85%, worst arab_women 2.72% (thresholds 8%/12%). Periphery test: targeted clusters 1–3 gain population share and the program raises the deficit. Smoke sane (GDP a bit higher than M3 — participation trend now feeds labour supply).
- Data: welfare ministry poverty output moved from macro-level inverse_level to sector response functions + degradation on haredi/arab poverty.
- Stubbed still: sector income/gini dynamics (M7), grievance decay (M7), hazards (M5), security/diplomacy (M6). Locality housing-cost term in migration deferred.
- Next: M5 — hazard expression DSL, Poisson event draws, 40 core events, ACLED/GTD calibration.
