# DESIGN — national situation room

Aesthetic: a state's operations floor. Dark, dense, instrument-panel. Bloomberg terminal crossed with a war-room map — not a SaaS dashboard. Numbers are the art. Every component is built from the tokens below and nothing else.

Banned: default Tailwind blue/gray, uncustomized shadcn, emoji as icons, centered hero layouts, purple gradients, big border radii, blur-heavy shadows.

## 1. Color tokens

Surfaces (cool ink ramp, never pure black):

| token | value | use |
|---|---|---|
| `--bg-0` | `#0A0E14` | app background |
| `--bg-1` | `#111722` | panel |
| `--bg-2` | `#1A2230` | elevated panel / hover |
| `--bg-3` | `#232D3F` | active / pressed |
| `--line-0` | `#2A3444` | hairline borders (1px, the primary elevation cue) |
| `--line-1` | `#3A4658` | emphasized borders, table header rules |

Text:

| token | value | use |
|---|---|---|
| `--fg-0` | `#E6EDF3` | primary |
| `--fg-1` | `#93A4B5` | secondary, labels |
| `--fg-2` | `#5C6B7A` | muted, units, disabled |

Semantic ramps (each has dim/base/bright for backgrounds, values and emphasis):

| ramp | dim | base | bright | use |
|---|---|---|---|---|
| good | `#1F6E33` | `#2EA043` | `#3FB950` | improving indicator, positive delta |
| bad | `#8B2E2A` | `#DA3633` | `#F85149` | deteriorating indicator, negative delta |
| warn | `#7A5B0E` | `#D29922` | `#E3B341` | thresholds approaching, degradation preview |
| info | `#1F4E8C` | `#3B82D0` | `#58A6FF` | selection, links, neutral highlights |

"Good/bad" follow the indicator's meaning, not the sign: unemployment ↓ is good-green, debt/GDP ↑ is bad-red. Every delta is signed AND colored.

Domain accents (charts, board headers): fiscal `#E3B341` · macro `#7EE787` · security `#E8604C` · diplomacy `#58A6FF` · social `#D2A8FF` · infrastructure `#79C0FF`.

Sector palette (fixed everywhere — cards, map, charts, legends):

| sector | color |
|---|---|
| secular | `#4C9BE8` |
| national_religious | `#2EA98F` |
| haredi | `#8B7EC8` |
| arab | `#E8A33D` |
| other | `#C97BA8` |

Map choropleths: sequential ramp `#0E1B2C → #1E4976 → #2E7BB8 → #58A6FF → #A5D6FF` (5 stops); diverging (vs national mean) `bad-base → bg-1 → good-base`. Cluster 1–10 uses warn→info interpolation.

## 2. Space, radii, elevation

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48. Panels pack dense: 12px internal padding, 8px between rows.
- Radii: 2px (inputs, cells), 4px (panels), 6px (modals). Nothing rounder.
- Elevation = borders, not shadows: 1px `--line-0` everywhere; a single `0 2px 8px rgb(0 0 0 / 0.45)` only on overlays.
- Grid: 12-col, 1440px reference; sidebar 280px; the map screen is edge-to-edge.

## 3. Typography

- UI + Hebrew: **Heebo** (400 / 500 / 700). Fallback: Rubik, system.
- All numerals: **IBM Plex Mono** with `font-variant-numeric: tabular-nums`. Every number in the app is mono — table cells, tickers, axis labels, deltas.
- Scale (px/line): 11/16 (units, axis), 12/16 (dense table), 13/20 (base), 15/22 (panel titles), 18/26 (section), 24/32 (screen KPIs), 32/40 (post-mortem verdict only).
- Units always visible, always `--fg-2`, never dropped: `₪412.5B`, `3.2%`, `12,400 יח׳`.
- Decimal alignment in tables via tabular mono + fixed fraction digits per column.

## 4. RTL

RTL is the primary direction, from the first component. `dir="rtl"` at the root; logical properties only (`margin-inline-start`, `padding-inline-end`); numbers and sparklines stay LTR inside `<bdi>`/unicode isolates; charts keep LTR time axes with RTL labels. English mode flips to LTR wholesale.

## 5. Motion

- 150–250ms, ease-out, Framer Motion. Transitions carry meaning only:
  - a changing value animates old→new (count-up/down) with a 250ms color pulse in the semantic direction;
  - a panel that gains new causal-trace entries flashes its border `--info-base` once;
  - map choropleth recolors with 200ms crossfade when scrubbing time.
- No decorative motion, no springs, no parallax.

## 6. Reference screens (in words)

**1 — The Budget Chamber.** Full-height dense table, one row per ministry: Hebrew name, current budget (mono, ₪B), proposed (editable cell, mono), % change (signed, colored), rigidity floor shown as a faint red tick inside an inline bar, 12-quarter sparkline of funding ratio. Above the table a fixed strip: revenue, total spend, deficit — live, mono, 24px, deficit colored by band. Right side panel "מה יישבר" (what breaks): the shadow-tick preview — every degradation rule the proposal activates, each with its `surfaces_as` text, delay in quarters (warn-amber chips), and the top-10 state diffs sorted by relative size, each row clickable → causal trace. Confirm button is the only filled-primary element on screen.

**2 — The Map.** Edge-to-edge MapLibre dark canvas, locality polygons choroplethed by any indicator (selector top-right: population, employment, cluster, service access, migration balance). Hover: a locality card — name, population, cluster chip, 4 mono KPIs, migration arrow. Bottom: a time scrubber across the run's quarters; dragging recolors the map and a thin national-aggregate sparkline rides above the scrubber. Periphery programs draw as slow-pulsing outline overlays on targeted localities. Top-left stack: year/quarter in large mono, three national KPIs.

**3 — The Security Board.** Left column: three stockpile gauges (interceptors / precision / shells) — horizontal bars against capacity with a mono "quarters of supply: 14.2" countdown beneath each, turning warn under 8, bad under 4. Center: fronts strip (empty at peace: a single quiet line "אין חזיתות פעילות"), readiness and deterrence as instrument dials with history ghosts. Right: threat matrix — four adversaries × threat level as heat cells with 8-quarter trend arrows. Bottom ticker: security-domain events from the tick log, mono timestamps, cause → effect phrasing from the causal trace.

## 7. Interaction principles

- Every screen answers "why did this change" in one click: any value opens its causal-trace popover — the tick-log entries (step, transfer function, constant id, delta) that produced it, linkable to the constants file entry (source + confidence shown).
- Confidence surfaces in the UI: values driven by `placeholder`-confidence constants render with a dotted underline; hover explains "assumption, not data" (spec §3.4.3).
- The pipeline ("investments maturing") is a first-class panel: horizon chart of pending effects over 20 years, grouped by ministry, with cancel-risk marked where funding is near `decays_below`.
- Keyboard: arrows move between budget cells, +/- nudge by 1%, Enter opens preview. Fast-forward controls: 1Q / 1Y / 2Y / 5Y / 10Y.
