/**
 * Tick step 8: locality agents (spec §6.2), structure-of-arrays.
 * - service access converges toward its base scaled by a national service
 *   index built from ministry stocks (teachers, beds, roads);
 * - employment converges toward its census base adjusted for the national
 *   labour market and local service access;
 * - internal migration flows toward more attractive localities (zero-sum by
 *   construction: rates are deviations from the population-weighted mean);
 * - locality populations are then rescaled to the sector total so population
 *   conserves across sectors AND localities.
 * Periphery programs (Decisions.periphery) add attractiveness to targeted
 * clusters, funded through fiscal.periphery_spend.
 */

import type { TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";
import { totalPopulation } from "./demography";

export function nationalServiceIndex(s: WorldState, c: Registry): number {
  return (
    c.get("localities.service_weight_teachers") * (s.infrastructure.teachers / c.get("localities.service_ref_teachers")) +
    c.get("localities.service_weight_beds") * (s.infrastructure.hospital_beds / c.get("localities.service_ref_beds")) +
    c.get("localities.service_weight_roads") * s.infrastructure.road_capacity
  );
}

export function localitiesStep(s: WorldState, c: Registry, log: TickLogEntry[]): void {
  const L = s.localities;
  if (L.count === 0) return;

  const svcIndex = nationalServiceIndex(s, c);
  const svcConv = c.get("localities.service_convergence_quarterly");
  const empConv = c.get("localities.employment_convergence_quarterly");
  const gammaSvc = c.get("localities.employment_service_gamma");
  const uNat = s.macro.unemployment;
  const uRef = c.get("macro.natural_unemployment");
  const mu = c.get("localities.migration_mu_quarterly");
  const wE = c.get("localities.attract_weight_employment");
  const wS = c.get("localities.attract_weight_services");

  // Periphery program: attractiveness bonus per targeted resident.
  const periphery = s.fiscal.periphery_spend > 0 ? s.fiscal.periphery_target_clusters : [];
  let targetedPop = 0;
  if (periphery.length > 0) {
    for (let i = 0; i < L.count; i++) {
      if (periphery.includes(L.cluster[i])) targetedPop += L.population[i];
    }
  }
  const peripheryBonus =
    targetedPop > 0 ? c.get("localities.periphery_attract_per_msek_capita") * (s.fiscal.periphery_spend / targetedPop) : 0;

  // Pass 1: services, employment, attractiveness.
  const attract = new Array<number>(L.count);
  for (let i = 0; i < L.count; i++) {
    const svcTarget = L.service_base[i] * Math.sqrt(svcIndex);
    L.service_access[i] += svcConv * (svcTarget - L.service_access[i]);

    const empTarget = Math.min(0.98, Math.max(0.05,
      L.emp_base[i] * ((1 - uNat) / (1 - uRef)) + gammaSvc * (L.service_access[i] - L.service_base[i])));
    L.employment[i] += empConv * (empTarget - L.employment[i]);

    attract[i] =
      wE * L.employment[i] +
      wS * L.service_access[i] +
      (periphery.includes(L.cluster[i]) ? peripheryBonus : 0);
  }

  // Pass 2: zero-sum internal migration around the weighted mean attractiveness.
  let popSum = 0;
  let attrSum = 0;
  for (let i = 0; i < L.count; i++) {
    popSum += L.population[i];
    attrSum += L.population[i] * attract[i];
  }
  const meanAttr = attrSum / popSum;
  let net = 0;
  for (let i = 0; i < L.count; i++) {
    const rate = mu * (attract[i] - meanAttr);
    const flow = L.population[i] * rate;
    L.migration_balance[i] = flow * 4; // annualized, persons/yr
    L.population[i] += flow;
    net += flow;
  }

  // Pass 3: sync to the sector total (natural growth lives in the sectors).
  const scale = totalPopulation(s) / (popSum + net);
  for (let i = 0; i < L.count; i++) L.population[i] *= scale;

  log.push({ t: s.t, step: 8, fn: "locality_dynamics", target: "localities.population", delta: 0, constant_id: "localities.migration_mu_quarterly", note: `svcIndex=${svcIndex.toFixed(3)} meanAttr=${meanAttr.toFixed(3)} peripheryBonus=${peripheryBonus.toFixed(4)}` });
}
