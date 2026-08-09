/**
 * Tick step 10a: security dynamics (spec §7.1 step 10, §8.3).
 * Fronts consume munitions; reserves mobilize toward front demand; readiness
 * wears under sustained combat; deterrence follows readiness × supply
 * coverage; threat levels revert toward structural bases; war casualties
 * accumulate. Exhaustion while heavily engaged is a computable defeat.
 */

import type { EngineEvent, MunitionClass, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";

const CLASSES: readonly MunitionClass[] = ["interceptors", "precision_guided", "artillery_shells"];

function consumptionPerQuarter(s: WorldState, c: Registry): Record<MunitionClass, number> {
  const intensity = totalFrontIntensity(s);
  return {
    interceptors: c.get("security.consumption_interceptors_per_intensity") * intensity,
    precision_guided: c.get("security.consumption_precision_per_intensity") * intensity,
    artillery_shells: c.get("security.consumption_shells_per_intensity") * intensity,
  };
}

export function totalFrontIntensity(s: WorldState): number {
  return s.security.active_fronts.reduce((a, f) => a + f.intensity, 0);
}

/** Min over consumed classes of stock / quarterly consumption; Infinity at peace. */
export function quartersOfSupply(s: WorldState, c: Registry): number {
  const cons = consumptionPerQuarter(s, c);
  let min = Infinity;
  for (const cls of CLASSES) {
    if (cons[cls] > 0) min = Math.min(min, s.security.stockpiles[cls] / cons[cls]);
  }
  return min;
}

export function securityStep(s: WorldState, c: Registry, events: EngineEvent[], log: TickLogEntry[]): void {
  const intensity = totalFrontIntensity(s);

  // Domestic production under embargo loses imported components.
  const embargoPenalty = s.diplomacy.arms_embargo ? c.get("security.embargo_production_penalty") : 1;
  if (s.diplomacy.arms_embargo) {
    for (const cls of CLASSES) {
      const cut = s.security.domestic_production[cls] * (1 - embargoPenalty);
      s.security.domestic_production[cls] -= cut;
      s.security.stockpiles[cls] = Math.max(0, s.security.stockpiles[cls] - cut); // production already added in step 4
      log.push({ t: s.t, step: 10, fn: "embargo_production_cut", target: `security.stockpiles.${cls}`, delta: -cut, constant_id: "security.embargo_production_penalty", note: null });
    }
  }

  // Front consumption.
  const cons = consumptionPerQuarter(s, c);
  for (const cls of CLASSES) {
    if (cons[cls] > 0) {
      const used = Math.min(s.security.stockpiles[cls], cons[cls]);
      s.security.stockpiles[cls] -= used;
      log.push({ t: s.t, step: 10, fn: "front_consumption", target: `security.stockpiles.${cls}`, delta: -used, constant_id: "security.consumption_interceptors_per_intensity", note: `intensity=${intensity.toFixed(2)}` });
    }
  }

  // Reserve mobilization follows front demand.
  const mobTarget = Math.min(1, c.get("security.mobilization_per_intensity") * intensity);
  const dMob = c.get("security.mobilization_adjust_quarterly") * (mobTarget - s.security.reserve_mobilization);
  s.security.reserve_mobilization = Math.min(1, Math.max(0, s.security.reserve_mobilization + dMob));
  log.push({ t: s.t, step: 10, fn: "mobilization", target: "security.reserve_mobilization", delta: dMob, constant_id: "security.mobilization_per_intensity", note: null });

  // Combat wear on readiness (the defense ministry output pulls it back up in step 4).
  if (intensity > 0) {
    const wear = c.get("security.readiness_wear_per_intensity") * intensity;
    s.security.force_readiness = Math.max(0, s.security.force_readiness - wear);
    log.push({ t: s.t, step: 10, fn: "readiness_wear", target: "security.force_readiness", delta: -wear, constant_id: "security.readiness_wear_per_intensity", note: null });
  }

  // Deterrence: readiness and supply coverage, spec §5 security board logic.
  const qos = quartersOfSupply(s, c);
  const coverage = Math.min(1, (Number.isFinite(qos) ? qos : c.get("security.supply_ref_quarters")) / c.get("security.supply_ref_quarters"));
  const detTarget = c.get("security.deterrence_base") *
    Math.pow(Math.max(0.01, s.security.force_readiness), c.get("security.deterrence_readiness_exp")) *
    Math.pow(Math.max(0.01, coverage), c.get("security.deterrence_supply_exp"));
  const dDet = c.get("security.deterrence_adjust_quarterly") * (detTarget - s.security.deterrence_index);
  s.security.deterrence_index = Math.min(1, Math.max(0, s.security.deterrence_index + dDet));
  log.push({ t: s.t, step: 10, fn: "deterrence", target: "security.deterrence_index", delta: dDet, constant_id: "security.deterrence_base", note: `qos=${Number.isFinite(qos) ? qos.toFixed(1) : "∞"}` });

  // Threat levels revert toward structural bases (moved here from the M5 stub).
  for (const adversary of Object.keys(s.security.threat_level)) {
    const base = c.get(`security.threat_base_${adversary}`);
    const d = c.get("security.threat_reversion_quarterly") * (base - s.security.threat_level[adversary]);
    s.security.threat_level[adversary] = Math.min(1, Math.max(0, s.security.threat_level[adversary] + d));
    log.push({ t: s.t, step: 10, fn: "threat_reversion", target: `security.threat_level.${adversary}`, delta: d, constant_id: `security.threat_base_${adversary}`, note: null });
  }

  // Human cost of active fronts (CONTRACT C6: reported in explicit numbers).
  if (intensity > 0) {
    const casualties = (c.get("security.casualties_per_intensity_quarter") * intensity) / 1;
    s.security.war_casualties += casualties;
    log.push({ t: s.t, step: 10, fn: "war_casualties", target: "security.war_casualties", delta: casualties, constant_id: "security.casualties_per_intensity_quarter", note: null });
  }

  // Exhaustion while heavily engaged: a computable defeat, not a cliffhanger.
  if (intensity >= c.get("security.exhaustion_intensity_threshold") && qos < 1) {
    s.outcome = {
      ended: true,
      kind: "military_collapse",
      note:
        `Munitions exhausted while fighting at total front intensity ${intensity.toFixed(2)} with no resupply. ` +
        `War casualties to date: ${Math.round(s.security.war_casualties)}. Force readiness ${(s.security.force_readiness * 100).toFixed(0)}%. ` +
        `This is a strategic failure state: the war economy ran out before the war did.`,
    };
    events.push({ id: "military_collapse", note: s.outcome.note ?? "", count: 1 });
  }
}
