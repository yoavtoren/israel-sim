/**
 * Tick step 10c: red lines — spec §8.3 and CONTRACT C6. Step-function
 * consequences that must be reachable but never presented as strategies.
 * The post-mortem notes report human cost in explicit numbers.
 */

import type { Decisions, EngineEvent, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";

function collapseDiplomacy(s: WorldState): void {
  for (const country of Object.keys(s.diplomacy.alignment)) {
    s.diplomacy.alignment[country] = Math.min(s.diplomacy.alignment[country], -0.9);
  }
  s.diplomacy.arms_embargo = true;
  s.diplomacy.trade_access.europe = 0.1;
  s.diplomacy.trade_access.asia = 0.1;
  s.diplomacy.trade_access.north_america = 0.15;
  s.diplomacy.trade_access.middle_east = 0.05;
  s.diplomacy.un_standing = -0.95;
  s.diplomacy.us_support.veto_reliability = 0.05;
  s.diplomacy.us_support.military_aid = 0;
  s.diplomacy.sanctions.push({ id: "comprehensive_sanctions", severity: 0.9 });
}

export function redlinesStep(
  s: WorldState,
  decisions: Decisions,
  c: Registry,
  tickIndex: number,
  events: EngineEvent[],
  log: TickLogEntry[],
): void {
  // --- Mass-atrocity order: catastrophic strategic and moral failure state. ---
  if (decisions.orders?.mass_atrocity_order === true && !s.diplomacy.arms_embargo) {
    collapseDiplomacy(s);
    s.security.active_fronts.push({ id: "regional_coalition", intensity: 0.9 });
    for (const adversary of Object.keys(s.security.threat_level)) {
      s.security.threat_level[adversary] = Math.min(1, s.security.threat_level[adversary] + 0.3);
    }
    s.politics.social_cohesion = Math.max(0, s.politics.social_cohesion - 0.2);
    s.politics.institutional_trust = Math.max(0, s.politics.institutional_trust - 0.2);
    const note =
      "Mass-atrocity order issued. Near-total diplomatic collapse: arms embargo, trade access to Europe/Asia cut to ~10%, " +
      "US veto reliability gone, a regional coalition has entered the war. Munition consumption now runs without resupply — " +
      "exhaustion is a computable number of quarters away. This is a catastrophic strategic and moral failure state with an unwinnable endgame.";
    events.push({ id: "red_line_mass_atrocity", note, count: 1 });
    log.push({ t: s.t, step: 10, fn: "red_line", target: "diplomacy.arms_embargo", delta: 1, constant_id: null, note });
  }

  // --- Nuclear use: terminal branch. The game does not model "winning" this. ---
  if (decisions.orders?.nuclear_use === true && !s.outcome.ended) {
    collapseDiplomacy(s);
    for (const region of Object.keys(s.diplomacy.trade_access)) s.diplomacy.trade_access[region] = 0;
    s.outcome = {
      ended: true,
      kind: "nuclear",
      note:
        "Nuclear weapon used. Global alignment collapse; trade access zero; the run ends here. " +
        `War casualties recorded before this order: ${Math.round(s.security.war_casualties)}. ` +
        "The casualties of the strike itself are beyond this model's accounting. There is no post-war scenario to simulate.",
    };
    events.push({ id: "red_line_nuclear", note: s.outcome.note ?? "", count: 1 });
    return;
  }

  // --- Debt spiral: yield above growth past the threshold → forced IMF austerity. ---
  const growthNominal = s.macro.gdp_potential > 0 ? c.get("macro.tfp_growth_annual") + 0.019 : 0; // potential growth proxy
  const armed = s.macro.debt_gdp > c.get("fiscal.debt_spiral_threshold") && s.macro.bond_yield_10y > growthNominal;
  const cooldownKey = "redline.imf_program";
  if (armed && (s.event_cooldowns[cooldownKey] ?? -1) <= tickIndex) {
    const factor = c.get("fiscal.imf_austerity_factor");
    for (const id of Object.keys(s.fiscal.ministries) as Array<keyof typeof s.fiscal.ministries>) {
      const ms = s.fiscal.ministries[id];
      const cut = ms.budget * (1 - factor);
      ms.budget -= cut;
      log.push({ t: s.t, step: 10, fn: "imf_austerity", target: `fiscal.ministries.${id}.budget`, delta: -cut, constant_id: "fiscal.imf_austerity_factor", note: "forced consolidation" });
    }
    s.fiscal.tax_policy.revenue_multiplier *= 1.1;
    s.politics.institutional_trust = Math.max(0, s.politics.institutional_trust - 0.05);
    s.event_cooldowns[cooldownKey] = tickIndex + 8;
    events.push({ id: "red_line_imf_program", note: `Debt ${(s.macro.debt_gdp * 100).toFixed(0)}% of GDP with yields above growth: an IMF program imposes across-the-board austerity (budgets ×${factor}) and tax hikes. The engine applies it for you.`, count: 1 });
  }
}
