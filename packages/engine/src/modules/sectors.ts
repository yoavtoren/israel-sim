/**
 * Tick step 7b: sector dynamics (spec §6.1). Participation converges to a
 * calibrated logistic trend curve per sector×gender (fit to CBS/BoI/Taub
 * 2000–2025 anchors by packages/data/etl/calibrate_participation.ts), shifted
 * by declared policy response functions (education/welfare funding ratios).
 * Poverty responds to participation changes and welfare underfunding; income
 * tracks GDP per capita; macro.participation and macro.poverty_rate are
 * population-weighted aggregates of the sectors.
 */

import type { SectorId, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";
import { totalPopulation } from "./demography";

export const SECTOR_IDS: readonly SectorId[] = ["secular", "national_religious", "haredi", "arab", "other"];

/** Calibrated logistic trend value for one sector×gender at a given year. */
export function participationCurve(c: Registry, sector: SectorId, gender: "men" | "women", year: number): number {
  const p = (param: string): number => c.get(`participation.${sector}_${gender}.${param}`);
  return p("low") + (p("high") - p("low")) / (1 + Math.exp(-p("k") * (year - p("t0"))));
}

function yearFraction(s: WorldState): number {
  return s.t.year + (s.t.quarter - 1) / 4;
}

/** Weighted 25-64 participation aggregate over sectors. */
export function aggregateParticipation(s: WorldState): number {
  let w = 0;
  let p = 0;
  for (const id of SECTOR_IDS) {
    const sec = s.sectors[id];
    const wa = sec.population * sec.age_structure[1];
    w += wa;
    p += wa * ((sec.labour_participation.men + sec.labour_participation.women) / 2);
  }
  return p / w;
}

export function aggregatePoverty(s: WorldState): number {
  let w = 0;
  let p = 0;
  for (const id of SECTOR_IDS) {
    const sec = s.sectors[id];
    w += sec.population;
    p += sec.population * sec.poverty_rate;
  }
  return p / w;
}

export function sectorsStep(s: WorldState, c: Registry, log: TickLogEntry[]): void {
  const year = yearFraction(s);
  const conv = c.get("participation.convergence_quarterly");
  const eduBeta = c.get("participation.edu_target_beta");
  const welfareBeta = c.get("participation.welfare_target_beta");
  const frEdu = s.fiscal.ministries.education.funding_ratio;
  const frWelfare = s.fiscal.ministries.welfare.funding_ratio;
  const policyShift = (1 + eduBeta * (frEdu - 1)) * (1 + welfareBeta * (frWelfare - 1));
  const alphaPov = c.get("sectors.poverty_participation_alpha");
  const betaPov = c.get("sectors.poverty_welfare_beta");

  // Real GDP per capita growth this tick (for income drift), from last tick's GDP.
  const pop = totalPopulation(s);

  for (const id of SECTOR_IDS) {
    const sec = s.sectors[id];
    let dPartMean = 0;
    for (const gender of ["men", "women"] as const) {
      const target = participationCurve(c, id, gender, year) * policyShift;
      const cur = sec.labour_participation[gender];
      const delta = conv * (target - cur);
      sec.labour_participation[gender] = cur + delta;
      dPartMean += delta / 2;
      log.push({ t: s.t, step: 7, fn: "participation_convergence", target: `sectors.${id}.labour_participation.${gender}`, delta, constant_id: `participation.${id}_${gender}.k`, note: null });
    }

    // Poverty: falls as participation rises; rises under sustained welfare underfunding.
    const dPov = -alphaPov * dPartMean + (betaPov * Math.max(0, 1 - frWelfare) * sec.poverty_rate) / 4;
    sec.poverty_rate = Math.max(0.01, sec.poverty_rate + dPov);
    if (dPov !== 0) {
      log.push({ t: s.t, step: 7, fn: "sector_poverty", target: `sectors.${id}.poverty_rate`, delta: dPov, constant_id: "sectors.poverty_participation_alpha", note: null });
    }
  }

  void pop; // sector income dynamics arrive with the M7 income module

  const aggP = aggregateParticipation(s) * c.get("participation.def_bridge");
  const dAgg = aggP - s.macro.participation;
  s.macro.participation = aggP;
  log.push({ t: s.t, step: 7, fn: "participation_aggregate", target: "macro.participation", delta: dAgg, constant_id: "participation.def_bridge", note: null });

  const aggPov = aggregatePoverty(s);
  const dPovAgg = aggPov - s.macro.poverty_rate;
  s.macro.poverty_rate = aggPov;
  log.push({ t: s.t, step: 7, fn: "poverty_aggregate", target: "macro.poverty_rate", delta: dPovAgg, constant_id: null, note: null });
}
