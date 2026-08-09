/** Main-thread handle to the engine worker. */

import { wrap, type Remote } from "comlink";
import type { SimApi } from "./types";

let remote: Remote<SimApi> | null = null;

export function sim(): Remote<SimApi> {
  if (remote === null) {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    remote = wrap<SimApi>(worker);
  }
  return remote;
}
