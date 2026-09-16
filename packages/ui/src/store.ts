/** App state: run history, budget draft, shadow-tick preview (Zustand, PLAN §12). */

import { create } from "zustand";
import type { BudgetPreview, Decisions, EconomicModelId, MinistryId, TickLogEntry, WorldState } from "@engine";
import { sim } from "./sim/client";
import type { HistoryFrame, RunMeta } from "./sim/types";
import type { Lang } from "./lib/strings";

export type Screen =
  | "alliances" | "cabinet" | "tactical" | "overview" | "budget" | "map" | "security" | "pipeline" | "sectors" | "reforms" | "history" | "postmortem";

export interface FeedItem {
  tickIndex: number;
  year: number;
  quarter: number;
  id: string;
  note: string;
  count: number;
}

export interface Draft {
  budgets: Partial<Record<MinistryId, number>>;
  reforms: Record<string, "enact" | "repeal">;
  economic_model: EconomicModelId | null;
  periphery: { annual_budget: number; target_clusters: number[] } | null;
}

const EMPTY_DRAFT: Draft = { budgets: {}, reforms: {}, economic_model: null, periphery: null };

export function draftToDecisions(d: Draft): Decisions {
  const out: Decisions = {};
  if (Object.keys(d.budgets).length > 0) out.budgets = { ...d.budgets };
  if (Object.keys(d.reforms).length > 0) out.reforms = { ...d.reforms };
  if (d.economic_model !== null) out.economic_model = d.economic_model;
  if (d.periphery !== null) out.periphery = { ...d.periphery, target_clusters: [...d.periphery.target_clusters] };
  return out;
}

export function draftIsEmpty(d: Draft): boolean {
  return Object.keys(draftToDecisions(d)).length === 0;
}

interface UIStore {
  booted: boolean;
  busy: boolean;
  seed: string;
  lang: Lang;
  screen: Screen;
  meta: RunMeta | null;
  state: WorldState | null;
  frames: HistoryFrame[];
  log: TickLogEntry[];
  feed: FeedItem[];
  draft: Draft;
  preview: BudgetPreview | null;
  previewBusy: boolean;
  counterfactual: HistoryFrame[] | null;

  boot(seed?: string): Promise<void>;
  advance(quarters: number): Promise<void>;
  setBudgetDraft(id: MinistryId, value: number | null): void;
  setReformDraft(id: string, action: "enact" | "repeal" | null): void;
  setModelDraft(model: EconomicModelId | null): void;
  setPeripheryDraft(p: Draft["periphery"]): void;
  clearDraft(): void;
  setScreen(s: Screen): void;
  setLang(l: Lang): void;
}

let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewToken = 0;

function schedulePreview(get: () => UIStore, set: (p: Partial<UIStore>) => void): void {
  if (previewTimer !== null) clearTimeout(previewTimer);
  const token = ++previewToken;
  const d = draftToDecisions(get().draft);
  if (Object.keys(d).length === 0) {
    set({ preview: null, previewBusy: false });
    return;
  }
  set({ previewBusy: true });
  previewTimer = setTimeout(() => {
    void (async () => {
      const p = await sim().preview(d);
      if (token === previewToken) set({ preview: p, previewBusy: false });
    })();
  }, 250);
}

export const useStore = create<UIStore>((set, get) => ({
  booted: false,
  busy: false,
  seed: "situation-room",
  lang: "he",
  screen: "alliances",
  meta: null,
  state: null,
  frames: [],
  log: [],
  feed: [],
  draft: EMPTY_DRAFT,
  preview: null,
  previewBusy: false,
  counterfactual: null,

  async boot(seed?: string) {
    const s = seed ?? get().seed;
    set({ busy: true });
    const init = await sim().init(s);
    set({
      booted: true,
      busy: false,
      seed: s,
      meta: init.meta,
      state: init.state,
      frames: [init.frame],
      log: [],
      feed: [],
      draft: EMPTY_DRAFT,
      preview: null,
      counterfactual: null,
      screen: get().screen === "postmortem" ? "overview" : get().screen,
    });
  },

  async advance(quarters: number) {
    if (get().busy || get().state?.outcome.ended) return;
    set({ busy: true });
    const decisions = draftToDecisions(get().draft);
    const r = await sim().advance(quarters, decisions);
    const newFeed: FeedItem[] = [];
    for (const f of r.frames) {
      for (const e of f.events) {
        newFeed.push({ tickIndex: f.tickIndex, year: f.year, quarter: f.quarter, id: e.id, note: e.note, count: e.count });
      }
    }
    const ended = r.state.outcome.ended;
    set({
      busy: false,
      state: r.state,
      frames: [...get().frames, ...r.frames],
      log: r.log,
      feed: [...get().feed, ...newFeed].slice(-400),
      draft: EMPTY_DRAFT,
      preview: null,
    });
    if (ended) {
      set({ busy: true, screen: "postmortem" });
      const cf = await sim().counterfactual();
      set({ busy: false, counterfactual: cf });
    }
  },

  setBudgetDraft(id, value) {
    const budgets = { ...get().draft.budgets };
    if (value === null) delete budgets[id];
    else budgets[id] = value;
    set({ draft: { ...get().draft, budgets } });
    schedulePreview(get, set);
  },

  setReformDraft(id, action) {
    const reforms = { ...get().draft.reforms };
    if (action === null) delete reforms[id];
    else reforms[id] = action;
    set({ draft: { ...get().draft, reforms } });
    schedulePreview(get, set);
  },

  setModelDraft(model) {
    set({ draft: { ...get().draft, economic_model: model } });
    schedulePreview(get, set);
  },

  setPeripheryDraft(p) {
    set({ draft: { ...get().draft, periphery: p } });
    schedulePreview(get, set);
  },

  clearDraft() {
    set({ draft: EMPTY_DRAFT, preview: null });
  },

  setScreen(s) {
    set({ screen: s });
  },

  setLang(l) {
    set({ lang: l });
    document.documentElement.setAttribute("dir", l === "he" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", l);
  },
}));
