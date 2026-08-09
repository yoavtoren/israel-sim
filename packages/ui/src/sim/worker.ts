/** Web Worker entry: the engine lives here, off the UI thread (PLAN §12). */

import { expose } from "comlink";
import type { BudgetPreview, Decisions } from "@engine";
import { SimCore } from "./core";
import type { AdvancePayload, HistoryFrame, InitPayload, SimApi } from "./types";

let core = new SimCore();

const api: SimApi = {
  init(seed: string): InitPayload {
    core = new SimCore(seed);
    return core.init(seed);
  },
  advance(quarters: number, decisions: Decisions): AdvancePayload {
    return core.advance(quarters, decisions);
  },
  preview(decisions: Decisions): BudgetPreview {
    return core.preview(decisions);
  },
  counterfactual(): HistoryFrame[] {
    return core.counterfactual();
  },
};

expose(api);
