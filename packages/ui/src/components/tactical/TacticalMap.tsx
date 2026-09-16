/** Tactical map: SVG base layer (schematic regional outlines, graticule,
 *  Suez canal) + a Canvas layer for everything that moves — cubic-Bezier
 *  trajectories, interceptor arcs, shockwaves, defense envelopes, unit
 *  symbols, pulsing warning rings. One camera drives both layers. */

import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store";
import { useStrategic } from "../../strategic/store";
import {
  BATTERIES, CITIES, ORIGINS, REGIONS, SUEZ_CANAL,
  focusCamera, kmToUnits, project, toMap, toScreen,
  type Camera, type Pt, type Region,
} from "../../strategic/geo";
import {
  FACTION_COLORS, INTERCEPTOR_COLOR, bezierAt, bezierControls, endTime, focusAt, progressAt,
  type Launch, type TacticalScript, type UnitMove,
} from "../../strategic/scenarios";

const KIND_ORDER: Record<Region["kind"], number> = { distant: 0, neighbor: 1, own: 2, territory: 3 };
const REGION_STYLE: Record<Region["kind"], { fill: string; stroke: string; dash?: string }> = {
  distant: { fill: "#121925", stroke: "#2A3444" },
  neighbor: { fill: "#161F2C", stroke: "#3A4658" },
  own: { fill: "#1A2B42", stroke: "#3B82D0" },
  territory: { fill: "#212C3B", stroke: "#93A4B5", dash: "3 3" },
};

type Ctrl = [Pt, Pt, Pt, Pt];

function ringPath(ring: Array<[number, number]>): string {
  return ring.map((p, i) => {
    const q = project(p);
    return `${i === 0 ? "M" : "L"}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }).join(" ") + " Z";
}

function linePath(line: Array<[number, number]>): string {
  return line.map((p, i) => {
    const q = project(p);
    return `${i === 0 ? "M" : "L"}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }).join(" ");
}

function lerpCam(a: Camera, b: Camera, k: number): Camera {
  return {
    cx: a.cx + (b.cx - a.cx) * k,
    cy: a.cy + (b.cy - a.cy) * k,
    scale: Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * k),
  };
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** a unit is superseded when a follow-on move (id prefix) starts */
function unitVisibleUntil(u: UnitMove, all: UnitMove[]): number {
  let until = Infinity;
  for (const o of all) if (o !== u && o.id.startsWith(`${u.id}-`)) until = Math.min(until, o.t0);
  return until;
}

function unitPos(u: UnitMove, t: number): [number, number] {
  const k = Math.max(0, Math.min(1, (t - u.t0) / (u.t1 - u.t0)));
  const e = k * k * (3 - 2 * k);
  return [u.from[0] + (u.to[0] - u.from[0]) * e, u.from[1] + (u.to[1] - u.from[1]) * e];
}

interface Hover {
  x: number;
  y: number;
  text: string[];
}

export function TacticalMap() {
  const lang = useStore((s) => s.lang);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const sizeRef = useRef(size);
  const camRef = useRef<Camera | null>(null);
  const manualRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number; cam: Camera } | null>(null);
  const ctrlCache = useRef<{ key: string; map: Map<string, Ctrl> }>({ key: "", map: new Map() });
  const langRef = useRef(lang);
  const [hover, setHover] = useState<Hover | null>(null);
  const cameraMode = useStrategic((s) => s.cameraMode);

  langRef.current = lang;

  useEffect(() => {
    manualRef.current = false;
  }, [cameraMode]);

  // size tracking
  useEffect(() => {
    const el = wrapRef.current;
    if (el === null) return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const s = { w: Math.max(200, r.width), h: Math.max(200, r.height) };
      sizeRef.current = s;
      setSize(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // render loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const ctrlFor = (script: TacticalScript, l: Launch): Ctrl => {
      const cache = ctrlCache.current;
      if (cache.key !== script.key) {
        cache.key = script.key;
        cache.map = new Map();
      }
      let c = cache.map.get(l.id);
      if (c === undefined) {
        c = bezierControls(l);
        cache.map.set(l.id, c);
      }
      return c;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { w, h } = sizeRef.current;
      const st = useStrategic.getState();
      const { script, t, trackedId } = st;
      const L = langRef.current;

      // camera
      const target = focusCamera(st.cameraMode === "auto" ? focusAt(script, t) : st.cameraMode, w, h);
      if (camRef.current === null) camRef.current = target;
      if (!manualRef.current) camRef.current = lerpCam(camRef.current, target, 1 - Math.exp(-dt * 2.5));
      const cam = camRef.current;
      gRef.current?.setAttribute("transform", `translate(${w / 2 - cam.cx * cam.scale} ${h / 2 - cam.cy * cam.scale}) scale(${cam.scale})`);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d") ?? null;
      if (canvas !== null && ctx !== null) {
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const S = (p: Pt) => toScreen(p, cam, w, h);
        const pulse = 0.5 + 0.5 * Math.sin(now / 260);
        const pxPerKm = kmToUnits(1) * cam.scale;

        const active = script.launches.filter((l) => t >= l.t0 && t < endTime(l));
        const engaged = new Set(active.filter((l) => l.intercept !== null && t >= l.intercept.tLaunch).map((l) => l.intercept?.battery));

        // defense envelopes
        for (const b of Object.values(BATTERIES)) {
          const c = S(project(b.pos));
          const r = b.radiusKm * pxPerKm;
          const hot = engaged.has(b.id);
          if (b.outer) {
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = withAlpha(INTERCEPTOR_COLOR, hot ? 0.35 + 0.3 * pulse : 0.22);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
            g.addColorStop(0, withAlpha(INTERCEPTOR_COLOR, hot ? 0.16 : 0.07));
            g.addColorStop(1, withAlpha(INTERCEPTOR_COLOR, 0.01));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = withAlpha(INTERCEPTOR_COLOR, hot ? 0.45 + 0.4 * pulse : 0.25);
            ctx.lineWidth = hot ? 1.5 : 1;
            ctx.stroke();
          }
          ctx.fillStyle = INTERCEPTOR_COLOR;
          ctx.fillRect(c.x - 2.5, c.y - 2.5, 5, 5);
        }

        // zones
        for (const z of script.zones) {
          if (t < z.t0 || t > z.t1) continue;
          const pts = z.path.map((p) => S(project(p)));
          ctx.beginPath();
          pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          if (z.kind === "border_alert") {
            ctx.strokeStyle = withAlpha(z.color, 0.25 + 0.55 * pulse);
            ctx.lineWidth = 3 + 3 * pulse;
            ctx.shadowColor = z.color;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
          } else {
            ctx.closePath();
            ctx.fillStyle = withAlpha(z.color, 0.1 + 0.12 * pulse);
            ctx.fill();
            ctx.save();
            ctx.clip();
            ctx.strokeStyle = withAlpha(z.color, 0.35);
            ctx.lineWidth = 1;
            const minX = Math.min(...pts.map((p) => p.x));
            const maxX = Math.max(...pts.map((p) => p.x));
            const minY = Math.min(...pts.map((p) => p.y));
            const maxY = Math.max(...pts.map((p) => p.y));
            for (let x = minX - (maxY - minY); x < maxX; x += 7) {
              ctx.beginPath();
              ctx.moveTo(x, maxY);
              ctx.lineTo(x + (maxY - minY), minY);
              ctx.stroke();
            }
            ctx.restore();
          }
        }

        // warning rings on threatened cities
        for (const city of Object.values(CITIES)) {
          const threatened = active.some((l) => l.faction !== "idf" && l.targetName.en === city.name.en);
          const c = S(project(city.pos));
          if (threatened) {
            for (let i = 0; i < 3; i++) {
              const ph = ((now / 1400) + i / 3) % 1;
              ctx.strokeStyle = withAlpha("#F85149", 0.7 * (1 - ph));
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(c.x, c.y, 6 + ph * 26, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }

        // units
        for (const u of script.units) {
          if (t < u.t0 || t >= unitVisibleUntil(u, script.units)) continue;
          const c = S(project(unitPos(u, t)));
          const col = FACTION_COLORS[u.faction];
          const moving = t < u.t1;
          ctx.fillStyle = "rgba(10,14,20,0.85)";
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.5;
          ctx.fillRect(c.x - 12, c.y - 8, 24, 16);
          ctx.strokeRect(c.x - 12, c.y - 8, 24, 16);
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, 7, 4, 0, 0, Math.PI * 2);
          ctx.moveTo(c.x - 12, c.y - 8);
          ctx.lineTo(c.x + 12, c.y + 8);
          ctx.moveTo(c.x + 12, c.y - 8);
          ctx.lineTo(c.x - 12, c.y + 8);
          ctx.stroke();
          if (moving) {
            const d = S(project(u.to));
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = withAlpha(col, 0.45);
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(d.x, d.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          if (cam.scale > 1.2) {
            ctx.font = "10px Heebo, system-ui, sans-serif";
            ctx.fillStyle = withAlpha(col, 0.9);
            ctx.textAlign = "center";
            ctx.fillText(u.label[L], c.x, c.y + 20);
          }
        }

        // launches: trails, interceptors, bursts, impacts
        for (const l of script.launches) {
          if (t < l.t0) continue;
          const ctrl = ctrlFor(script, l);
          const col = FACTION_COLORS[l.faction];
          const end = endTime(l);
          const intercepted = l.intercept !== null && l.intercept.success;

          if (t < end) {
            const u = progressAt(l, t);
            const u0 = Math.max(0, u - (l.kind === "drone" ? 0.08 : 0.2));
            const n = 18;
            let prev = S(bezierAt(ctrl, u0));
            for (let i = 1; i <= n; i++) {
              const p = S(bezierAt(ctrl, u0 + ((u - u0) * i) / n));
              ctx.strokeStyle = withAlpha(col, (i / n) * 0.9);
              ctx.lineWidth = l.kind === "ballistic" ? 2.2 : 1.6;
              if (l.kind === "drone") ctx.setLineDash([2, 3]);
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              ctx.setLineDash([]);
              prev = p;
            }
            ctx.shadowColor = col;
            ctx.shadowBlur = 10;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(prev.x, prev.y, l.kind === "ballistic" ? 2.8 : 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            if (trackedId === l.id) {
              ctx.strokeStyle = "#E6EDF3";
              ctx.lineWidth = 1;
              ctx.strokeRect(prev.x - 9, prev.y - 9, 18, 18);
              ctx.setLineDash([2, 4]);
              ctx.strokeStyle = withAlpha(col, 0.35);
              ctx.beginPath();
              for (let i = 0; i <= 24; i++) {
                const p = S(bezierAt(ctrl, u + ((1 - u) * i) / 24));
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
              }
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }

          // interceptor
          const ic = l.intercept;
          if (ic !== null && t >= ic.tLaunch && t < ic.tHit + 0.5) {
            const hit = bezierAt(ctrl, ic.u);
            const bp = project(BATTERIES[ic.battery].pos);
            const ictrl: Ctrl = [
              bp,
              { x: bp.x + (hit.x - bp.x) * 0.3, y: Math.min(bp.y, hit.y) - 18 },
              { x: bp.x + (hit.x - bp.x) * 0.8, y: hit.y - 8 },
              hit,
            ];
            const v = Math.max(0, Math.min(1, (t - ic.tLaunch) / Math.max(0.01, ic.tHit - ic.tLaunch)));
            const v0 = Math.max(0, v - 0.35);
            ctx.strokeStyle = withAlpha(INTERCEPTOR_COLOR, 0.85);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            for (let i = 0; i <= 12; i++) {
              const p = S(bezierAt(ictrl, v0 + ((v - v0) * i) / 12));
              if (i === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
          }

          // kill burst
          if (ic !== null && t >= ic.tHit && t < ic.tHit + 14) {
            const k = (t - ic.tHit) / 14;
            const c = S(bezierAt(ctrl, ic.u));
            ctx.fillStyle = withAlpha("#FFFFFF", intercepted ? 0.9 * (1 - k) ** 3 : 0.4 * (1 - k) ** 3);
            ctx.beginPath();
            ctx.arc(c.x, c.y, 3 + 5 * (1 - k), 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = withAlpha(INTERCEPTOR_COLOR, 0.8 * (1 - k));
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(c.x, c.y, 4 + 20 * k, 0, Math.PI * 2);
            ctx.stroke();
          }

          // impact shockwave + scorch
          const tImpact = l.t0 + l.flight;
          if (!intercepted && t >= tImpact) {
            const c = S(bezierAt(ctrl, 1));
            const since = t - tImpact;
            const blast = l.faction === "idf" ? "#A5D6FF" : "#F0883E";
            if (since < 30) {
              const k = since / 30;
              for (let i = 0; i < 3; i++) {
                const kk = Math.max(0, k - i * 0.12);
                ctx.strokeStyle = withAlpha(blast, 0.85 * (1 - kk));
                ctx.lineWidth = 2 - i * 0.5;
                ctx.beginPath();
                ctx.arc(c.x, c.y, 3 + 42 * kk, 0, Math.PI * 2);
                ctx.stroke();
              }
              ctx.fillStyle = withAlpha("#FFF1C1", 0.9 * (1 - k) ** 2);
              ctx.beginPath();
              ctx.arc(c.x, c.y, 6 * (1 - k) + 2, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = withAlpha(l.faction === "idf" ? "#58A6FF" : "#DA3633", 0.55);
            ctx.beginPath();
            ctx.arc(c.x, c.y, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // launch origins in use
        ctx.font = "11px Heebo, system-ui, sans-serif";
        ctx.textAlign = "center";
        for (const o of Object.values(ORIGINS)) {
          const used = script.launches.some((l) => l.faction !== "idf" && l.originName.en === o.name.en && t >= l.t0 - 30);
          if (!used) continue;
          const c = S(project(o.pos));
          ctx.strokeStyle = "#F85149";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y - 6);
          ctx.lineTo(c.x + 5.5, c.y + 4);
          ctx.lineTo(c.x - 5.5, c.y + 4);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = "#F85149";
          ctx.fillText(o.name[L], c.x, c.y + 17);
        }

        // cities
        for (const city of Object.values(CITIES)) {
          const c = S(project(city.pos));
          ctx.fillStyle = "#E6EDF3";
          ctx.beginPath();
          ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          if (cam.scale > 0.9 || city.id === "tel_aviv") {
            ctx.fillStyle = "#E6EDF3";
            ctx.textAlign = "start";
            ctx.fillText(city.name[L], c.x + 6, c.y - 4);
          }
        }

        // region labels
        ctx.textAlign = "center";
        for (const r of REGIONS) {
          if (r.kind === "territory" && cam.scale < 1.1) continue;
          const c = S(project(r.label));
          if (c.x < -40 || c.x > w + 40 || c.y < -20 || c.y > h + 20) continue;
          ctx.font = r.kind === "territory" ? "10px Heebo, system-ui, sans-serif" : "12px Heebo, system-ui, sans-serif";
          ctx.fillStyle = r.kind === "own" ? "#79C0FF" : "#5C6B7A";
          ctx.fillText(r.name[L], c.x, c.y);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // interaction: wheel zoom, drag pan, click to track, hover tooltips
  const onWheel = (e: React.WheelEvent) => {
    const cam = camRef.current;
    const el = wrapRef.current;
    if (cam === null || el === null) return;
    const r = el.getBoundingClientRect();
    const { w, h } = sizeRef.current;
    const at = { x: e.clientX - r.left, y: e.clientY - r.top };
    const before = toMap(at, cam, w, h);
    const scale = Math.max(0.15, Math.min(12, cam.scale * Math.exp(-e.deltaY * 0.0015)));
    const next = { ...cam, scale };
    const after = toMap(at, next, w, h);
    camRef.current = { scale, cx: cam.cx + (before.x - after.x), cy: cam.cy + (before.y - after.y) };
    manualRef.current = true;
  };

  const pickLaunch = (x: number, y: number): Launch | null => {
    const cam = camRef.current;
    if (cam === null) return null;
    const { w, h } = sizeRef.current;
    const { script, t } = useStrategic.getState();
    let best: Launch | null = null;
    let bestD = 16;
    for (const l of script.launches) {
      if (t < l.t0 || t >= endTime(l)) continue;
      const p = toScreen(bezierAt(bezierControls(l), progressAt(l, t)), cam, w, h);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    const cam = camRef.current;
    if (el === null || cam === null) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const drag = dragRef.current;
    if (drag !== null) {
      camRef.current = { ...drag.cam, cx: drag.cam.cx - (x - drag.x) / drag.cam.scale, cy: drag.cam.cy - (y - drag.y) / drag.cam.scale };
      manualRef.current = true;
      return;
    }
    const { w, h } = sizeRef.current;
    for (const city of Object.values(CITIES)) {
      const p = toScreen(project(city.pos), cam, w, h);
      if (Math.hypot(p.x - x, p.y - y) < 9) {
        const covering = Object.values(BATTERIES).filter((b) => {
          const bp = project(b.pos);
          const cp = project(city.pos);
          return Math.hypot(bp.x - cp.x, bp.y - cp.y) <= kmToUnits(b.radiusKm);
        });
        setHover({ x, y, text: [city.name[lang], ...covering.map((b) => `◆ ${b.name[lang]}`)] });
        return;
      }
    }
    const l = pickLaunch(x, y);
    setHover(l === null ? null : { x, y, text: [`${l.originName[lang]} → ${l.targetName[lang]}`] });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    const cam = camRef.current;
    if (el === null || cam === null) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const l = pickLaunch(x, y);
    if (l !== null) {
      useStrategic.getState().setTracked(l.id);
      return;
    }
    dragRef.current = { x, y, cam };
  };

  return (
    <div
      ref={wrapRef}
      dir="ltr"
      className="absolute inset-0 overflow-hidden bg-[#070B11] select-none"
      style={{ cursor: hover !== null ? "pointer" : dragRef.current !== null ? "grabbing" : "grab" }}
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={() => (dragRef.current = null)}
      onMouseLeave={() => {
        dragRef.current = null;
        setHover(null);
      }}
      onDoubleClick={() => (manualRef.current = false)}
    >
      <svg width={size.w} height={size.h} className="absolute inset-0 block">
        <defs>
          <pattern id="terr-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="#93A4B5" strokeWidth="0.6" strokeOpacity="0.35" />
          </pattern>
        </defs>
        <g ref={gRef}>
          {Array.from({ length: 30 }, (_, i) => 27 + i).map((lon) => (
            <path key={`lon${lon}`} d={linePath([[lon, 21], [lon, 39.5]])} stroke="#1A2230" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />
          ))}
          {Array.from({ length: 19 }, (_, i) => 21 + i).map((lat) => (
            <path key={`lat${lat}`} d={linePath([[24, lat], [57, lat]])} stroke="#1A2230" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />
          ))}
          {[...REGIONS].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]).map((r) => {
            const st = REGION_STYLE[r.kind];
            return (
              <g key={r.id}>
                <path d={ringPath(r.ring)} fill={st.fill} stroke={st.stroke} strokeWidth={1} strokeDasharray={st.dash} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                {r.kind === "territory" && <path d={ringPath(r.ring)} fill="url(#terr-hatch)" stroke="none" />}
              </g>
            );
          })}
          <path d={linePath(SUEZ_CANAL)} stroke="#58A6FF" strokeOpacity={0.7} strokeWidth={1.5} vectorEffect="non-scaling-stroke" fill="none" />
        </g>
      </svg>
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: size.w, height: size.h }} />
      {hover !== null && (
        <div
          className="overlay pointer-events-none absolute z-10 rounded-[4px] border border-line1 bg-bg1 px-2 py-1 text-[12px] leading-[18px]"
          style={{ left: hover.x + 14, top: hover.y + 10 }}
          dir={lang === "he" ? "rtl" : "ltr"}
        >
          {hover.text.map((line, i) => (
            <div key={i} className={i === 0 ? "text-fg0" : "text-fg1"}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
