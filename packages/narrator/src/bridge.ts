/**
 * Engine → narrator bridge: extracts the headline numbers from a tick result.
 * The only place the narrator touches engine types; it reads numbers and
 * event notes, nothing else (CONTRACT C5).
 */

import type { TickResult, WorldState } from "../../engine/src/index";
import type { Lang, NarratorInput } from "./types";

export function buildNarratorInput(prev: WorldState, result: TickResult, lang: Lang): NarratorInput {
  const s = result.state;
  const pct = (v: number): number => Math.round(v * 1000) / 10;
  const gdpGrowthAnnual = Math.pow(s.macro.gdp_real / prev.macro.gdp_real, 4) - 1;

  const redLine =
    s.outcome.ended ||
    result.events.some((e) => e.id.startsWith("red_line") || e.id === "military_collapse");

  return {
    tick: { year: s.t.year, quarter: s.t.quarter },
    lang,
    red_line: redLine,
    deltas: {
      gdp_growth: { value: pct(gdpGrowthAnnual), delta: pct(gdpGrowthAnnual), unit: "%" },
      unemployment: { value: pct(s.macro.unemployment), delta: pct(s.macro.unemployment - prev.macro.unemployment), unit: "%" },
      inflation: { value: pct(s.macro.inflation), delta: pct(s.macro.inflation - prev.macro.inflation), unit: "%" },
      deficit_gdp: { value: pct(s.fiscal.deficit / s.macro.gdp_real), delta: pct(s.fiscal.deficit / s.macro.gdp_real - prev.fiscal.deficit / prev.macro.gdp_real), unit: "%" },
      debt_gdp: { value: pct(s.macro.debt_gdp), delta: pct(s.macro.debt_gdp - prev.macro.debt_gdp), unit: "%" },
      cohesion: { value: pct(s.politics.social_cohesion), delta: pct(s.politics.social_cohesion - prev.politics.social_cohesion), unit: "%" },
      protest: { value: pct(s.politics.protest_intensity), delta: pct(s.politics.protest_intensity - prev.politics.protest_intensity), unit: "%" },
    },
    events: result.events.map((e) => ({ id: e.id, note: e.note, count: e.count })),
    sector_moods: { ...s.politics.approval_by_sector },
    war_casualties: s.security.war_casualties,
  };
}
