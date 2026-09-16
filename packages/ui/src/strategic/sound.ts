/** Synthesized audio cues (Web Audio, no asset files). Off by default. */

import type { MarkerKind } from "./scenarios";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;
  if (ctx === null) ctx = new window.AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, sweepTo?: number): void {
  const a = audio();
  if (a === null) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(sweepTo, a.currentTime + dur);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  osc.connect(g).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + dur);
}

function noiseBurst(dur: number, gain: number, lowpass: number): void {
  const a = audio();
  if (a === null) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = lowpass;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sound = {
  /** must be called from a user gesture once, so browsers allow playback */
  unlock(): void {
    audio();
  },
  alert(): void {
    tone(640, 0.45, "sawtooth", 0.05, 900);
    setTimeout(() => tone(900, 0.45, "sawtooth", 0.05, 640), 450);
  },
  launch(): void {
    tone(220, 0.25, "square", 0.03, 440);
  },
  intercept(): void {
    noiseBurst(0.18, 0.25, 3000);
    tone(1400, 0.08, "sine", 0.04);
  },
  impact(): void {
    noiseBurst(0.6, 0.5, 400);
    tone(70, 0.6, "sine", 0.2, 35);
  },
  /** low-frequency crisis alert: two descending sub-bass pulses over a soft bell */
  crisisChime(): void {
    tone(98, 1.1, "sine", 0.35, 82);
    tone(196, 0.9, "triangle", 0.06, 164);
    setTimeout(() => tone(82, 1.3, "sine", 0.35, 65), 650);
    setTimeout(() => tone(392, 1.4, "sine", 0.03), 650);
  },
  decision(): void {
    tone(520, 0.12, "triangle", 0.06);
    setTimeout(() => tone(390, 0.25, "triangle", 0.06), 130);
  },
  forMarker(kind: MarkerKind): void {
    if (kind === "alert" || kind === "mobilize") this.alert();
    else if (kind === "launch" || kind === "strike") this.launch();
    else if (kind === "intercept") this.intercept();
    else if (kind === "impact") this.impact();
    else if (kind === "halt") this.crisisChime();
    else if (kind === "crisis" || kind === "failure") this.alert();
    else if (kind === "success" || kind === "ceasefire") this.decision();
  },
};
