# Strategic layer — policy tracks, crisis tree, tactical playback

The app's primary loop is now a **half-yearly cabinet decision** on Gaza / West Bank policy, scored on seven
0–100 metrics over an 8-turn (4-year) term. The quarterly economic engine (M1–M10) remains available under
"Economy & budget"; the two layers are not yet coupled.

## Code map
| Piece | File |
|---|---|
| Types (`SimulationMetrics`, `PolicyAction`, `CheckpointStatus`, …) | `packages/engine/src/strategic/types.ts` |
| Data: tracks, coalition reactions, settlement rules, checkpoints, crisis tree (the "scenario tree") | `packages/engine/src/strategic/defs.ts` |
| Reducer: `createInitialState`, `executePolicyDecision`, `resolveCrisis`, `previewPolicyDecision` | `packages/engine/src/strategic/reducer.ts` |
| Playback scripts (salvos, intercepts, units, markers, camera cues) | `packages/ui/src/strategic/scenarios.ts` |
| Schematic geography + projection/camera | `packages/ui/src/strategic/geo.ts` |
| Screens | `screens/Cabinet.tsx`, `screens/Tactical.tsx`, `components/tactical/*` |

Exported from the engine as `strategic` (`import { strategic } from "@engine"`). The reducer is pure; randomness
comes from `state.rngState` (mulberry32), so a run replays exactly. Previews skip random draws.

## Rules as implemented
- **Transition vs sustain.** A track's brief-stated shock applies once, when the posture is *adopted*; while it stays
  in force a smaller per-turn drift applies (assumption). Re-applying the full shock every half-year saturated metrics.
- **Track 1 (forced transfer).** The directive opens the `EGYPTIAN_BALLISTIC_ATTACK` crisis (transient shock shown
  during playback). Options resolve against the *pre-directive* metrics with the brief's deltas. B/C carry the
  transfer out → brief hard rule (US aid 0, regional 0, legitimacy 0, threat 100, economy ≤10) → `STRATEGIC_COLLAPSE`.
  A/D halt it; D adds 4 turns of US conditions (annexation/expansion → −30 aid).
- **Track 5.** Absolute sets from the brief; any non-center-left government falls immediately.
- **Rule 2 (PA security alone).** Gaza control PA/none **and** no IDF freedom → +40 threat once, then +8/turn.
- **Rule 3 (political horizon).** No horizon → no Saudi normalization; Israel pays for Gaza administration (−4/turn).
- **Rule 4 (Bennett–Lieberman–Golan–Abbas).** Settlement building or a freeze/evacuation → −50 coalition, applied
  when the settlement policy *changes*; PA negotiation is the track-4 reaction (−40), not double-counted.
- **Checkpoints** (trusteeship only): strictly in order, at most one per turn. 1 needs IDF freedom; 2 needs the horizon
  and US aid ≥50; 3 needs regional ≥60; 4 needs threat ≤50. **Withdrawal mechanism:** each unfrozen turn after
  stage 1, P = clamp((threat−20)/150, 2%, 50%) (halved once stage 4 holds) of an attack/rearmament → stages 2–4 reset,
  1-turn freeze, +10 threat. No roll while frozen.
- **End conditions:** coalition ≤0, threat ≥90, economy ≤15, cohesion ≤10 (added), else term completed at turn 8.

## Reconciled inconsistencies in the brief
- Prose says trusteeship lifts regional relations to 85; the code gave +30. Checkpoint rewards (+5 each) close the gap.
- Prose says PA return pushes legitimacy/regional "to maximum"; code gave +25/+20 — the code numbers are used.
- Rule 2 says +40, track-4 code said +35 — the rule (+40) is used.
- Checkpoints 2–4 were never set in the brief's code — conditions above are an assumption.
- Crisis option deltas would be meaningless against a threat already at 100 — hence resolution against pre-directive metrics.

## Provenance
Every numeric table in `defs.ts` carries `source: "brief" | "assumption"`; the Cabinet preview underlines assumption
chips, as does the tactical telemetry's interception probability (display assumption, not operational data). Map
outlines are hand-simplified schematics; trajectories are top-down Bezier stylizations of altitude; drones are
time-compressed ×12 for playback (telemetry reports real speed and time-to-impact).

## Outcome distribution with default parameters (300 seeds)
| Government | Annexation | Trusteeship | PA return | Withdrawal |
|---|---|---|---|---|
| Right-wing bloc | economic collapse @5 | coalition collapse (81%) | falls @1 | falls @1 |
| Bennett–Lieberman–Golan–Abbas | falls @1 | **term completed (100%)** | falls @3 | falls @1 |
| Center-left bloc | falls @1 | **term completed (100%)** | term completed | falls @1 |

## Alliance map (home screen)

The app opens on a regional map; every relevant state or armed actor is filled by its **stance toward Israel**, a score from −100 to +100 in six tiers:

| Tier | Score | Color |
|---|---|---|
| Ally | ≥ 55 | deep blue |
| Friendly | 20 … 54 | steel blue |
| Neutral / cold peace | −15 … 19 | grey |
| Strained | −45 … −16 | amber |
| Hostile | −80 … −46 | orange-red |
| Enemy / at war | < −80 | red, hatched |

- Engine: `packages/engine/src/strategic/stances.ts`, which is pure and recomputed from `SimulationState`. The score is `base (2026) + Σ weight × (metric − term-start metric) + track in force + flags (normalization, Gulf funding, terror rearmament, checkpoints) + open or resolved crisis`, clamped to ±100. Each term is returned as a `driver` and listed in the country panel.
- **All numbers are assumptions**, not measurements. The baselines are a judgment call on the 2026 status quo.
- Actors: 20 on the map (Lebanon = Hezbollah, Yemen = Houthis, Iraq = pro-Iran militias, Gaza = Hamas, West Bank = PA) and 6 off the map (US, EU, UK, China, India, Morocco).
- Geography: Natural Earth 1:50m (public domain), cut by `scripts/build-region-geo.mjs` into `packages/ui/src/strategic/region-geo.json`. It uses the same equirectangular projection as the tactical map.
- Trend arrows compare against the state before the last decision (`prevSim` in the strategic store).
