/**
 * Tick step 12: politics.
 * - Approval/grievance mean-reversion toward structural bases (event shocks decay).
 * - Social cohesion (spec §9) is ENDOGENOUS: a structural base minus sectoral
 *   participation divergence, service-burden spread, and distrust.
 * - Coalition (spec §9): stability drifts toward a target built from
 *   coalition-sector approval, budget distance from party preferences, and
 *   protest. Below the fall threshold the government falls and elections
 *   redraw the coalition from current approval by sector.
 * - Civil-war pressure accumulates; above threshold → absorbing state (§8.3).
 */

import type { EngineEvent, MinistryId, PartyState, SectorId, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";
import { SECTOR_IDS } from "./sectors";

const SECTOR_KEY_MINISTRIES: Record<SectorId, MinistryId[]> = {
  secular: ["defense", "economy", "justice"],
  national_religious: ["education", "housing", "defense"],
  haredi: ["religious_services", "education", "welfare"],
  arab: ["welfare", "health", "internal_security"],
  other: ["immigration", "economy", "health"],
};

function coalitionStabilityTarget(s: WorldState, c: Registry): number {
  const parties = s.politics.coalition.parties;
  if (parties.length === 0) return s.politics.coalition.stability;
  let seatSum = 0;
  let approval = 0;
  let distance = 0;
  for (const p of parties) {
    seatSum += p.seats;
    const sector = p.aligned_sector ?? "secular";
    approval += p.seats * s.politics.approval_by_sector[sector];
    const keys = p.key_ministries ?? SECTOR_KEY_MINISTRIES[sector];
    let d = 0;
    for (const m of keys) d += Math.max(0, 1 - s.fiscal.ministries[m].funding_ratio);
    distance += p.seats * (d / keys.length);
  }
  approval /= seatSum;
  distance /= seatSum;
  const raw =
    c.get("politics.stability_intercept") +
    c.get("politics.stability_approval_weight") * approval -
    c.get("politics.stability_budget_weight") * distance -
    c.get("politics.stability_protest_weight") * s.politics.protest_intensity;
  const cap = s.politics.coalition.seats < 61 ? 0.4 : 1;
  return Math.min(cap, Math.max(0, raw));
}

function holdElections(s: WorldState, c: Registry, events: EngineEvent[], log: TickLogEntry[]): void {
  const pop = SECTOR_IDS.reduce((a, id) => a + s.sectors[id].population, 0);
  const weights = SECTOR_IDS.map((id) => ({
    id,
    w: (s.sectors[id].population / pop) * Math.max(0.05, s.politics.approval_by_sector[id] + 0.3),
  }));
  const wSum = weights.reduce((a, x) => a + x.w, 0);
  const parties: PartyState[] = weights.map(({ id, w }) => ({
    id: `party_${id}`,
    seats: Math.max(1, Math.round((120 * w) / wSum)),
    aligned_sector: id,
    key_ministries: SECTOR_KEY_MINISTRIES[id],
  }));
  parties.sort((a, b) => b.seats - a.seats);
  const coalition: PartyState[] = [];
  let seats = 0;
  for (const p of parties) {
    coalition.push(p);
    seats += p.seats;
    if (seats >= 61) break;
  }
  s.politics.coalition = { seats, parties: coalition, stability: c.get("politics.post_election_stability") };
  s.politics.social_cohesion = Math.max(0, s.politics.social_cohesion - c.get("politics.election_cohesion_cost"));
  events.push({ id: "government_falls", note: "coalition stability collapsed", count: 1 });
  events.push({ id: "elections_held", note: `new coalition: ${coalition.map((p) => `${p.id}(${p.seats})`).join(", ")} = ${seats} seats`, count: 1 });
  log.push({ t: s.t, step: 12, fn: "elections", target: "politics.coalition.stability", delta: 0, constant_id: "politics.post_election_stability", note: `new coalition ${seats} seats` });
}

export function politicsStep(s: WorldState, c: Registry, events: EngineEvent[], log: TickLogEntry[]): void {
  const rev = c.get("politics.reversion_quarterly");

  for (const id of SECTOR_IDS) {
    const aBase = c.get(`politics.approval_base_${id}`);
    const dA = rev * (aBase - s.politics.approval_by_sector[id]);
    s.politics.approval_by_sector[id] += dA;
    log.push({ t: s.t, step: 12, fn: "approval_reversion", target: `politics.approval_by_sector.${id}`, delta: dA, constant_id: `politics.approval_base_${id}`, note: null });

    const gBase = c.get(`politics.grievance_base_${id}`);
    const dG = rev * (gBase - s.sectors[id].grievance);
    s.sectors[id].grievance = Math.min(1, Math.max(0, s.sectors[id].grievance + dG));
    log.push({ t: s.t, step: 12, fn: "grievance_reversion", target: `sectors.${id}.grievance`, delta: dG, constant_id: `politics.grievance_base_${id}`, note: null });
  }

  // Endogenous social cohesion (spec §9): structural base minus divergence terms.
  const parts = SECTOR_IDS.map((id) => (s.sectors[id].labour_participation.men + s.sectors[id].labour_participation.women) / 2);
  const pMean = parts.reduce((a, b) => a + b, 0) / parts.length;
  const pVar = parts.reduce((a, b) => a + (b - pMean) ** 2, 0) / parts.length;
  const service = SECTOR_IDS.map((id) => s.sectors[id].military_service_rate);
  const serviceSpread = Math.max(...service) - Math.min(...service);
  const cohesionTarget = Math.min(1, Math.max(0,
    c.get("politics.cohesion_struct_base") -
    c.get("politics.cohesion_participation_var_weight") * pVar -
    c.get("politics.cohesion_service_spread_weight") * serviceSpread -
    c.get("politics.cohesion_trust_weight") * (1 - s.politics.institutional_trust)));
  const dC = rev * (cohesionTarget - s.politics.social_cohesion);
  s.politics.social_cohesion = Math.min(1, Math.max(0, s.politics.social_cohesion + dC));
  log.push({ t: s.t, step: 12, fn: "cohesion_dynamics", target: "politics.social_cohesion", delta: dC, constant_id: "politics.cohesion_struct_base", note: `target=${cohesionTarget.toFixed(3)}` });

  // Coalition stability and possible collapse.
  const target = coalitionStabilityTarget(s, c);
  const dS = c.get("politics.stability_adjust_quarterly") * (target - s.politics.coalition.stability);
  s.politics.coalition.stability = Math.min(1, Math.max(0, s.politics.coalition.stability + dS));
  log.push({ t: s.t, step: 12, fn: "coalition_stability", target: "politics.coalition.stability", delta: dS, constant_id: "politics.stability_intercept", note: `target=${target.toFixed(3)}` });

  if (s.politics.coalition.stability < c.get("politics.fall_threshold") && !s.outcome.ended) {
    holdElections(s, c, events, log);
  }

  // Civil-war pressure (spec §8.3, §9).
  const grievances = SECTOR_IDS.map((id) => s.sectors[id].grievance);
  const gMean = grievances.reduce((a, b) => a + b, 0) / grievances.length;
  const gVar = grievances.reduce((a, b) => a + (b - gMean) ** 2, 0) / grievances.length;
  const excessVar = Math.max(0, gVar - c.get("politics.cwp_grievance_var_ref"));
  const inflow =
    (c.get("politics.cwp_cohesion_weight") * Math.max(0, 0.5 - s.politics.social_cohesion) +
      c.get("politics.cwp_grievance_var_weight") * excessVar +
      c.get("politics.cwp_trust_weight") * Math.max(0, 0.3 - s.politics.institutional_trust)) / 4;
  const decay = c.get("politics.cwp_decay_quarterly") * s.politics.civil_war_pressure;
  const dP = inflow - decay;
  s.politics.civil_war_pressure = Math.min(1, Math.max(0, s.politics.civil_war_pressure + dP));
  log.push({ t: s.t, step: 12, fn: "civil_war_pressure", target: "politics.civil_war_pressure", delta: dP, constant_id: "politics.cwp_cohesion_weight", note: `var(grievance)=${gVar.toFixed(4)}` });

  if (s.politics.civil_war_pressure >= c.get("politics.civil_war_threshold") && !s.outcome.ended) {
    s.outcome = {
      ended: true,
      kind: "civil_conflict",
      note:
        `Civil conflict: cohesion ${(s.politics.social_cohesion * 100).toFixed(0)}%, institutional trust ${(s.politics.institutional_trust * 100).toFixed(0)}%, ` +
        `cross-sector grievance variance ${gVar.toFixed(3)}. The state has lost its monopoly on internal order — an absorbing failure state. ` +
        `War casualties this run: ${Math.round(s.security.war_casualties)}.`,
    };
    events.push({ id: "red_line_civil_conflict", note: s.outcome.note ?? "", count: 1 });
  }
}
