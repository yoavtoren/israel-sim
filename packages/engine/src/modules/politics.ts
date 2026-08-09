/**
 * Tick step 12 (M5 stub of the M7 politics module): mean reversion that keeps
 * ambient event shocks bounded. Approval, grievance and cohesion decay toward
 * constants-declared bases; the full coalition/stability model replaces the
 * bases with endogenous targets in M7.
 */

import type { EngineEvent, SectorId, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";
import { SECTOR_IDS } from "./sectors";

export function politicsStep(s: WorldState, c: Registry, events: EngineEvent[], log: TickLogEntry[]): void {
  const rev = c.get("politics.reversion_quarterly");

  for (const id of SECTOR_IDS as readonly SectorId[]) {
    const aBase = c.get(`politics.approval_base_${id}`);
    const dA = rev * (aBase - s.politics.approval_by_sector[id]);
    s.politics.approval_by_sector[id] += dA;
    log.push({ t: s.t, step: 12, fn: "approval_reversion", target: `politics.approval_by_sector.${id}`, delta: dA, constant_id: `politics.approval_base_${id}`, note: null });

    const gBase = c.get(`politics.grievance_base_${id}`);
    const dG = rev * (gBase - s.sectors[id].grievance);
    s.sectors[id].grievance = Math.min(1, Math.max(0, s.sectors[id].grievance + dG));
    log.push({ t: s.t, step: 12, fn: "grievance_reversion", target: `sectors.${id}.grievance`, delta: dG, constant_id: `politics.grievance_base_${id}`, note: null });
  }

  const dC = rev * (c.get("politics.cohesion_base") - s.politics.social_cohesion);
  s.politics.social_cohesion = Math.min(1, Math.max(0, s.politics.social_cohesion + dC));
  log.push({ t: s.t, step: 12, fn: "cohesion_reversion", target: "politics.social_cohesion", delta: dC, constant_id: "politics.cohesion_base", note: null });

  // Civil-war pressure (spec §8.3, §9): accumulates from cohesion collapse,
  // grievance divergence across sectors, and institutional-trust breakdown;
  // decays when society recovers. Above the threshold: absorbing state.
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
