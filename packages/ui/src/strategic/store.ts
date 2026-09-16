/** Strategic cabinet + tactical playback state (Zustand). The strategic
 *  reducer is cheap and pure, so it runs on the main thread. */

import { create } from "zustand";
import { strategic } from "@engine";
import { buildTurnScript, type TacticalScript } from "./scenarios";
import { buildCrisisScript } from "./crisisScripts";
import { sound } from "./sound";
import type { FocusId } from "./geo";

/** simulated seconds per real second at 1× */
export const SIM_RATE = 20;
export const SPEEDS = [0.5, 1, 2, 5] as const;
export type CameraMode = "auto" | FocusId;

function defaultAction(track: strategic.PolicyTrack): strategic.PolicyAction {
  return { track, ...strategic.TRACK_DEFS[track].defaults };
}

interface StrategicStore {
  sim: strategic.SimulationState;
  /** state before the last decision / crisis resolution (for stance trends) */ prevSim: strategic.SimulationState | null;
  draft: strategic.PolicyAction;
  script: TacticalScript;
  /** simulated seconds into the script */ t: number;
  playing: boolean;
  speed: number;
  soundOn: boolean;
  modalOpen: boolean;
  cameraMode: CameraMode;
  trackedId: string | null;

  newTerm(coalition: strategic.CoalitionType, seed?: string): void;
  pickTrack(track: strategic.PolicyTrack): void;
  setDraft(patch: Partial<strategic.PolicyAction>): void;
  /** returns true when the decision opened a crisis */ decide(): boolean;
  resolve(option: strategic.CrisisOptionId): void;
  setT(t: number): void;
  setPlaying(p: boolean): void;
  setSpeed(s: number): void;
  setSound(on: boolean): void;
  setModalOpen(open: boolean): void;
  setCameraMode(m: CameraMode): void;
  setTracked(id: string | null): void;
}

function freshSeed(): string {
  return `term-${Date.now().toString(36)}`;
}

const initialSim = strategic.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", "term-1");

export const useStrategic = create<StrategicStore>((set, get) => ({
  sim: initialSim,
  prevSim: null,
  draft: defaultAction("PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP"),
  script: buildTurnScript(initialSim),
  t: 0,
  playing: false,
  speed: 1,
  soundOn: true,
  modalOpen: false,
  cameraMode: "auto",
  trackedId: null,

  newTerm(coalition, seed) {
    const sim = strategic.createInitialState(coalition, seed ?? freshSeed());
    set({ sim, prevSim: null, script: buildTurnScript(sim), t: 0, playing: false, modalOpen: false, trackedId: null, draft: defaultAction(get().draft.track) });
  },

  pickTrack(track) {
    set({ draft: defaultAction(track) });
  },

  setDraft(patch) {
    set({ draft: { ...get().draft, ...patch } });
  },

  decide() {
    sound.unlock(); // called from the Decide click — lets the crisis chime play
    const { sim, draft } = get();
    const next = strategic.executePolicyDecision(sim, draft);
    if (next === sim) return false;
    if (next.pendingCrisis !== null) {
      set({ sim: next, prevSim: sim, script: buildCrisisScript(next, null), t: 0, playing: true, modalOpen: false, cameraMode: "auto", trackedId: null });
      return true;
    }
    set({ sim: next, prevSim: sim, script: buildTurnScript(next), t: 0, playing: false, modalOpen: false, cameraMode: "auto", trackedId: null });
    return false;
  },

  resolve(option) {
    const { sim, t } = get();
    if (sim.pendingCrisis === null) return;
    const next = strategic.resolveCrisis(sim, option);
    const branch = next.turns[next.turns.length - 1]?.crisisBranch ?? null;
    // keyed on the pending state, so the pre-halt picture is unchanged and playback continues from the halt
    const script = buildCrisisScript(sim, option, branch);
    set({ sim: next, prevSim: sim, script, t: Math.max(t, 0), playing: true, modalOpen: false, trackedId: null });
  },

  setT(t) {
    const { script, sim } = get();
    let v = Math.max(0, Math.min(script.duration, t));
    if (script.haltAt !== null && sim.pendingCrisis !== null) v = Math.min(v, script.haltAt);
    set({ t: v });
  },
  setPlaying(playing) {
    const { t, script } = get();
    // replay from the start when pressing play at the end
    if (playing && t >= script.duration) set({ t: 0 });
    set({ playing });
  },
  setSpeed(speed) {
    set({ speed });
  },
  setSound(soundOn) {
    set({ soundOn });
  },
  setModalOpen(modalOpen) {
    set({ modalOpen, playing: modalOpen ? false : get().playing });
  },
  setCameraMode(cameraMode) {
    set({ cameraMode });
  },
  setTracked(trackedId) {
    set({ trackedId });
  },
}));

// Dev-only QA hook: lets a headless browser open any crisis directly. Stripped from production builds.
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__tactical = { useStrategic, buildCrisisScript, strategic };
}
