# PLAN — Israel Political–Economic Simulator

## Architecture decisions

1. **pnpm monorepo, TS strict everywhere.** Workspaces: `packages/engine`, `packages/data`, `packages/narrator`, `packages/ui`. Root scripts `pnpm typecheck` / `pnpm test` / `pnpm smoke` fan out to all packages. Vitest as the single test runner.
2. **Engine is a pure library.** Zero runtime deps. `tick(state, decisions, constants, rng)` — note: constants registry is an explicit argument, not an import, so the engine stays pure and the UI can hot-swap parameter sets (economic-model overlays are just merged registries). No `any` (enforced by `@typescript-eslint/no-explicit-any` + strict tsc).
3. **PRNG in-house** (`rng.ts`): splitmix64-seeded sfc32, seeded from a string. Streams are forked per module per tick (`rng.fork("hazards")`) so adding a draw in one module never shifts draws in another — this keeps determinism stable across code growth. State hashing via a small pure FNV-1a/stable-stringify utility for the determinism test.
4. **State**: plain JSON object per CONTRACT C3. Each field's unit lives in a JSDoc on the type. Localities are structure-of-arrays (`Float64Array`/`Int32Array` columns) wrapped in a serializer that converts to/from plain arrays for JSON. Tick returns a new state via structural sharing (shallow-copy touched branches), full immutability asserted in tests by freezing input state.
5. **StatePath addressing** (`state/paths.ts`): dot-paths like `"infrastructure.teachers"` with a typed resolver `getPath/setPath` and a compile-time-checked whitelist of valid targets. Used by ministry outputs, pipeline effects, event effects, and the causal tick log — one addressing scheme everywhere.
6. **LagKernel** (`modules/kernels.ts`): `immediate | step(k) | gamma(shape, scale)` → precomputed per-quarter share arrays (normalized, truncated at 80 quarters). Pipeline effects store `remaining[]` per CONTRACT.
7. **Constants discipline**: `packages/data/constants/*.json`, one file per domain (macro, fiscal, education, health, …). Loader validates every entry against the C2 schema (id, value, unit, lag_kernel, confidence, source, ci?) and fails fast on unknown ids referenced by the engine. Placeholders marked `"confidence": "placeholder"` and indexed in `docs/PLACEHOLDERS.md`.
8. **Causal tick log**: every transfer function application appends `{step, fn, source, target, delta, constant_id}`. This is the "why did that happen" backbone and is written from M1, not retrofitted.
9. **Events & hazards are data**: `packages/engine/src/events/defs/*.json` validated against `EventDef` schema; hazard expressions are a tiny whitelisted expression DSL (variables = normalized state paths, ops = `+ - * exp z()`), evaluated by a parser in the engine — no `eval`, no code in data files.
10. **ETL** (`packages/data/etl`): standalone tsx scripts, raw → normalized + sidecar (CONTRACT C1). Raw dir gitignored. Engine only ever loads `normalized/` + `constants/`.
11. **Narrator** (`packages/narrator`): Ollama HTTP adapter, JSON-schema-validated output, template fallback, response cache keyed by hash(delta-bucket + events). Lives entirely outside the engine; `narrator: off` is the default until M8.
12. **UI** (`packages/ui`, post-M4): React 18 + Vite + Tailwind (tokenized per docs/DESIGN.md, written before first component), Zustand store, engine in a Web Worker via comlink, MapLibre GL map as centerpiece, Recharts for series, Framer Motion for value transitions. Full RTL from the first component.
13. **Units convention**: money in ₪ millions, population in persons, rates as fractions (0–1), quarterly tick. Stated once in `state/units.ts` doc header and used everywhere.
14. **Smoke harness** (`scripts/smoke.ts`): runs 10 years headless with zero-change decisions, prints per-year GDP, debt/GDP, unemployment, population, total spend; asserts no NaN/Infinity/negative stocks, population drift ≤ ±2%/yr, no >50% single-tick move without an event. Run by `pnpm smoke`, part of every gate.

## Folder tree

```
israel-sim/
├── package.json  pnpm-workspace.yaml  tsconfig.base.json
├── PLAN.md  TASKS.md  PROGRESS.md
├── docs/
│   ├── SPEC-DIGEST.md  PLACEHOLDERS.md  DESIGN.md (before UI)
├── scripts/
│   └── smoke.ts                    # headless 10-year sanity run
├── packages/
│   ├── engine/
│   │   ├── src/
│   │   │   ├── state/              # types (units in JSDoc), initial-state loader, paths.ts, soa.ts
│   │   │   ├── ministries/         # generic ministry executor + 17 MinistryDef data rows
│   │   │   ├── modules/            # fiscal.ts markets.ts macro.ts kernels.ts pipeline.ts
│   │   │   │                       # demography.ts sectors.ts localities.ts security.ts
│   │   │   │                       # diplomacy.ts politics.ts cohesion.ts
│   │   │   ├── events/             # hazard.ts (expr DSL), resolver.ts, defs/*.json
│   │   │   ├── constants/          # registry loader + C2 schema validation
│   │   │   ├── tick.ts             # the 13-step ordered pipeline
│   │   │   ├── rng.ts  hash.ts
│   │   │   └── index.ts
│   │   └── test/                   # invariants.test.ts (M1, green forever) + per-module tests
│   ├── data/
│   │   ├── raw/                    # gitignored downloads
│   │   ├── normalized/             # + history/ ; each dataset with sidecar.json
│   │   ├── constants/              # macro.json fiscal.json education.json ... models/*.json overlays
│   │   └── etl/                    # cbs_localities.ts obudget.ts boi.ts ...
│   ├── narrator/                   # ollama adapter, schema, templates, cache
│   └── ui/                         # React app (post-M4)
```

## Deviations / notes
- Spec's smoke/backtest targets need real data only from M2; M1 initial state is a placeholder snapshot (marked per data discipline) approximating 2026 headline figures.
- Parquet (`hyparquet`) adopted at M2 when locality tables arrive; M1 is JSON-only.
- Git repo initialized at M1 scaffold.
