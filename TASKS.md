# TASKS

## M1 — State vector, tick skeleton, RNG, fiscal + macro, 3 ministries
- [x] Scaffold pnpm monorepo (workspaces, tsconfig strict, vitest, eslint no-any for engine), git init
- [x] `rng.ts` (string-seeded sfc32 + per-module forks) + `hash.ts` (stable stringify + FNV-1a)
- [x] `state/` — WorldState types with units in JSDoc, placeholder initial state (~2026 Israel headline figures)
- [x] `state/paths.ts` — StatePath resolver + target whitelist
- [x] `constants/` registry loader with C2 schema validation; `packages/data/constants/{macro,fiscal,education,health,defense}.json` (placeholders, plausible magnitudes)
- [x] `docs/PLACEHOLDERS.md` seeded with every invented value
- [x] `modules/kernels.ts` — immediate/step/gamma kernels, precomputed shares
- [x] `modules/fiscal.ts` — revenue, rigidity floors, deficit, debt issuance (tick steps 1–2)
- [x] `modules/markets.ts` — yield/rating/debt-service loop (step 3)
- [x] `ministries/` — generic executor + 3 defs (education, health, defense) with outputs → pipeline (step 4)
- [x] `modules/pipeline.ts` — maturation + decays_if cancellation (step 5)
- [x] Stocks update: depreciation/accumulation (step 6)
- [x] `modules/macro.ts` — Cobb-Douglas + Okun + Phillips + Taylor (step 9); steps 7–8, 10–12 as typed no-op stubs
- [x] `tick.ts` — 13-step pipeline with causal tick log
- [x] Invariant tests: money conservation, population conservation, determinism (state-hash), zero-change smoothness, ministry-doubling monotonicity
- [x] `scripts/smoke.ts` + root `pnpm smoke`
- [x] GATE: typecheck clean (0 any) · tests green · smoke sane → report, wait

## M2 — ETL + real initial state
- [x] ETL: CBS locality file → normalized parquet + sidecar (C1)
- [x] ETL: Open Budget ministry baselines → normalized + sidecar
- [x] ETL: Bank of Israel macro (debt, rate, inflation, FX) + history series
- [x] Initial-state builder from normalized data; imputed values flagged
- [x] Replace placeholder initial state; update PLACEHOLDERS.md (initial-state entries cleared)
- [x] GATE: initial state matches published figures within 1%

## M3 — All 17 ministries + degradation
- [x] 14 remaining MinistryDefs as data rows (outputs, stocks, rigidity, crowding, political_weight)
- [x] Degradation engine: `when`-expr evaluation, rates, `surfaces_as`, `triggers_event`
- [x] Shadow-tick diff API (budget preview) in engine
- [x] Constants for all ministry elasticities (placeholder-marked where invented)
- [x] GATE: budget preview works (engine-level test: propose budget → diff of what moves/breaks)

## M4 — Sectors + localities + migration
- [x] Sector states + response functions from constants; demography (step 7)
- [x] Locality SoA columns + serializer; migration/employment/services tick (step 8)
- [x] Periphery-program lever (targeted flows)
- [x] ETL: sectoral participation history 2000–2025
- [x] GATE: backtest of sectoral participation 2000–2025 (report MAPE)

## M5 — Hazard engine + 40 core events
- [x] Hazard model as structured JSON terms (base·exp(Σβx), βs from constants, no eval — safer than a string DSL)
- [x] Poisson event draws from forked RNG stream; cooldowns; escalation `spawns`
- [x] 40 core EventDefs (JSON) + effects application via StatePath
- [x] Incident history 2000–2025 (hand-transcribed Shabak/GTD anchors; ACLED/GTD APIs need keys/licenses) + calibration script
- [x] GATE: terror/protest rates match historical distribution

## M6 — Security, diplomacy, red lines
- [ ] Stockpiles produce/consume, quarters-of-supply, force readiness, deterrence (step 10)
- [ ] Diplomacy: alignment drift, sanctions, trade_access, US support
- [ ] Red lines: mass-atrocity, nuclear (terminal), debt spiral → IMF, civil-conflict absorbing state (per C6)
- [ ] GATE: isolation scenario terminates coherently (stockpile exhaustion → computable defeat)

## M7 — Reforms, economic models, coalition
- [ ] Reform system (prerequisites, pipeline non-refund on repeal)
- [ ] Economic-model overlays as constants merges + transition costs
- [ ] Coalition module: party budget preferences → stability → collapse/elections (step 12)
- [ ] Social-cohesion aggregation feeding readiness/emigration/civil_war_pressure
- [ ] GATE: government can fall

## M8 — Narrator
- [ ] docs/DESIGN.md (tokens, typography, reference screens) — before any UI work beyond M4 debug views
- [ ] Ollama adapter + JSON-schema validation + template fallback + cache; `narrator: off` default
- [ ] Hebrew/English prompt templates, consequence-register constraint for red-line endings
- [ ] GATE: plays fine with narrator off

## M9 — Calibration
- [ ] Backtest 2000→2025 with actual budgets + shocks; MAPE per series
- [ ] Sensitivity sweep ±1 SD over constants; rank dominant coefficients
- [ ] Adversarial exploit hunt; each exploit → new degradation rule
- [ ] GATE: MAPE reported per series
