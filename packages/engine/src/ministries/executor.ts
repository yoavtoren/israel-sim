/**
 * Tick step 4: generic ministry executor. Iterates MinistryDef output rows;
 * no ministry-specific code. Long-lag outputs are pushed into the pipeline.
 */

import type { PendingEffect, TickLogEntry, WorldState } from "../state/types";
import type { MinistryDef } from "./defs";
import type { Registry } from "../constants/registry";
import { addPath, getPath, setPath } from "../state/paths";
import { parseKernelShares } from "../modules/kernels";

export function ministriesStep(
  s: WorldState,
  defs: MinistryDef[],
  c: Registry,
  tickIndex: number,
  log: TickLogEntry[],
): void {
  for (const def of defs) {
    const ms = s.fiscal.ministries[def.id];
    const fr = ms.funding_ratio;

    for (const out of def.outputs) {
      switch (out.kind) {
        case "funded_stock": {
          const sustainable = (ms.budget * c.get(out.budget_share_id)) / c.get(out.cost_per_unit_id);
          const stock = getPath(s, out.target);
          let delta = c.get(out.adjust_rate_id) * (sustainable - stock);
          const cap = c.get(out.max_growth_id) * Math.max(stock, 1);
          delta = Math.max(-cap, Math.min(cap, delta));
          addPath(s, out.target, delta);
          log.push({ t: s.t, step: 4, fn: `${def.id}.funded_stock`, target: out.target, delta, constant_id: out.cost_per_unit_id, note: null });
          break;
        }
        case "derived_stock": {
          const target = getPath(s, out.source_path) * c.get(out.share_id);
          const stock = getPath(s, out.target);
          const delta = c.get(out.adjust_rate_id) * (target - stock);
          addPath(s, out.target, delta);
          log.push({ t: s.t, step: 4, fn: `${def.id}.derived_stock`, target: out.target, delta, constant_id: out.share_id, note: null });
          break;
        }
        case "readiness": {
          const level = Math.min(1, c.get(out.base_id) * Math.pow(fr, def.crowding));
          const cur = getPath(s, out.target);
          const delta = c.get(out.adjust_rate_id) * (level - cur);
          addPath(s, out.target, delta);
          log.push({ t: s.t, step: 4, fn: `${def.id}.readiness`, target: out.target, delta, constant_id: out.base_id, note: null });
          break;
        }
        case "production": {
          const rate = c.get(out.baseline_id) * fr;
          s.security.domestic_production[out.munition_class] = rate;
          s.security.stockpiles[out.munition_class] += rate;
          log.push({ t: s.t, step: 4, fn: `${def.id}.production`, target: `security.stockpiles.${out.munition_class}`, delta: rate, constant_id: out.baseline_id, note: null });
          break;
        }
        case "funded_flow": {
          const flow = c.get(out.base_id) + (ms.budget * c.get(out.budget_share_id)) / c.get(out.cost_per_unit_id);
          const cur = getPath(s, out.target);
          setPath(s, out.target, flow);
          log.push({ t: s.t, step: 4, fn: `${def.id}.funded_flow`, target: out.target, delta: flow - cur, constant_id: out.cost_per_unit_id, note: null });
          break;
        }
        case "inverse_level": {
          const level = c.get(out.base_id) * Math.pow(Math.max(fr, 1e-6), -c.get(out.elasticity_id));
          const cur = getPath(s, out.target);
          const delta = c.get(out.adjust_rate_id) * (level - cur);
          setPath(s, out.target, Math.max(0, cur + delta));
          log.push({ t: s.t, step: 4, fn: `${def.id}.inverse_level`, target: out.target, delta, constant_id: out.elasticity_id, note: null });
          break;
        }
        case "pipeline": {
          // Elasticity unit: Δtarget per unit funding-ratio deviation sustained 1 year.
          const dev = fr - 1;
          if (Math.abs(dev) > 1e-9) {
            const entry = c.entry(out.elasticity_id);
            const magnitude = (entry.value * dev) / 4; // this quarter's contribution
            const shares = parseKernelShares(entry.lag_kernel);
            const effect: PendingEffect = {
              origin: { tick: tickIndex, ministry: def.id, decision: `funding_ratio=${fr.toFixed(3)}` },
              target: out.target,
              magnitude,
              kernel: entry.lag_kernel,
              remaining: shares.map((sh) => sh * magnitude),
              decays_if: { ministry_funding_below: out.decays_below },
            };
            s.pipeline.push(effect);
            log.push({ t: s.t, step: 4, fn: `${def.id}.pipeline_enqueue`, target: out.target, delta: magnitude, constant_id: out.elasticity_id, note: entry.lag_kernel });
          }
          break;
        }
      }
    }
  }
}
