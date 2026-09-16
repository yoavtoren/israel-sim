/** Prime Minister campaign: types. A campaign wraps a strategic
 *  SimulationState (metrics, track, crisis history — so the stances layer keeps
 *  working) and adds parties, the coalition, narrative flags, a dilemma queue
 *  and consequence popups. */

import type { CrisisPrecedent, CrisisGamble } from "../crisisEngine";
import type { ActorId } from "../stances";
import type { Bi, CrisisId, CrisisOptionId, GambleBranch, PolicyTrack, SimulationMetrics, SimulationState } from "../types";
import type { PartyId, PartyTag, SeatRoster } from "./parties";

type Deltas = Partial<SimulationMetrics>;

/** Where the map camera flies for a dilemma or a consequence. */
export type MapFocus =
  | "world" | "israel" | "gaza" | "west_bank" | "sinai" | "lebanon" | "iran" | "europe" | "usa" | "gulf" | "red_sea" | "jordan" | "theater";

export type SalvoSource = "egypt" | "gaza" | "hezbollah" | "iran" | "iraq" | "houthis" | "west_bank";
export type StrikeTarget = "gaza" | "lebanon" | "iran" | "yemen" | "sinai" | "west_bank";

/** What the tactical layer animates for a dilemma or a consequence. */
export type Visual =
  | { kind: "salvo"; from: SalvoSource; weapon: "ballistic" | "rocket" | "drone" | "cruise"; count: number }
  | { kind: "strike"; target: StrikeTarget; count: number }
  | { kind: "crisis"; crisisId: CrisisId; option: CrisisOptionId | null; branch: GambleBranch | null }
  | { kind: "protest" }
  | { kind: "nuclear" }
  | { kind: "ground"; target: "gaza" | "west_bank" | "lebanon" | "sinai" };

export type Severity = "good" | "info" | "warn" | "bad" | "critical";

/** How the government means to end the conflict (set by the doctrine). */
export type ResolutionPath = "regional" | "two_state" | "unilateral" | "sovereignty";

export interface Resolution {
  /** 0–100 toward an arrangement that ends the conflict */ progress: number;
  /** null: the doctrine offers no way to end the conflict */ path: ResolutionPath | null;
  /** milestone dilemmas completed, in order */ milestones: string[];
}

export interface ConsequenceDef {
  /** chance this follows (default 1) */ p?: number;
  headline: Bi;
  body: Bi;
  severity: Severity;
  focus: MapFocus;
  visual?: Visual;
  deltas?: Deltas;
  stance?: Partial<Record<ActorId, number>>;
  partners?: Partial<Record<PartyTag, number>>;
  flags?: Partial<CampaignFlags>;
  /** queue this dilemma next */ next?: string;
  /** progress toward resolving the conflict */ peace?: number;
}

export interface Ending {
  kind: EndingKind;
  headline: Bi;
  reason: Bi;
}

export type EndingKind = "CONFLICT_RESOLVED" | "GOVERNMENT_FELL" | "STATE_COLLAPSE_EXTERNAL" | "STATE_COLLAPSE_INTERNAL" | "TERM_COMPLETED";

export interface DilemmaOption {
  id: string;
  label: Bi;
  objective: Bi;
  pros: Bi[];
  cons: Bi[];
  deltas: Deltas;
  gamble?: CrisisGamble;
  partners?: Partial<Record<PartyTag, number>>;
  stance?: Partial<Record<ActorId, number>>;
  flags?: Partial<CampaignFlags>;
  consequences?: ConsequenceDef[];
  /** queue this dilemma next */ next?: string;
  /** set (or clear) the doctrine in force */ setTrack?: PolicyTrack | null;
  /** record a crisis option in the strategic history (stances read it) */ crisisOption?: CrisisOptionId;
  /** the choice itself ends the game */ ending?: Omit<Ending, "headline"> & { headline?: Bi };
  /** shown while choosing */ visual?: Visual;
  /** progress toward resolving the conflict */ peace?: number;
  /** progress by gamble outcome (instead of `peace`) */ peaceGamble?: { success: number; failure: number };
  /** completes this resolution milestone (only on success when there is a gamble) */ milestone?: string;
  /** success odds from the current situation (overrides gamble.p) */ odds?: (v: CampaignView) => number;
}

export interface CampaignView {
  step: number;
  metrics: SimulationMetrics;
  flags: CampaignFlags;
  track: PolicyTrack | null;
  coalitionTags: PartyTag[];
  resolution: Resolution;
}

export interface DilemmaDef {
  id: string;
  title: Bi;
  context: Bi;
  precedent?: CrisisPrecedent;
  focus: MapFocus;
  visual?: Visual;
  options: DilemmaOption[];
  /** eligibility weight (0 = not eligible) for the random pool; omitted = only via `next` */
  weight?: (v: CampaignView) => number;
  cooldown?: number;
  once?: boolean;
  crisisId?: CrisisId;
  /** a step on the path to resolving the conflict */ milestone?: { path: ResolutionPath; index: number; of: number };
}

export interface CampaignFlags {
  gazaOccupied: boolean;
  gazaSiege: boolean;
  emigrationProgram: boolean;
  transferOrdered: boolean;
  indiscriminateBombing: boolean;
  nuclearUsed: boolean;
  annexationLaw: boolean;
  paDismantled: boolean;
  paAlone: boolean;
  trusteeshipTalks: boolean;
  saudiDeal: boolean;
  settlementFreeze: boolean;
  withdrawal: boolean;
  unForce: boolean;
  euSanctions: boolean;
  iccWarrants: boolean;
  usArmsHold: boolean;
  lebanonWar: boolean;
  redSeaBlockade: boolean;
  massProtests: boolean;
  reservistRefusal: boolean;
  emergencyRule: boolean;
  downgraded: boolean;
}

export type CampaignPhase = "party" | "coalition" | "policy" | "dilemma" | "consequences" | "ended";

export interface ConsequenceEvent {
  id: string;
  step: number;
  headline: Bi;
  body: Bi;
  severity: Severity;
  focus: MapFocus;
  visual: Visual | null;
  /** metric deltas actually applied (for the popup chips) */ deltas: Deltas;
  stance: Partial<Record<ActorId, number>>;
  /** progress toward resolution this event carried */ peace?: number;
  /** parties that left, or threaten to */ quits: PartyId[];
  threats: PartyId[];
}

export interface CampaignLogEntry {
  step: number;
  severity: Severity;
  text: Bi;
}

export interface CampaignState {
  phase: CampaignPhase;
  seed: string;
  rngState: number;
  /** which seat numbers the Knesset uses */ roster: SeatRoster;
  party: PartyId | null;
  coalition: PartyId[];
  /** 0–100 per coalition partner (the PM's own party is not tracked) */ patience: Partial<Record<PartyId, number>>;
  departed: PartyId[];
  sim: SimulationState;
  step: number;
  maxSteps: number;
  flags: CampaignFlags;
  resolution: Resolution;
  /** campaign-only relation shifts on top of the stances model */ stanceShift: Partial<Record<ActorId, number>>;
  current: string | null;
  forced: string[];
  lastSeen: Record<string, number>;
  /** consequences still to be shown, in order */ queue: ConsequenceEvent[];
  /** the consequences of the most recent choice (for replay/log) */ lastConsequences: ConsequenceEvent[];
  log: CampaignLogEntry[];
  choices: Array<{ step: number; dilemma: string; option: string; branch: GambleBranch | null }>;
  ending: Ending | null;
}
