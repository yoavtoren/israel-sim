/** Small shared primitives: panel, numbers, sparkline, gauges, dials, chips. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { INK, SEM } from "../lib/colors";

export function Panel(props: { title?: ReactNode; accent?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${props.className ?? ""}`}>
      {props.title !== undefined && (
        <header className="flex items-center gap-2.5 px-5 pt-4 pb-1 text-[17px] leading-[24px] font-medium">
          {props.accent !== undefined && (
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: props.accent }} />
          )}
          <span className="display">{props.title}</span>
        </header>
      )}
      <div className={props.title !== undefined ? "px-5 pt-2 pb-5" : "p-5"}>{props.children}</div>
    </section>
  );
}

/** Mono number that pulses in the semantic direction when it changes (DESIGN §5). */
export function Num(props: {
  value: string;
  className?: string;
  /** +1 when an increase is good, -1 when bad, 0 for neutral */ direction?: number;
  raw?: number;
  assumption?: boolean;
  title?: string;
}) {
  const prev = useRef<number | undefined>(props.raw);
  const [pulse, setPulse] = useState("");
  useEffect(() => {
    if (props.raw !== undefined && prev.current !== undefined && props.raw !== prev.current) {
      const dir = (props.direction ?? 0) * Math.sign(props.raw - prev.current);
      setPulse(dir > 0 ? "pulse-good" : dir < 0 ? "pulse-bad" : "");
      const id = setTimeout(() => setPulse(""), 300);
      prev.current = props.raw;
      return () => clearTimeout(id);
    }
    prev.current = props.raw;
    return undefined;
  }, [props.raw, props.direction]);
  return (
    <span className={`num ${pulse} ${props.assumption === true ? "assumption" : ""} ${props.className ?? ""}`} title={props.title}>
      {props.value}
    </span>
  );
}

/** Inline sparkline — always LTR (DESIGN §4). */
export function Sparkline(props: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  refLine?: number;
}) {
  const w = props.width ?? 96;
  const h = props.height ?? 20;
  const vs = props.values;
  if (vs.length < 2) return <svg width={w} height={h} />;
  let min = Math.min(...vs);
  let max = Math.max(...vs);
  if (props.refLine !== undefined) {
    min = Math.min(min, props.refLine);
    max = Math.max(max, props.refLine);
  }
  const span = max - min || 1;
  const pad = 2;
  const x = (i: number) => pad + (i / (vs.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - 2 * pad);
  const points = vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <bdi dir="ltr">
      <svg width={w} height={h} className="block">
        {props.refLine !== undefined && (
          <line x1={pad} x2={w - pad} y1={y(props.refLine)} y2={y(props.refLine)} stroke={INK.line1} strokeDasharray="2 3" strokeWidth={1} />
        )}
        <polyline points={points} fill="none" stroke={props.color ?? INK.fg1} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={max === min ? 0.3 : 1} strokeDasharray={max === min ? "2 3" : undefined} />
      </svg>
    </bdi>
  );
}

/** Horizontal gauge bar with an optional floor tick (rigidity / thresholds). */
export function GaugeBar(props: {
  /** 0–1 fill */ value: number;
  color: string;
  /** 0–1 tick position */ tick?: number;
  height?: number;
}) {
  const h = props.height ?? 8;
  const v = Math.max(0, Math.min(1, props.value));
  return (
    <bdi dir="ltr" className="block w-full">
      <div className="relative w-full overflow-hidden rounded-full bg-bg3" style={{ height: h }}>
        <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300" style={{ width: `${v * 100}%`, background: props.color }} />
        {props.tick !== undefined && (
          <div
            className="absolute inset-y-0 w-[2px]"
            style={{ left: `${Math.max(0, Math.min(1, props.tick)) * 100}%`, background: SEM.badBright, opacity: 0.8 }}
          />
        )}
      </div>
    </bdi>
  );
}

/** Instrument dial with a ghost needle for the earlier value (DESIGN screen 3). */
export function Dial(props: { value: number; ghost?: number; label: string; color: string; size?: number }) {
  const size = props.size ?? 120;
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const angle = (v: number) => Math.PI * (1 - Math.max(0, Math.min(1, v))); // 0 → 180°, 1 → 0°
  const needle = (v: number) => {
    const a = angle(v);
    return { x: cx + r * 0.82 * Math.cos(a), y: cy - r * 0.82 * Math.sin(a) };
  };
  const arc = (from: number, to: number) => {
    const a0 = angle(from);
    const a1 = angle(to);
    return `M ${cx + r * Math.cos(a0)} ${cy - r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)}`;
  };
  const n = needle(props.value);
  const g = props.ghost !== undefined ? needle(props.ghost) : null;
  return (
    <div className="flex flex-col items-center">
      <bdi dir="ltr">
        <svg width={size} height={size / 2 + 20}>
          <path d={arc(0, 1)} fill="none" stroke="#EBE6DC" strokeWidth={9} strokeLinecap="round" />
          <path d={arc(0.0001, Math.max(0.0001, props.value))} fill="none" stroke={props.color} strokeWidth={9} strokeLinecap="round" />
          {g !== null && <line x1={cx} y1={cy} x2={g.x} y2={g.y} stroke={INK.fg2} strokeWidth={1.5} strokeDasharray="3 2" />}
          <line x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={INK.fg0} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={3} fill={INK.fg0} />
        </svg>
      </bdi>
      <div className="num text-[24px] leading-[32px] font-medium">{(props.value * 100).toFixed(0)}%</div>
      <div className="text-[13px] leading-[18px] text-fg1">{props.label}</div>
    </div>
  );
}

export function Chip(props: { children: ReactNode; tone: "warn" | "bad" | "info" | "good" | "muted" }) {
  const tones: Record<string, string> = {
    warn: "bg-warn-dim text-warn-bright",
    bad: "bg-bad-dim text-bad-bright",
    info: "bg-info-dim text-info-bright",
    good: "bg-good-dim text-good-bright",
    muted: "bg-bg3 text-fg1",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] leading-[17px] font-medium ${tones[props.tone]}`}>
      {props.children}
    </span>
  );
}

export function TrendArrow(props: { delta: number; goodDir: 1 | -1 }) {
  if (Math.abs(props.delta) < 1e-9) return <span className="text-fg2">—</span>;
  const up = props.delta > 0;
  const good = Math.sign(props.delta) === props.goodDir;
  return (
    <span className={good ? "text-good-bright" : "text-bad-bright"}>
      {up ? "↑" : "↓"}
    </span>
  );
}
