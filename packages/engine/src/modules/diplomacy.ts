/**
 * Tick step 10b: diplomacy. Alignment and trade access drift toward
 * structural bases shifted by UN standing; US aid follows the US alignment.
 * Under an arms embargo (pariah status after a red line) nothing recovers —
 * drift is frozen and aid is cut to zero.
 */

import type { TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";

export function tradeWeightedAccess(s: WorldState, c: Registry): number {
  return (
    c.get("diplomacy.trade_weight_europe") * (s.diplomacy.trade_access.europe ?? 0) +
    c.get("diplomacy.trade_weight_north_america") * (s.diplomacy.trade_access.north_america ?? 0) +
    c.get("diplomacy.trade_weight_asia") * (s.diplomacy.trade_access.asia ?? 0) +
    c.get("diplomacy.trade_weight_middle_east") * (s.diplomacy.trade_access.middle_east ?? 0)
  );
}

export function diplomacyStep(s: WorldState, c: Registry, log: TickLogEntry[]): void {
  if (s.diplomacy.arms_embargo) {
    // Pariah status: no drift back toward normal, aid stays at zero.
    if (s.diplomacy.us_support.military_aid > 0) {
      log.push({ t: s.t, step: 10, fn: "aid_cutoff", target: "diplomacy.us_support.military_aid", delta: -s.diplomacy.us_support.military_aid, constant_id: null, note: "arms embargo" });
      s.diplomacy.us_support.military_aid = 0;
    }
    return;
  }

  const drift = c.get("diplomacy.alignment_drift_quarterly");
  const unCoupling = c.get("diplomacy.alignment_un_coupling");
  for (const country of Object.keys(s.diplomacy.alignment)) {
    const target = Math.min(1, Math.max(-1, c.get(`diplomacy.alignment_base_${country}`) + unCoupling * s.diplomacy.un_standing));
    const d = drift * (target - s.diplomacy.alignment[country]);
    s.diplomacy.alignment[country] += d;
    log.push({ t: s.t, step: 10, fn: "alignment_drift", target: `diplomacy.alignment.${country}`, delta: d, constant_id: `diplomacy.alignment_base_${country}`, note: null });
  }

  for (const region of Object.keys(s.diplomacy.trade_access)) {
    const target = Math.min(1, Math.max(0, c.get(`diplomacy.trade_base_${region}`) * (1 + 0.1 * s.diplomacy.un_standing)));
    const d = drift * (target - s.diplomacy.trade_access[region]);
    s.diplomacy.trade_access[region] += d;
    log.push({ t: s.t, step: 10, fn: "trade_drift", target: `diplomacy.trade_access.${region}`, delta: d, constant_id: `diplomacy.trade_base_${region}`, note: null });
  }

  const aidTarget = c.get("diplomacy.aid_base") * Math.max(0, s.diplomacy.alignment.usa ?? 0);
  const dAid = c.get("diplomacy.aid_adjust_quarterly") * (aidTarget - s.diplomacy.us_support.military_aid);
  s.diplomacy.us_support.military_aid += dAid;
  log.push({ t: s.t, step: 10, fn: "us_aid", target: "diplomacy.us_support.military_aid", delta: dAid, constant_id: "diplomacy.aid_base", note: null });
}
