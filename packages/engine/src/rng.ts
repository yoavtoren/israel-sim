/**
 * Deterministic PRNG. String seed -> xmur3 hash -> sfc32 stream.
 * Streams are forked per (seed, tick, module-name) so adding draws in one
 * module never shifts the sequence of another module or another tick.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Standard normal via Box-Muller. */
  normal(): number;
}

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const u = (t + d) | 0;
    c = (c + u) | 0;
    return (u >>> 0) / 4294967296;
  };
}

export function streamRng(seedKey: string): Rng {
  const seed = xmur3(seedKey);
  const raw = sfc32(seed(), seed(), seed(), seed());
  for (let i = 0; i < 12; i++) raw(); // warm up
  let spare: number | null = null;
  return {
    next: raw,
    normal(): number {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0;
      while (u === 0) u = raw();
      const v = raw();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    },
  };
}

/** Per-tick stream factory: fork("macro") is stable regardless of other modules. */
export type StreamFactory = (name: string) => Rng;

export function makeTickStreams(seed: string, tickKey: string): StreamFactory {
  const cache = new Map<string, Rng>();
  return (name: string): Rng => {
    let s = cache.get(name);
    if (s === undefined) {
      s = streamRng(`${seed}|${tickKey}|${name}`);
      cache.set(name, s);
    }
    return s;
  };
}
