# DESIGN — national situation room

Aesthetic: a well-edited briefing paper — calm, warm, light. Quality newspaper data journalism crossed with a modern product: paper ground, white cards, ink text, a serif for headlines, generous whitespace, soft layered shadows. Numbers are important but typeset, not terminal. (Replaced the original dark "Bloomberg terminal" direction on 2026-09-16: users found it cold, robotic and repellent.) Every component is built from the tokens in `packages/ui/src/theme.css` and nothing else.

Banned: dark "war-room" backgrounds, monospace numerals, CRT scanlines/vignettes, 2px boxy cells, all-caps letter-spaced labels, neon-on-black glows, default Tailwind blue/gray, emoji as icons, purple gradients.

## 1. Color tokens

Surfaces (warm paper ramp):

| token | value | use |
|---|---|---|
| `bg0` | `#F4F1EA` | page / sidebar |
| `bg1` | `#FFFFFF` | card, modal, floating panel |
| `bg2` | `#F6F3ED` | inset area, hover |
| `bg3` | `#EBE6DC` | pressed, bar tracks |
| `line0` | `#E7E1D6` | hairline borders |
| `line1` | `#D3CBBD` | emphasized borders |

Ink: `fg0 #1C2330` primary · `fg1 #555E6C` secondary · `fg2 #8B919A` muted.

Semantic ramps — `dim` is a light tint for pill/background fills, `base` for marks/borders/bars, `bright` is the DARK variant used as text on paper:

| ramp | dim | base | bright |
|---|---|---|---|
| good | `#DCEFE3` | `#3C9A66` | `#1F7A4A` |
| bad | `#F8E0DC` | `#D9534A` | `#B3302A` |
| warn | `#F7ECD2` | `#D49A2A` | `#946312` |
| info | `#E2EBF7` | `#2F63B0` | `#24518F` |

"Good/bad" follow the indicator's meaning, not the sign. Every delta is signed AND colored.

Domain accents: fiscal `#C9921F` · macro `#3C9A66` · security `#D05A43` · diplomacy `#2F63B0` · social `#8A63C2` · infrastructure `#3B8FB8`. Sectors: secular `#3F84CF` · national_religious `#2A9A82` · haredi `#7A6BBD` · arab `#D9912A` · other `#BF6A9A`.

Maps: sea `#DCE7EC`, context land `#F7F4EE` with white borders, Israel paper-white with a deep-blue outline. Stance tiers: ally `#3569B8` · friendly `#86B2D6` · neutral `#D6D1C6` · cold `#E9C77E` · hostile `#E08A5E` · enemy `#C0453B`. Map labels are dark ink with a white halo. Sequential ramp `#EEF3F8 → #23508F`; diverging `bad → paper → good`.

## 2. Space, radii, elevation

- Spacing scale (px): 4, 8, 12, 16, 20, 24, 32. Cards use 16–20px padding; screens 24px gutters.
- Radii: 6px (inputs), 10px (buttons, small cards), 14px (panels), 18–22px (modals, floating map panels), full (pills, chips, bar tracks).
- Elevation: `.panel` has a hairline + barely-there shadow; `.overlay` (floating) has a soft three-layer shadow. `.glass` = 95% white with light blur for chrome over maps.
- Buttons: `.btn-primary` (ink, the main action), `.btn-accent` (blue), `.btn-ghost`, `.btn-danger`. One primary per view.
- Sidebar 240px; the map screens are edge-to-edge with floating cards.

## 3. Typography

- UI + Hebrew: **Rubik** (400/500/600/700), fallback Heebo.
- Headlines (`.display`): **Frank Ruhl Libre** 700 — screen titles, dilemma/consequence headlines, panel titles, big dates.
- Numbers (`.num`): Rubik with tabular figures, LTR-isolated. No monospace.
- Labels (`.eyebrow`): 11.5px medium `fg2`, sentence case — never tracking-wide caps.
- Scale (px/line): 12/17 (secondary — the minimum for readable text), 13/19, 14/21 (base), 15–16 (emphasis), 17–21 (panel titles, serif), 25/32 (headlines, serif), 38–44 (hero / verdict, serif).
- Units always visible in `fg2`: `₪412.5B`, `3.2%`.

## 4. RTL

RTL is the primary direction, from the first component. `dir="rtl"` at the root; logical properties only (`margin-inline-start`, `padding-inline-end`); numbers and sparklines stay LTR inside `<bdi>`/unicode isolates; charts keep LTR time axes with RTL labels. English mode flips to LTR wholesale.

## 5. Motion

- 150–320ms, ease-out. Transitions carry meaning, plus gentle entrances for cards and modals (fade / 16px rise):
  - a changing value animates old→new (count-up/down) with a 250ms color pulse in the semantic direction;
  - a panel that gains new causal-trace entries flashes its border `--info-base` once;
  - map choropleth recolors with 200ms crossfade when scrubbing time.
- No bouncy springs, no parallax.

## 6. Reference screens (in words)

**1 — The Budget Chamber.** Full-height dense table, one row per ministry: Hebrew name, current budget (mono, ₪B), proposed (editable cell, mono), % change (signed, colored), rigidity floor shown as a faint red tick inside an inline bar, 12-quarter sparkline of funding ratio. Above the table a fixed strip: revenue, total spend, deficit — live, mono, 24px, deficit colored by band. Right side panel "מה יישבר" (what breaks): the shadow-tick preview — every degradation rule the proposal activates, each with its `surfaces_as` text, delay in quarters (warn-amber chips), and the top-10 state diffs sorted by relative size, each row clickable → causal trace. Confirm button is the only filled-primary element on screen.

**2 — The Map.** Edge-to-edge MapLibre light canvas, locality polygons choroplethed by any indicator (selector top-right: population, employment, cluster, service access, migration balance). Hover: a locality card — name, population, cluster chip, 4 mono KPIs, migration arrow. Bottom: a time scrubber across the run's quarters; dragging recolors the map and a thin national-aggregate sparkline rides above the scrubber. Periphery programs draw as slow-pulsing outline overlays on targeted localities. Top-left stack: year/quarter in large mono, three national KPIs.

**3 — The Security Board.** Left column: three stockpile gauges (interceptors / precision / shells) — horizontal bars against capacity with a mono "quarters of supply: 14.2" countdown beneath each, turning warn under 8, bad under 4. Center: fronts strip (empty at peace: a single quiet line "אין חזיתות פעילות"), readiness and deterrence as instrument dials with history ghosts. Right: threat matrix — four adversaries × threat level as heat cells with 8-quarter trend arrows. Bottom ticker: security-domain events from the tick log, mono timestamps, cause → effect phrasing from the causal trace.

## 7. Interaction principles

- Every screen answers "why did this change" in one click: any value opens its causal-trace popover — the tick-log entries (step, transfer function, constant id, delta) that produced it, linkable to the constants file entry (source + confidence shown).
- Confidence surfaces in the UI: values driven by `placeholder`-confidence constants render with a dotted underline; hover explains "assumption, not data" (spec §3.4.3).
- The pipeline ("investments maturing") is a first-class panel: horizon chart of pending effects over 20 years, grouped by ministry, with cancel-risk marked where funding is near `decays_below`.
- Keyboard: arrows move between budget cells, +/- nudge by 1%, Enter opens preview. Fast-forward controls: 1Q / 1Y / 2Y / 5Y / 10Y.

## 8. The living map

`packages/ui/src/strategic/ambient.ts` draws a persistent, state-driven layer over the campaign and tactical maps (below and above the tactical script). It is a pure function of real time + campaign flags/metrics, pseudo-3D (light from the north-west: height lifts things up the screen and casts a soft south-east shadow), and fades in by zoom level (sea/air from region zoom, ground at country zoom, people at close zoom).

- Separation barrier (3D wall) — torn down with a north→south demolition sweep when annexation / PA dismantling / transfer is in force; the Gaza fence always stands.
- Skylines (Tel Aviv glass towers, Jerusalem stone + golden dome), Ben Gurion runways, Kinneret and Dead Sea, gas rigs with flares.
- Sea: container ships and tankers on Haifa/Ashdod/Suez/Red Sea lanes (Red Sea traffic replaced by a burning ship and Houthi skiffs under blockade), navy corvettes (more under siege), fishing boats in calm times, a US carrier group when threat or aid is high.
- Ground: Merkava tanks patrolling the Gaza and Lebanon borders and the Golan (inside Gaza / southern Lebanon when occupied / at war), UN vehicles after a withdrawal, infiltrating squads from Gaza, the West Bank and Lebanon scaled by the threat metric (stopped at an intact barrier, IDF teams respond), protest crowds with flags.
- Air: fighter CAPs and strike sorties with smoke columns at the target, long-range sorties toward Iran at extreme threat, rocket fire from Gaza/Lebanon and ballistic missiles from Iran/Yemen on 3D arcs with ground tracks, intercepted by Iron Dome / Arrow, and El Al-style airliners leaving Ben Gurion — their number is emigration pressure (cohesion, economy, threat, protests, sanctions, emergency rule).

Dev QA: `window.__campaign.useCampaign.setState(...)` puts the game in any state.
