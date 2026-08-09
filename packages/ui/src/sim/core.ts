/** Pure simulation host: builds the engine context from bundled data and runs
 *  the game loop. No DOM, no comlink — worker.ts wraps it, tests call it directly.
 */

import {
  buildInitialState, buildRegistry, parseEventDefs, parseMinistryDefs, parseModelDefs,
  parseReformDefs, previewBudget, quartersOfSupply, tick, totalRevenue, totalSpend,
  type BudgetPreview, type Decisions, type EngineContext, type MinistryId, type MunitionClass,
  type SectorId, type TickResult, type WorldState,
} from "@engine";
import {
  constantGroups, eventsJson, initialJson, localityCoords, localityRows, ministriesJson,
  modelsJson, reformsJson,
} from "../data";
import type { AdvancePayload, FrameSector, HistoryFrame, InitPayload, RunMeta, SimApi } from "./types";

const MUNITIONS: MunitionClass[] = ["interceptors", "precision_guided", "artillery_shells"];

export class SimCore implements SimApi {
  private ctx: EngineContext;
  private state: WorldState;
  private initial: WorldState;
  private tickIndex = 0;
  /** decisions actually applied, keyed by the tick index they entered */
  private applied: Array<{ at: number; decisions: Decisions }> = [];

  constructor(seed = "situation-room") {
    const registry = buildRegistry(constantGroups);
    this.ctx = {
      registry,
      ministries: parseMinistryDefs(ministriesJson),
      events: parseEventDefs(eventsJson),
      reforms: parseReformDefs(reformsJson),
      models: parseModelDefs(modelsJson),
      start_year: initialJson.start_year,
    };
    this.initial = buildInitialState(initialJson, this.ctx.ministries, registry, seed, {
      localities: localityRows,
    });
    this.state = this.initial;
  }

  init(seed: string): InitPayload {
    const registry = this.ctx.registry;
    this.initial = buildInitialState(initialJson, this.ctx.ministries, registry, seed, {
      localities: localityRows,
    });
    this.state = this.initial;
    this.tickIndex = 0;
    this.applied = [];

    const loc = this.state.localities;
    const lon = new Float64Array(loc.count);
    const lat = new Float64Array(loc.count);
    for (let i = 0; i < loc.count; i++) {
      const c = localityCoords[String(loc.code[i])];
      lon[i] = c ? c[0] : NaN;
      lat[i] = c ? c[1] : NaN;
    }

    const meta: RunMeta = {
      seed,
      start_year: initialJson.start_year,
      ministries: this.ctx.ministries.map((m) => ({
        id: m.id,
        baseline_budget: m.baseline_budget,
        rigidity: m.rigidity,
      })),
      reforms: this.ctx.reforms.map((r) => ({
        id: r.id,
        fiscal_cost: r.fiscal_cost,
        reversible: r.reversible,
        prerequisites: [...r.prerequisites],
      })),
      models: this.ctx.models.map((m) => m.id),
      localities: {
        code: [...loc.code],
        name_he: [...loc.name_he],
        cluster: [...loc.cluster],
        lon,
        lat,
      },
      placeholder_ids: registry
        .all()
        .filter((e) => e.confidence === "placeholder")
        .map((e) => e.id),
    };

    return { meta, frame: this.project(this.state, []), state: this.state };
  }

  advance(quarters: number, decisions: Decisions): AdvancePayload {
    const frames: HistoryFrame[] = [];
    if (Object.keys(decisions).length > 0) this.applied.push({ at: this.tickIndex, decisions });
    for (let q = 0; q < quarters; q++) {
      if (this.state.outcome.ended) break;
      // Re-request every quarter of the batch: rigidity floors cap cuts per quarter,
      // so a deep cut only lands under sustained pressure. Reform/model/periphery
      // re-application is a no-op once the state matches the request.
      const result: TickResult = tick(this.state, decisions, this.ctx);
      this.state = result.state;
      this.tickIndex++;
      frames.push(this.project(this.state, result.events.map((e) => ({ id: e.id, note: e.note, count: e.count }))));
    }
    return { frames, state: this.state, log: this.state.log };
  }

  preview(decisions: Decisions): BudgetPreview {
    return previewBudget(this.state, decisions, this.ctx);
  }

  counterfactual(): HistoryFrame[] {
    const frames: HistoryFrame[] = [];
    let s = this.initial;
    for (let i = 0; i < this.tickIndex; i++) {
      if (s.outcome.ended) break;
      const r = tick(s, {}, this.ctx);
      s = r.state;
      frames.push(this.project(s, []));
    }
    return frames;
  }

  /** Current full state — for tests and the store's boot path. */
  current(): WorldState {
    return this.state;
  }

  private project(s: WorldState, events: HistoryFrame["events"]): HistoryFrame {
    const c = this.ctx.registry;
    const spend =
      totalSpend(s) + c.get("fiscal.non_ministry_spend_annual") + s.fiscal.debt_service + s.fiscal.periphery_spend;

    const funding_ratio = {} as Record<MinistryId, number>;
    for (const m of this.ctx.ministries) funding_ratio[m.id] = s.fiscal.ministries[m.id].funding_ratio;

    const sectors = {} as Record<SectorId, FrameSector>;
    for (const id of Object.keys(s.sectors) as SectorId[]) {
      const sec = s.sectors[id];
      sectors[id] = {
        population: sec.population,
        poverty_rate: sec.poverty_rate,
        grievance: sec.grievance,
        income_median: sec.income_median,
        approval: s.politics.approval_by_sector[id],
        participation_men: sec.labour_participation.men,
        participation_women: sec.labour_participation.women,
      };
    }

    const stockpiles = {} as Record<MunitionClass, number>;
    for (const m of MUNITIONS) stockpiles[m] = s.security.stockpiles[m];

    return {
      tickIndex: this.tickIndex,
      year: s.t.year,
      quarter: s.t.quarter,
      gdp_real: s.macro.gdp_real,
      gdp_potential: s.macro.gdp_potential,
      unemployment: s.macro.unemployment,
      inflation: s.macro.inflation,
      debt_gdp: s.macro.debt_gdp,
      bond_yield_10y: s.macro.bond_yield_10y,
      policy_rate: s.macro.policy_rate,
      credit_rating: s.macro.credit_rating,
      poverty_rate: s.macro.poverty_rate,
      participation: s.macro.participation,
      gini: s.macro.gini,
      shekel_usd: s.macro.shekel_usd,
      revenue_total: totalRevenue(s),
      spend_total: spend,
      deficit: s.fiscal.deficit,
      debt: s.fiscal.debt,
      debt_service: s.fiscal.debt_service,
      funding_ratio,
      readiness: s.security.force_readiness,
      deterrence: s.security.deterrence_index,
      mobilization: s.security.reserve_mobilization,
      war_casualties: s.security.war_casualties,
      quarters_of_supply: quartersOfSupply(s, c),
      stockpiles,
      fronts: s.security.active_fronts.map((f) => ({ id: f.id, intensity: f.intensity })),
      threat: { ...s.security.threat_level },
      stability: s.politics.coalition.stability,
      cohesion: s.politics.social_cohesion,
      trust: s.politics.institutional_trust,
      protest: s.politics.protest_intensity,
      civil_war_pressure: s.politics.civil_war_pressure,
      sectors,
      events,
      loc_population: Float64Array.from(s.localities.population),
      loc_employment: Float64Array.from(s.localities.employment),
      loc_service_access: Float64Array.from(s.localities.service_access),
      loc_migration: Float64Array.from(s.localities.migration_balance),
    };
  }
}
