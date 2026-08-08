# SPEC DIGEST — Israel Political–Economic Simulator (v1.0)

Source: ~/Downloads/israel-sim-spec.md (540 lines). This digest is the working reference; do not re-read the spec.

Core idea: no authored scenarios. A state vector + ~40 transfer functions + ~120 declarative events + hazard model → scenarios emerge.

## Design pillars
1. Everything is a stock or a flow. Budgets change flows; flows fill stocks slowly; stocks determine outcomes.
2. No free lunches: budget constraint enforced by engine (deficit → yield → debt service).
3. Every ministry is the same object (data rows, not bespoke code). 17 ministries.
4. Falsifiable: every elasticity is a cited number in a data file.
5. LLM narrates, never decides.
6. Determinism: (initial state, policy sequence, seed) → bit-for-bit reproducible.

## CONTRACTS (must not be improvised)
- **C1 ETL sidecar**: every normalized dataset ships `{ id, source_url, retrieved, license, rows, schema, known_gaps[], transform_script }`. Raw files never read by engine. Imputed values flagged.
- **C2 Constants entry**: `{ id, value, unit, lag_kernel, confidence, source, ci }`. Every engine coefficient comes from constants files. Zero magic numbers in engine.
- **C3 WorldState**: one plain JSON-serializable object; immutable between ticks (tick returns new state); every field's unit documented in the type definition.
- **C4 Tick purity**: `tick(state, decisions, rng) → { state, events, log }`. No I/O, no Date.now(), no Math.random(). Seeded PRNG only.
- **C5 Narrator**: receives numbers `{tick, deltas, events, sector_moods, lang}` → returns text `{headlines, minister_quotes, street_mood}`. Never returns state. Schema-validated; fallback to templated text. `narrator: off` mode fully playable. Cached by hash(delta bucket + event set).
- **C6 Catastrophic branches**: reachable but never presented as strategies. Post-mortem reports human cost in explicit numbers; narrator constrained to consequence-reporting register.

## State vector (WorldState top-level keys)
- `t {year, quarter}`, `seed`
- `macro`: gdp_real, gdp_potential, inflation, policy_rate, unemployment, participation, debt_gdp, bond_yield_10y, credit_rating (0–20), shekel_usd, fx_reserves, productivity_index, capital_stock, gini, poverty_rate
- `fiscal`: revenue breakdown (income/VAT/corporate/capital/customs), tax_policy, ministries: Record<MinistryId, MinistryState>, debt_service, deficit, emergency_reserve
- `sectors`: Record<SectorId, SectorState> — population, growth_rate, age_structure, labour_participation {men,women}, education_years, vocational_share, income_median, poverty_rate, welfare_dependency, military_service_rate, political_representation, grievance (0–1), trust_in_state, fertility
- `localities`: ~1,200 agents (SoA typed arrays) — population by sector, socioeconomic cluster, distance from centre, employment, housing, infrastructure quality, service access, migration balance
- `security`: stockpiles + domestic_production per MunitionClass, force_readiness (0–1), reserve_mobilization, intel_capability, active_fronts, deterrence_index, threat_level per adversary
- `diplomacy`: alignment per country (−1..+1), sanctions, arms_embargo, trade_access per region (0–1 export multiplier), un_standing, us_support {military_aid, veto_reliability}
- `politics`: coalition {seats, parties, stability}, approval_by_sector, protest_intensity, social_cohesion, institutional_trust, civil_war_pressure (hazard accumulator)
- `infrastructure`: road_capacity, rail_km, congestion_index, hospital_beds, icu_beds, physicians_per_1000, classrooms, teachers, teacher_quality_index, desalination_capacity_mcm, water_deficit, generation_capacity_mw, renewable_share, housing_stock, housing_starts
- `environment`: emissions, air_quality_index, open_space_index
- `reforms`: Record<ReformId, ReformState>; `economic_model`: EconomicModelId
- `pipeline`: PendingEffect[] — the delayed-payoff mechanism
- `log`: TickLogEntry[]

## Ministry abstraction
`MinistryDef { id, baseline_budget, rigidity (0–1 uncuttable share), outputs: OutputDef[], stocks, degradation: DegradationDef[], political_weight per sector, crowding }`
`OutputDef { target: StatePath, cost_per_unit, lag: LagKernel, elasticity_id → constants, saturation }`
Degradation: `{ when: "funding_ratio < x [for Ny]", effect, rate, surfaces_as, triggers_event? }`.
Budget "what breaks" preview = one-tick shadow simulation diff, not hardcoded warnings.
17 ministries: defense, education, health, transport, culture&sport, foreign affairs, hasbara, environment, water&agriculture, welfare, housing, internal security, justice, economy, science, religious services, immigration&absorption.

## Tick order (fixed, 13 steps)
1. Resolve player decisions (budget, tax, reforms, orders)
2. Budget constraint check (revenue, rigidity floors, deficit, debt issuance)
3. Financial markets (deficit + debt/GDP → yield → rating → next-period debt service)
4. Ministry spending → outputs (cost-per-unit, saturation, diminishing returns; delayed effects → pipeline)
5. Mature pipeline effects (apply elapsed lags)
6. Stocks update (depreciation, degradation, accumulation)
7. Sector dynamics (demography, participation, income, grievance)
8. Locality dynamics (migration, employment, services)
9. Macro aggregation: `Y = A · K^α · (L·H)^(1−α) · Ω`; Okun's law; Phillips relation; Taylor rule
10. Security & diplomacy (stockpiles produce/consume, deterrence, alignment drift, sanctions)
11. Hazard evaluation & event resolution
12. Politics (approval, coalition stability, protest, cohesion, possible collapse)
13. Log & emit (structured tick log → narrator)

## Pipeline (delayed payoff)
`PendingEffect { origin {tick, ministry, decision}, target: StatePath, magnitude, kernel: LagKernel, remaining: number[], decays_if: string|null }`
Gamma(shape=4, scale=2.2): ~nothing years 1–3, peak years 8–10, tail to 20. Later cuts cancel undelivered remainder. UI must expose "investments maturing".

## Hazards & events
`h(event) = base_rate · exp(Σ βᵢ·xᵢ)` — βᵢ from constants (fit vs ACLED/GTD). Poisson draw per quarter.
`EventDef { id, hazard, condition, cooldown, effects, spawns (escalation chains), player_choices?, narrative_context }` — ~120 total, ~40 core.
Red lines (step-function): mass-atrocity order (alignment collapse, embargo, trade→~0.1, no resupply → computable defeat), nuclear use (terminal), debt spiral (IMF forced austerity), civil conflict (absorbing state above civil_war_pressure threshold).

## Social cohesion & politics
Cohesion falls with: cross-sector outcome variance, service-burden asymmetry, perceived budget unfairness, falling institutional trust. Multiplies into: protest, strikes, reserve mobilization willingness (→ force_readiness), high-productivity emigration (→ A, tax base), civil_war_pressure.
Coalition: parties with budget-vector preferences; distance lowers stability; below threshold → government falls (end run or elections drawn from approval_by_sector).

## Economic models & reforms
Economic model (libertarian…statist-command) = JSON overlay on constants (tax rates, multipliers, labour flexibility, public provision share, inequality drift, TFP from private investment, union power). Mid-game switch: transition cost + stability shock.
Reform: `{ id, prerequisites, fiscal_cost, effects, lag, political_cost_by_sector, reversible }`. Repeal does not refund pipeline.

## Sectors (agents)
Secular Jewish, national-religious, Haredi, Arab (Muslim/Druze/Bedouin/Christian sub-splits if data), immigrants by cohort; cross-cutting: reservists, self-employed, pensioners, high-tech. Response functions from constants (e.g. core-curriculum: +vocational 12y lag, +grievance now). Causal chains emerge, never scripted ifs.

## Localities
~1,200 from CBS file. Tick (vectorized): migration = f(jobs, housing cost, service quality, sector affinity, periphery incentives); employment = f(local jobs, commute via road/rail, education stock); services = f(ministry stocks by formula + local strength). Periphery programs = targeted flows; engine computes whether they work. Perf target: 10-year run < ~200ms via SoA typed arrays.

## Stack
TS strict; engine pure (zero runtime deps except seeded PRNG); Web Worker + comlink; React 18 + Vite + Tailwind; Recharts (or visx); MapLibre GL + locality GeoJSON; JSON + Parquet (hyparquet); Ollama local LLM (aya-expanse:8b / mistral-nemo / gemma2 — test Hebrew); Zustand; Vitest.

## Data kinds
A. Initial state (~50k numbers, download) → `data/normalized/`. B. Structural parameters (~400, from literature or own panel FE, or assume+label) → `data/constants/`. C. Historical series (~200, download) → `data/normalized/history/`.
Sources: CBS (api.cbs.gov.il, locality file, socioeconomic clusters), Open Budget (next.obudget.org / budgetkey.org), Bank of Israel, NII, MoE, MoH, Water Authority, energy, Knesset Open Data, CBS GeoJSON; World Bank/IMF/OECD, SIPRI, ACLED/GTD, UN Comtrade, V-Dem.

## Calibration & validation (M9)
Backtest from 2000 with actual budgets + shocks (2008, COVID, 2023–24 war) → MAPE per series. Adjust least-sourced coefficients only. Sensitivity sweep ±1 SD over ~400 constants. Sanity invariants as unit tests. Adversarial exploit hunt; every exploit found = missing degradation rule.

## Milestones
| M | Contents | Closing test |
|---|---|---|
| M1 | State vector, tick skeleton, RNG, fiscal + macro, 3 ministries | 10-year run stable, money conserves |
| M2 | ETL: CBS localities + Open Budget; real initial state | Initial state matches published figures within 1% |
| M3 | All 17 ministries as data rows; degradation rules | Budget preview panel works |
| M4 | Sectors + locality agents + migration | Backtest sectoral participation 2000–2025 |
| M5 | Hazard engine + 40 core events | Terror/protest rates match historical distribution |
| M6 | Security, diplomacy, sanctions, stockpiles, red lines | Isolation scenario terminates coherently |
| M7 | Reforms + economic models + coalition politics | Government can fall |
| M8 | Local narrator | Plays fine with narrator off |
| M9 | Calibration, sensitivity sweep, exploit hunt | MAPE reported per series |

M1–M3 is where the project is won or lost. No UI polish before M4.

## UI surface (post-M4)
Budget table (rigidity floors, live deficit) · impact preview (shadow-tick diff) · map choropleth + periphery overlays · sector cards · security board (quarters-of-supply) · pipeline view (20y maturities) · run controls (1Q/1/2/5/10y) · post-mortem with no-change counterfactual. Every screen answers "why did this change" via the tick log's causal trace.

## Scope honesty
Outputs are restatements of the ~400 coefficients; show uncertainty bands, ship the sensitivity sweep early. Aim for directionally-right and internally consistent, not fake precision.
