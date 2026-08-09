# PLACEHOLDERS — invented values that need real data

Every entry below is marked `"confidence": "placeholder"` in its file. This is the roadmap for the M2/M9 real-data passes. Keep this list in sync with the constants files.

## Resolved in M2 (now real data — kept here as provenance)
- Ministry `baseline_budget` fields: Open Budget 2025 net_allocated, mapped section sums (see budget_2025.sidecar.json for mapping caveats). hasbara stays a ₪500M placeholder (no dedicated section).
- `fiscal.revenue_share_*`, `fiscal.non_ministry_spend_annual`: derived from Open Budget 2025 + BoI GDP (tax-type splits within direct/indirect are imputed 62/28/10 and 78/22).
- Initial macro (GDP, policy rate, 10y yield, unemployment, inflation, participation, USD/ILS): BoI SDMX, mid-2026 readings.
- `macro.working_age_share`: BoI LBM 15+ population / imputed total population (note: 15+, not 15–64).
- Locality table + census-derived sector populations: CBS census 2022 via data.gov.il.

## Remaining imputations introduced in M2 (see initial_2026.sidecar.json)
| What | Value | Replace with |
|---|---|---|
| debt/GDP at t0 | 0.69 | BoI/MoF debt statistics (no SDMX series found; try MoF Accountant General reports) |
| K/Y capital-output ratio | 4.0 | BoI CAP dataflow (capital stock) |
| Population growth since census 2022 | 1.5%/yr | CBS monthly population estimates |
| Sector classification method | area-majority religion×religiosity | CBS social-survey shares (undercounts national_religious: 6.5% vs published ~11%) |
| Direct/indirect tax split into 5 revenue fields | 62/28/10, 78/22 | MoF revenue administration tables |
| `placeholder_initial_2026.json` still supplies | security, diplomacy, politics, infrastructure stocks, environment, sector attributes other than population, fx_reserves, gini, poverty, credit_rating | M4–M6 data passes |

## packages/data/constants/macro.json
| id | value | Replace with |
|---|---|---|
| macro.tfp_growth_annual | 0.007 | BoI productivity reports |
| macro.investment_rate | 0.22 | CBS national accounts |
| macro.working_age_share | 0.58 | CBS demographic tables |
| macro.natural_unemployment | 0.04 | BoI NAIRU estimates |
| macro.phillips_slope | 0.1 | BoI Phillips-curve estimates |
| macro.inflation_anchoring_quarterly | 0.05 | fit to BoI inflation history |
| macro.neutral_real_rate | 0.015 | BoI r* estimates |
| macro.policy_rate_smoothing_quarterly | 0.8 | BoI reaction-function estimates |
| macro.output_gap_persistence_quarterly | 0.85 | fit to CBS quarterly GDP |
| macro.demand_shock_sigma_quarterly | 0.002 | fit to CBS quarterly GDP residuals |
| macro.hc_decay_annual | 0.005 | skill-depreciation literature |

## packages/data/constants/fiscal.json
All five `fiscal.revenue_share_*` (see wholesale note above) — Open Budget / MoF revenue tables.
`fiscal.yield_base`, `fiscal.yield_beta_debt`, `fiscal.yield_beta_deficit` — fit to BoI yield history / sovereign-spread literature.
`fiscal.debt_repricing_quarterly` — MoF debt maturity profile.
`fiscal.rating_debt_coef`, `fiscal.rating_deficit_coef`, `fiscal.rating_adjust_quarterly` — rating-agency methodology studies.

## packages/data/constants/demography.json
`demography.growth_annual_{secular, national_religious, arab, other}` — CBS projections to 2065 by group (haredi is medium-confidence, needs exact series).

## packages/data/constants/education.json
`education.teacher_budget_share`, `education.cost_per_teacher_annual` — Open Budget line items / MoE wage tables.
`education.teacher_adjustment_quarterly`, `education.teacher_max_growth_quarterly` — MoE hiring/attrition, training-pipeline capacity.
`education.spend_to_hc` — own-panel FE estimate (M4 data) anchored on Hanushek & Woessmann 2015.

## packages/data/constants/health.json
`health.bed_budget_share`, `health.cost_per_bed_annual` — Open Budget / MoH hospital cost reports.
`health.bed_adjustment_quarterly`, `health.bed_max_growth_quarterly`, `health.icu_share`, `health.icu_adjustment_quarterly` — MoH bed registry.

## packages/data/constants/defense.json
All six entries (readiness base/adjustment, three production baselines, expiry) — SIPRI, defense-industry reports; some have no public source and will stay expert-judgment with wide CI.

## Added in M3 — packages/data/constants/ministry_outputs.json
All 31 entries are `placeholder` confidence (transport road/rail costs, welfare poverty elasticity, housing starts/subsidy, water desal costs, environment/justice/internal-security level anchors, science/economy TFP elasticities, culture cohesion, hasbara/FA UN-standing). Costs marked "calibrated" are set so baseline funding exactly sustains current stocks — replace alongside their stocks in the M9 pass. Degradation thresholds/rates live inline in packages/data/defs/ministries.json (spec §5 style), all invented.

## Added in M4
- `constants/participation.json`: 40 curve params are `medium` (fit by etl/calibrate_participation.ts to hand-transcribed CBS/BoI/Taub anchors — replace anchors with exact CBS LFS API series); convergence + edu/welfare target betas are placeholder/low (welfare beta is a contested assumption, ci [−0.08, 0]).
- `constants/localities.json`: all 12 entries placeholder (migration mu, attractiveness weights, service refs/weights, periphery elasticity) — replace with CBS internal-migration matrices and program evaluations.
- `constants/sectors.json`: poverty-participation alpha and poverty-welfare beta, both placeholder (NII incidence studies).
- `normalized/history/participation_by_sector.json`: hand-transcribed anchors ±2pp, 25-64 definition (def_bridge constant bridges to 15+ macro rate).

## Added in M5
- `constants/hazards.json`: 32 base rates + 26 betas. `base_terror_incident` and `base_mass_protest` are medium (calibrated to incidents.json 2021–25 regime mean); everything else placeholder — the real ACLED/GTD fit (API key/license needed) replaces them in M9.
- `constants/stability.json`: politics approval/grievance/cohesion bases + reversion, security threat bases + reversion, water deficit relief — all placeholder stubs that M6/M7 replace with endogenous dynamics.
- `normalized/history/incidents.json`: hand-transcribed annual counts ±30% on intifada years.

## Added in M6 — packages/data/constants/conflict.json
45 entries, nearly all placeholder: munition consumption per front intensity (order-of-magnitude from 2023-24 war reporting), mobilization/wear/deterrence params, casualties per intensity-quarter, embargo production penalty, Ω coefficients (mobilization/front), export share (medium), trade weights (needs UN Comtrade), alignment/trade bases and drift, US aid base (medium, MoU), debt-spiral threshold, IMF austerity factor, civil-war-pressure weights + t0 variance reference. Replace with SIPRI/Comtrade/V-Dem-informed fits in M9.
