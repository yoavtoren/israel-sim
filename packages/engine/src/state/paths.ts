/**
 * StatePath — single addressing scheme for ministry outputs, pipeline effects,
 * event effects and the causal log. Dot paths, e.g. "infrastructure.teachers"
 * or "security.stockpiles.interceptors". A path must resolve to a number.
 */

import type { WorldState } from "./types";

function resolveParent(state: WorldState, path: string): { parent: Record<string, number>; key: string } {
  const parts = path.split(".");
  if (parts.length < 2) throw new Error(`StatePath too short: "${path}"`);
  let node: unknown = state;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof node !== "object" || node === null) throw new Error(`StatePath "${path}" broken at "${parts[i]}"`);
    node = (node as Record<string, unknown>)[parts[i]];
  }
  const key = parts[parts.length - 1];
  if (typeof node !== "object" || node === null) throw new Error(`StatePath "${path}" has no parent object`);
  const val = (node as Record<string, unknown>)[key];
  if (typeof val !== "number") throw new Error(`StatePath "${path}" does not resolve to a number`);
  return { parent: node as Record<string, number>, key };
}

export function getPath(state: WorldState, path: string): number {
  const { parent, key } = resolveParent(state, path);
  return parent[key];
}

/** Mutates the (working-copy) state. Only tick internals may call this. */
export function addPath(state: WorldState, path: string, delta: number): number {
  const { parent, key } = resolveParent(state, path);
  parent[key] += delta;
  return parent[key];
}

export function setPath(state: WorldState, path: string, value: number): void {
  const { parent, key } = resolveParent(state, path);
  parent[key] = value;
}
