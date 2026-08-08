# PROGRESS

## Phase 0 — 2026-08-09
- Spec read in full (~/Downloads/israel-sim-spec.md, 540 lines; the two Download copies are byte-identical).
- Written: docs/SPEC-DIGEST.md (147 lines), PLAN.md, TASKS.md, this file.
- Project root: /Users/yoavtoren/israel-sim. No code yet; nothing scaffolded.
- Key decisions (see PLAN.md): pnpm monorepo; constants registry passed into tick() as an argument; per-module RNG forks for determinism stability; StatePath as the single addressing scheme (ministries/pipeline/events/log); hazard exprs as whitelisted DSL, no eval; localities as SoA typed arrays with JSON serializer; money in ₪M, rates as fractions, quarterly ticks.
- Next: awaiting approval of PLAN.md + TASKS.md, then M1.
