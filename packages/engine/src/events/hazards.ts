/** Hazard evaluation (spec §8.1) and Poisson draws. Pure. */

import type { Rng } from "../rng";
import type { WorldState } from "../state/types";
import type { Registry } from "../constants/registry";
import type { HazardDef } from "./defs";
import { getPath } from "../state/paths";

/** h = base · exp(Σ β·(offset + scale·x)), events per quarter. */
export function evalHazard(s: WorldState, h: HazardDef, c: Registry): number {
  let exponent = 0;
  for (const term of h.terms) {
    const x = getPath(s, term.path);
    exponent += c.get(term.beta_id) * ((term.offset ?? 0) + (term.scale ?? 1) * x);
  }
  return c.get(h.base_rate_id) * Math.exp(exponent);
}

/** Knuth Poisson sampler; adequate for the per-quarter rates used here. */
export function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  const cappedLambda = Math.min(lambda, 30);
  const limit = Math.exp(-cappedLambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > limit);
  return k - 1;
}
