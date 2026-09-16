/** Prime Minister campaign store. Owns the CampaignState; mirrors its strategic
 *  SimulationState into useStrategic (so the alliance and tactical screens
 *  follow the game) and drives the map animation for whatever is on screen. */

import { create } from "zustand";
import { strategic } from "@engine";
import { useStrategic } from "./store";
import { visualScript } from "./visuals";
import { buildTurnScript } from "./scenarios";
import { sound } from "./sound";

type Campaign = strategic.CampaignState;

interface CampaignStore {
  game: Campaign;
  /** coalition being assembled (includes the PM's party) */ draft: strategic.PartyId[];
  newGame(): void;
  setRoster(r: strategic.SeatRoster): void;
  pickParty(p: strategic.PartyId): void;
  /** replace the draft with a reference coalition (keeps the PM's party) */ loadCoalition(members: strategic.PartyId[]): void;
  backToParties(): void;
  toggleMember(p: strategic.PartyId): void;
  formGovernment(): void;
  choose(optionId: string): void;
  acknowledge(): void;
}

function freshSeed(): string {
  return `pm-${Date.now().toString(36)}`;
}

/** Put the right animation on the map for the current screen of the game. */
function stage(game: Campaign): void {
  const head = game.phase === "consequences" ? game.queue[0] : undefined;
  const dilemma = game.phase === "dilemma" || game.phase === "policy" ? strategic.currentDilemma(game) : null;
  const visual = head?.visual ?? dilemma?.visual ?? null;
  const key = head !== undefined ? `${game.seed}:${head.id}` : `${game.seed}:${game.step}:${dilemma?.id ?? "-"}`;
  const st = useStrategic.getState();
  if (visual !== null) {
    const script = visualScript(visual, key, game.step + 1);
    if (st.script.key !== script.key) useStrategic.setState({ script, t: 0, playing: true, modalOpen: false, trackedId: null });
  } else if (st.script.launches.length > 0 && !st.playing) {
    // keep the last picture on screen until something new happens
  }
}

function sync(game: Campaign, prev: Campaign | null): void {
  useStrategic.setState({ sim: game.sim, prevSim: prev?.sim ?? null });
  stage(game);
}

const first = strategic.createCampaign(freshSeed());

export const useCampaign = create<CampaignStore>((set, get) => ({
  game: first,
  draft: [],

  newGame() {
    const game = strategic.createCampaign(freshSeed(), get().game.roster);
    useStrategic.setState({ script: buildTurnScript(game.sim), t: 0, playing: false });
    sync(game, null);
    set({ game, draft: [] });
  },

  setRoster(r) {
    set({ game: strategic.setRoster(get().game, r) });
  },

  loadCoalition(members) {
    const { game } = get();
    if (game.party === null) return;
    set({ draft: [...new Set([game.party, ...members.filter((m) => strategic.SEATS[game.roster][m] > 0)])] });
  },

  pickParty(p) {
    sound.unlock();
    const prev = get().game;
    const game = strategic.chooseParty(prev, p);
    if (game === prev) return;
    set({ game, draft: [p] });
  },

  backToParties() {
    set({ game: { ...get().game, phase: "party", party: null, coalition: [] }, draft: [] });
  },

  toggleMember(p) {
    const { draft, game } = get();
    if (p === game.party) return;
    set({ draft: draft.includes(p) ? draft.filter((x) => x !== p) : [...draft, p] });
  },

  formGovernment() {
    const prev = get().game;
    const game = strategic.formGovernment(prev, get().draft);
    if (game === prev) return;
    sync(game, prev);
    set({ game });
  },

  choose(optionId) {
    sound.unlock();
    const prev = get().game;
    const game = strategic.choose(prev, optionId);
    if (game === prev) return;
    const head = game.queue[0];
    if (head !== undefined && useStrategic.getState().soundOn) {
      if (head.severity === "critical") sound.crisisChime();
      else if (head.severity === "bad") sound.alert();
    }
    sync(game, prev);
    set({ game });
  },

  acknowledge() {
    const prev = get().game;
    const game = strategic.acknowledge(prev);
    const head = game.queue[0];
    if (head !== undefined && head !== prev.queue[0] && useStrategic.getState().soundOn) {
      if (head.severity === "critical") sound.crisisChime();
      else if (head.severity === "bad") sound.alert();
    }
    if (game.phase === "dilemma" && strategic.currentDilemma(game)?.crisisId !== undefined && useStrategic.getState().soundOn) sound.crisisChime();
    sync(game, prev);
    set({ game });
  },
}));

sync(first, null);

// Dev-only QA hook: lets a headless browser put the campaign into any state. Stripped from production builds.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__campaign = { useCampaign };
}
