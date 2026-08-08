/**
 * Lag kernels — parse a constant's lag_kernel string into per-quarter shares
 * (sum = 1). Horizon truncated at 80 quarters (20 years) per spec §7.3.
 */

export const KERNEL_HORIZON_QUARTERS = 80;

export function parseKernelShares(spec: string): number[] {
  if (spec === "immediate") return [1];

  const step = /^step\(k=(\d+)\)$/.exec(spec);
  if (step) {
    // All of the effect lands k years after origin.
    const q = Math.min(Number(step[1]) * 4, KERNEL_HORIZON_QUARTERS - 1);
    const shares = new Array<number>(q + 1).fill(0);
    shares[q] = 1;
    return shares;
  }

  const gamma = /^gamma\(shape=([\d.]+),\s*scale=([\d.]+)\)$/.exec(spec);
  if (gamma) {
    const shape = Number(gamma[1]);
    const scale = Number(gamma[2]);
    const raw: number[] = [];
    for (let q = 0; q < KERNEL_HORIZON_QUARTERS; q++) {
      const tYears = (q + 0.5) / 4;
      raw.push(Math.pow(tYears, shape - 1) * Math.exp(-tYears / scale));
    }
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map((v) => v / sum);
  }

  throw new Error(`unparseable lag_kernel "${spec}"`);
}
