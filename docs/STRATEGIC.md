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

## Crisis engine (M12)
`packages/engine/src/strategic/crisisEngine.ts` — five crises, each with a historical precedent card, ≥3 options
(objective, pros, cons, the brief's metric deltas) and trigger rules. Crises halt the timeline and open the
`CrisisDecisionModal`; at most one per turn, highest priority first; no crisis once the coalition has already fallen.

| Crisis | Trigger (probabilities are assumptions) | Cooldown | Precedent |
|---|---|---|---|
| EGYPTIAN_BALLISTIC_ATTACK | forced-transfer directive (certain; "pre" phase — resolves against pre-directive metrics) | — | 1979 treaty; Egypt's Oct 2023 red line; Geneva IV Art. 49 |
| PA_SECURITY_COLLAPSE | PA return + PA/no Gaza control + no IDF freedom: certain when rule 2 first fires, else 35%/turn | 2 | Oslo 1996/2000, Defensive Shield 2002, Gaza 2007 |
| TUNNEL_NETWORK_EXPOSED | a trusteeship checkpoint passes: 50% | 3 | EUBAM/Rafah 2005–06, Protective Edge 2014 |
| EGYPT_TREATY_BREACH | annexation with military government: 60% on adoption / 20% sustained; any track with regional ≤ 20: 15% | 3 | Annex I zones A–D, MFO 1981, Philadelphi 2005/2024 |
| IRAN_COMBINED_BARRAGE | post-decision threat ≥ 60: 10% + (threat−60)/80 | 3 | April & October 2024 |

- "post" crises suspend the turn AFTER the decision applied; the option's deltas add to those metrics, then the end check runs.
- `TUN_ULTIMATUM_48H` is a seeded 60/40 gamble; the modal previews both branches (`resolveCrisis(state, id, { branch })`).
- Option side-effects: Defensive Shield 2 restores IDF control (stops terror-infrastructure growth); freezing funds pauses
  the staged process and Gulf money; US-brokered exits impose US conditions; A/D of the transfer crisis abandon the track.
- `previewCrisisRisks(state, action)` lists what the drafted decision could open (shown in the Cabinet preview).
- Bug fixed on the way: `finish()` never persisted `rngState`, so every random draw in a term reused the same number.

With default parameters and crises resolved by always taking the first / last option (300 seeds), crises open ~0.4–1.25
times per term and the choice matters: e.g. center-left PA return ends in security collapse 95% of the time taking the
first options, and completes the term 100% taking the last.

## Tactical renderer (M12)
`strategic/renderer.ts` draws everything procedurally from simulation time (smoke puffs, debris, shockwaves are recomputed
from emission time + hash noise), so scrubbing backwards is exact. Radar sweep with blips, pulsing envelopes, target-lock
reticles on threatened cities, NATO/APP-6-style unit frames (friendly rectangle/circle/dome, hostile diamond, neutral
square; armor/mech/infantry/SOF/engineer/supply/police/MFO/air/naval/carrier icons; echelon marks), standing order of
battle (IAF wings, Sa'ar corvettes, US carrier group East Med, US destroyer Red Sea), cruise missiles weave (terrain
contouring stylized), drones fly in swarms, ballistic missiles loft then accelerate hard in the terminal phase, heavy
impacts shake the camera while playing. Base layer: Natural Earth 1:50m outlines (`region-geo.json`). Per-crisis scenes
and per-option aftermaths: `strategic/crisisScripts.ts`. Dev builds expose `window.__tactical` for headless QA.

## Prime Minister campaign (M13) — the app's main screen
`packages/engine/src/strategic/campaign/` (parties, dilemmas, reducer) + `ui/src/screens/Game.tsx`, `components/game/*`.

Flow: **welcome → pick a party → form a coalition (≥61 seats, no mutual refusals) → doctrine popup ("choose the
government's policy on the Israeli–Palestinian conflict") → the doctrine's first dilemma (radical right: "what will you
do in Gaza?") → consequence popups → next dilemma …** until an ending.

- Parties: two seat rosters, both summing to 120 — **current polls (default)**: the average of the 10 polls published
  9–15 September 2026 (per Wikipedia's polling table), largest-remainder rounded: Yashar (Eisenkot) 24, Likud 22,
  Together (Bennett & Lapid) 13, The Democrats (Golan) 9, Yisrael Beiteinu 8, Shas 8, UTJ 8, Otzma Yehudit 7, Joint List 7,
  Religious Zionism–Zehut 5, Ra'am 5, Amcha Yisrael (Winter) 4; Blue and White and the Reservists below the threshold.
  And **the November 2022 election**. Toggle on the welcome screen; leaders shown on the cards. Security positions,
  refusals and frictions are game assumptions from public positions.
- Poll arithmetic (one-click benchmarks in the builder): Netanyahu bloc 54 ✗; + Lieberman 62 (deep friction with the
  Haredi parties); Eisenkot + Bennett + Golan + Lieberman 54 ✗; + Ra'am 59 ✗; + Joint List 66 (stability 15, deep
  frictions); unity Eisenkot + Likud + Bennett + Lieberman 67 (stability 63).
- Coalition: each partner has 0–100 patience. Doctrines and options move patience by party group (far right / right /
  Haredi / center / left / Arab parties); ≤25 → threat popup, ≤0 → the party quits; below 61 seats → the government falls.
  The coalition-stability metric is the seat-weighted patience.
- Dilemmas: 5 doctrine openers, 14 follow-ups (Jordan treaty, settler violence, ICC warrants, EU boycott, Hezbollah,
  Houthis, US arms hold, reservist refusal, mass protests, civil revolt, downgrade, terror attack, Saudi deal, ceasefire
  talks), plus the 5 crisis-engine crises adapted as dilemmas. `next` chains are forced; otherwise a weighted draw over
  eligible dilemmas (weights from metrics and narrative flags, with cooldowns).
- Consequences carry metric deltas, per-country stance shifts (an additive overlay on the stances model —
  `campaignStances`), partner reactions, flags, a camera focus (world, Europe, US, Gulf, Red Sea, Sinai, Gaza…) and a
  visual (salvo, strike, ground move, protest, crisis scene, nuclear detonation) drawn by the tactical renderer over the
  world map.
- Endings: government fell (<61 seats); state collapse — external (threat ≥95; US aid ≤5 with threat ≥75; economy ≤10;
  total isolation incl. US aid ≤20; nuclear use; carrying out the forced transfer under fire) or internal (cohesion ≤10);
  term completed after 16 quarters **only if no war is going on** (war = Lebanon front, a transfer war with Egypt, or
  threat ≥70). At the end of the term during a war, elections are postponed and ceasefire talks are forced.
- World map: `ui/src/strategic/world-geo.json` (230 countries, Natural Earth 1:50m, `scripts/build-world-geo.mjs`),
  colored by stance; EU members, US, UK, China and India now have territory on the map.
