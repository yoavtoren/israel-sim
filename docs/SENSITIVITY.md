# SENSITIVITY — ±1 SD sweep over all constants (spec §12.3)

Sensitivity = mean relative change across 7 headline outputs (GDP, debt/GDP, unemployment, poverty, cohesion, readiness, human capital) after a 10-year zero-change run, per unit relative parameter change. SD from the constant's ci where present, else ±20%.

Hazard-driven runs share one seed; rankings are indicative, not exact. **The top rows with `placeholder` confidence are the priority list for real econometric work.**

| rank | constant | confidence | sensitivity | dominates |
|---|---|---|---|---|
| 1 | `participation.def_bridge` | medium | 0.800 | debt_gdp |
| 2 | `diplomacy.trade_access_ref` | placeholder | 0.697 | unemployment |
| 3 | `fiscal.revenue_share_income` | medium | 0.270 | debt_gdp |
| 4 | `participation.secular_women.high` | medium | 0.266 | debt_gdp |
| 5 | `participation.secular_men.high` | medium | 0.263 | debt_gdp |
| 6 | `diplomacy.trade_weight_europe` | placeholder | 0.251 | unemployment |
| 7 | `fiscal.revenue_share_vat` | medium | 0.235 | debt_gdp |
| 8 | `politics.cohesion_struct_base` | placeholder | 0.229 | cohesion |
| 9 | `participation.arab_women.t0` | medium | 0.214 | debt_gdp |
| 10 | `diplomacy.trade_weight_asia` | placeholder | 0.200 | unemployment |
| 11 | `diplomacy.trade_weight_north_america` | placeholder | 0.184 | unemployment |
| 12 | `participation.secular_women.t0` | medium | 0.168 | debt_gdp |
| 13 | `macro.investment_rate` | placeholder | 0.157 | debt_gdp |
| 14 | `defense.readiness_base` | placeholder | 0.151 | readiness |
| 15 | `diplomacy.trade_base_europe` | placeholder | 0.142 | unemployment |
| 16 | `diplomacy.trade_base_asia` | placeholder | 0.138 | unemployment |
| 17 | `macro.natural_unemployment` | placeholder | 0.132 | unemployment |
| 18 | `fiscal.revenue_share_corporate` | medium | 0.117 | debt_gdp |
| 19 | `participation.arab_men.high` | medium | 0.102 | debt_gdp |
| 20 | `macro.depreciation_annual` | medium | 0.102 | debt_gdp |
| 21 | `fiscal.revenue_share_customs` | medium | 0.101 | debt_gdp |
| 22 | `participation.haredi_women.t0` | medium | 0.094 | debt_gdp |
| 23 | `diplomacy.trade_base_north_america` | placeholder | 0.088 | unemployment |
| 24 | `participation.arab_women.high` | medium | 0.080 | debt_gdp |
| 25 | `macro.tfp_growth_annual` | medium | 0.079 | debt_gdp |
| 26 | `fiscal.non_ministry_spend_annual` | medium | 0.078 | debt_gdp |
| 27 | `hazards.beta_threat` | placeholder | 0.074 | cohesion |
| 28 | `participation.arab_men.t0` | medium | 0.066 | debt_gdp |
| 29 | `participation.haredi_women.high` | medium | 0.063 | debt_gdp |
| 30 | `participation.national_religious_women.high` | medium | 0.051 | cohesion |

Swept 272 constants. Bottom 196 have sensitivity <0.01 — rough values are fine there (spec §12.3).
