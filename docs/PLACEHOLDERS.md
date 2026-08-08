# PLACEHOLDERS — invented values that need real data

Every entry below is marked `"confidence": "placeholder"` in its file. This is the roadmap for the M2/M9 real-data passes. Keep this list in sync with the constants files.

## Wholesale placeholder files
| File | What | Replace with |
|---|---|---|
| `packages/data/normalized/placeholder_initial_2026.json` | Entire initial state (macro, sectors, security, diplomacy, politics, infrastructure) | M2: CBS locality/sector files, BoI macro series, MoH/MoE stocks, Open Budget |
| `packages/data/defs/ministries.json` `baseline_budget` fields | Ministry baselines, sum ₪457.5B — **excludes non-ministry spend** (pensions, general transfers, interest is separate), so revenue shares below are deliberately understated to keep the deficit plausible (~2.7% GDP). Internally consistent, jointly wrong vs. reality. | M2: Open Budget (next.obudget.org) approved-budget lines; add non-ministry spend lines, then restore realistic ~30% revenue/GDP |

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
