/** Tactical map host: SVG base layer (Natural Earth 1:50m outlines, graticule,
 *  Suez canal) under a Canvas layer driven by strategic/renderer.ts. One
 *  camera drives both; heavy impacts shake both layers together. */

import { memo, useEffect, useRef, useState } from "react";
import { useStore } from "../../store";
import { useStrategic } from "../../strategic/store";
import {
  BATTERIES, CITIES, SUEZ_CANAL, focusCamera, kmToUnits, project, toMap, toScreen,
  type Camera, type LonLat,
} from "../../strategic/geo";
import { COUNTRY_SHAPES, ringsPath } from "../../strategic/regionGeo";
import { drawFrame, launchPos, shakeOffset } from "../../strategic/renderer";
import { drawLivingStill } from "../../strategic/living/director";
import { useCampaign } from "../../strategic/campaignStore";
import { crisisFocus } from "../../strategic/crisisScripts";
import { endTime, focusAt, type Launch } from "../../strategic/scenarios";

const ROLE: Record<string, "own" | "territory" | "neighbor"> = {
  israel: "own", gaza: "territory", west_bank: "territory",
  egypt: "neighbor", jordan: "neighbor", lebanon: "neighbor", syria: "neighbor",
};
const FILL = { own: "#F3F6FB", territory: "#ECE7DD", neighbor: "#F2EEE6", context: "#EFEBE3" };
const STROKE = { own: "#3569B8", territory: "#A69C8B", neighbor: "#BDB3A2", context: "#D3CBBD" };

function linePath(line: LonLat[]): string {
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

const BaseLayer = memo(function BaseLayer() {
  const shapes = COUNTRY_SHAPES.map((c) => ({ key: c.key, d: ringsPath(c.rings), role: ROLE[c.key] ?? "context" }));
  const order = { context: 0, neighbor: 1, own: 2, territory: 3 } as const;
  shapes.sort((a, b) => order[a.role] - order[b.role]);
  return (
    <>
      <defs>
        <pattern id="tac-hatch" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3" stroke="#8B7F6C" strokeWidth="0.5" strokeOpacity="0.3" />
        </pattern>
      </defs>
      {Array.from({ length: 47 }, (_, i) => 14 + i).map((lon) => (
        <path key={`lon${lon}`} d={linePath([[lon, 4], [lon, 47]])} stroke={lon % 5 === 0 ? "rgba(36,81,143,0.12)" : "rgba(36,81,143,0.045)"} strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />
      ))}
      {Array.from({ length: 44 }, (_, i) => 4 + i).map((lat) => (
        <path key={`lat${lat}`} d={linePath([[14, lat], [66, lat]])} stroke={lat % 5 === 0 ? "rgba(36,81,143,0.12)" : "rgba(36,81,143,0.045)"} strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />
      ))}
      {shapes.map((s) => (
        <g key={s.key}>
          <path
            d={s.d}
            fill={FILL[s.role]}
            stroke={STROKE[s.role]}
            strokeWidth={s.role === "own" ? 1.4 : 1}
            strokeDasharray={s.role === "territory" ? "3 3" : undefined}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            fillRule="evenodd"
          />
          {s.role === "territory" && <path d={s.d} fill="url(#tac-hatch)" stroke="none" />}
        </g>
      ))}
      <path d={linePath(SUEZ_CANAL)} stroke="#4F86C0" strokeOpacity={0.9} strokeWidth={1.5} vectorEffect="non-scaling-stroke" fill="none" />
    </>
  );
});

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
  const langRef = useRef(lang);
  const [hover, setHover] = useState<Hover | null>(null);
  const cameraMode = useStrategic((s) => s.cameraMode);
  const haltedCrisis = useStrategic((s) => (s.modalOpen && s.sim.pendingCrisis !== null ? s.sim.pendingCrisis.id : null));

  langRef.current = lang;

  // a camera change request (mode button, crisis halt) releases manual pan/zoom
  useEffect(() => {
    manualRef.current = false;
  }, [cameraMode, haltedCrisis]);

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

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let camSettled = false;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const needsMotion = (): boolean => {
      if (reduced) return false;
      if (!camSettled) return true;
      const st = useStrategic.getState();
      return st.playing;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { w, h } = sizeRef.current;
      const st = useStrategic.getState();
      const { script, t } = st;

      // camera: halted crisis → its focal zone; else the mode or the script's cues
      const pending = st.sim.pendingCrisis;
      const focus = st.modalOpen && pending !== null
        ? crisisFocus(pending.id)
        : st.cameraMode === "auto" ? focusAt(script, t) : st.cameraMode;
      const target = focusCamera(focus, w, h);
      if (camRef.current === null) camRef.current = target;
      if (!manualRef.current) camRef.current = lerpCam(camRef.current, target, 1 - Math.exp(-dt * 2.2));
      const cam = camRef.current;
      camSettled = Math.abs(cam.cx - target.cx) < 0.3 && Math.abs(cam.cy - target.cy) < 0.3 && Math.abs(cam.scale - target.scale) < 0.004;
      const shake = shakeOffset(script, t, now, st.playing);
      gRef.current?.setAttribute(
        "transform",
        `translate(${w / 2 - cam.cx * cam.scale + shake.x} ${h / 2 - cam.cy * cam.scale + shake.y}) scale(${cam.scale})`,
      );

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d") ?? null;
      if (canvas !== null && ctx !== null) {
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, shake.x * dpr, shake.y * dpr);
        ctx.clearRect(-20, -20, w + 40, h + 40);
        drawLivingStill(ctx, { cam, w, h, lang: langRef.current, now, game: useCampaign.getState().game });
        drawFrame(ctx, { script, t, cam, w, h, lang: langRef.current, nowMs: now, trackedId: st.trackedId });
      }
      raf = needsMotion() ? requestAnimationFrame(frame) : 0;
    };
    const wake = () => {
      if (raf !== 0) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    wake();
    const unsubStrategic = useStrategic.subscribe(wake);
    const unsubCampaign = useCampaign.subscribe(wake);
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      unsubStrategic();
      unsubCampaign();
    };
  }, []);

  const local = (e: React.MouseEvent | React.WheelEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return r === undefined ? null : { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onWheel = (e: React.WheelEvent) => {
    const cam = camRef.current;
    const at = local(e);
    if (cam === null || at === null) return;
    const { w, h } = sizeRef.current;
    const before = toMap(at, cam, w, h);
    const scale = Math.max(0.12, Math.min(40, cam.scale * Math.exp(-e.deltaY * 0.0015)));
    const after = toMap(at, { ...cam, scale }, w, h);
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
      const p = toScreen(launchPos(script, l, t), cam, w, h);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const at = local(e);
    const cam = camRef.current;
    if (at === null || cam === null) return;
    const drag = dragRef.current;
    if (drag !== null) {
      camRef.current = { ...drag.cam, cx: drag.cam.cx - (at.x - drag.x) / drag.cam.scale, cy: drag.cam.cy - (at.y - drag.y) / drag.cam.scale };
      manualRef.current = true;
      return;
    }
    const { w, h } = sizeRef.current;
    for (const city of Object.values(CITIES)) {
      const p = toScreen(project(city.pos), cam, w, h);
      if (Math.hypot(p.x - at.x, p.y - at.y) < 9) {
        const cp = project(city.pos);
        const covering = Object.values(BATTERIES).filter((b) => {
          if (b.airborne === true) return false;
          const bp = project(b.pos);
          return Math.hypot(bp.x - cp.x, bp.y - cp.y) <= kmToUnits(b.radiusKm);
        });
        setHover({ x: at.x, y: at.y, text: [city.name[lang], ...covering.map((b) => `◆ ${b.name[lang]}`)] });
        return;
      }
    }
    const l = pickLaunch(at.x, at.y);
    setHover(l === null ? null : { x: at.x, y: at.y, text: [`${l.originName[lang]} → ${l.targetName[lang]}`] });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const at = local(e);
    const cam = camRef.current;
    if (at === null || cam === null) return;
    const l = pickLaunch(at.x, at.y);
    if (l !== null) {
      useStrategic.getState().setTracked(l.id);
      return;
    }
    dragRef.current = { x: at.x, y: at.y, cam };
  };

  return (
    <div
      ref={wrapRef}
      dir="ltr"
      className="absolute inset-0 overflow-hidden select-none"
      style={{ background: "radial-gradient(ellipse at 55% 45%, #DCE8EE 0%, #D3E2E9 60%, #C9DAE3 100%)", cursor: hover !== null ? "pointer" : "grab" }}
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
        <g ref={gRef}>
          <BaseLayer />
        </g>
      </svg>
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: size.w, height: size.h }} />
      {/* soft paper vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(244,241,234,0) 70%, rgba(244,241,234,0.18) 100%)" }}
      />
      {hover !== null && (
        <div
          className="overlay glass pointer-events-none absolute z-10 rounded-[10px] border border-line0 px-2.5 py-1.5 text-[13px] leading-[19px]"
          style={{ left: hover.x + 14, top: hover.y + 10 }}
          dir={lang === "he" ? "rtl" : "ltr"}
        >
          {hover.text.map((line, i) => (
            <div key={i} className={i === 0 ? "font-medium text-fg0" : "text-[12px] text-fg1"}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
