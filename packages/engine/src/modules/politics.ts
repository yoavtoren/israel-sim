/**
 * Tick step 12 (M5 stub of the M7 politics module): mean reversion that keeps
 * ambient event shocks bounded. Approval, grievance and cohesion decay toward
 * constants-declared bases; the full coalition/stability model replaces the
 * bases with endogenous targets in M7.
 */

import type { SectorId, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";
import { SECTOR_IDS } from "./sectors";

export function politicsStep(s: WorldState, c: Registry, log: TickLogEntry[]): void {
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
}
