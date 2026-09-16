/** The campaign's world map: every country (Natural Earth 1:50m), colored by
 *  its stance toward Israel, with the tactical Canvas layer (missiles,
 *  interceptors, units) drawn on top in the same projection. The camera flies
 *  to whatever the story is about; wheel/drag take manual control. */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { strategic } from "@engine";
import type { Lang } from "../../lib/strings";
import { useStrategic } from "../../strategic/store";
import { toMap, toScreen, type Camera } from "../../strategic/geo";
import { TIER_COLORS } from "../../strategic/regionGeo";
import { COUNTRY_HE, WORLD_ACTOR, WORLD_COUNTRIES, WORLD_LABELS, WORLD_NAME, fitWorld, ringsToPath, type WorldFocus } from "../../strategic/worldGeo";
import { drawFrame, shakeOffset } from "../../strategic/renderer";

type Stances = Record<strategic.ActorId, strategic.ActorStance>;
export interface Inset {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const ISRAEL = "#FDFBF6";
const CONTEXT = "#F7F4EE";
const STROKE = "#FFFFFF";

function lerpCam(a: Camera, b: Camera, k: number): Camera {
  return {
    cx: a.cx + (b.cx - a.cx) * k,
    cy: a.cy + (b.cy - a.cy) * k,
    scale: Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * k),
  };
}

const Outlines = memo(function Outlines(props: { fills: Map<string, string>; highlight: Set<string> }) {
  return (
    <>
      {WORLD_COUNTRIES.map((c) => {
        const hot = props.highlight.has(c.key);
        return (
          <path
            key={c.key}
            data-key={c.key}
            d={PATHS.get(c.key)}
            fill={props.fills.get(c.key) ?? CONTEXT}
            stroke={hot ? "#1C2330" : c.key === "israel" ? "#24518F" : props.fills.has(c.key) ? STROKE : "#DCD5C8"}
            strokeWidth={hot ? 2 : c.key === "israel" ? 1.8 : 0.8}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            fillRule="evenodd"
            className={hot ? "country-pulse" : undefined}
          />
        );
      })}
    </>
  );
});

const PATHS = new Map(WORLD_COUNTRIES.map((c) => [c.key, ringsToPath(c.rings)]));

export function WorldMap(props: {
  stances: Stances;
  lang: Lang;
  focus: WorldFocus;
  inset: Inset;
  /** actors whose countries pulse (e.g. those reacting to the current event) */ highlight: strategic.ActorId[];
}) {
  const { stances, lang, focus, inset } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 700 });
  const sizeRef = useRef(size);
  const camRef = useRef<Camera | null>(null);
  const manual = useRef(false);
  const drag = useRef<{ x: number; y: number; cam: Camera } | null>(null);
  const targetRef = useRef({ focus, inset });
  const langRef = useRef(lang);
  const [hover, setHover] = useState<{ x: number; y: number; key: string } | null>(null);

  langRef.current = lang;
  targetRef.current = { focus, inset };

  // a new story focus takes the camera back from manual control
  useEffect(() => {
    manual.current = false;
  }, [focus]);

  useEffect(() => {
    const el = wrapRef.current;
    if (el === null) return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      sizeRef.current = { w: Math.max(200, r.width), h: Math.max(200, r.height) };
      setSize(sizeRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fills = useMemo(() => {
    const out = new Map<string, string>();
    for (const c of WORLD_COUNTRIES) {
      if (c.key === "israel") {
        out.set(c.key, ISRAEL);
        continue;
      }
      const actor = WORLD_ACTOR.get(c.key);
      if (actor !== undefined) out.set(c.key, TIER_COLORS[stances[actor].tier]);
    }
    return out;
  }, [stances]);

  const highlight = useMemo(() => {
    const set = new Set<string>();
    for (const [key, actor] of WORLD_ACTOR.entries()) if (props.highlight.includes(actor)) set.add(key);
    return set;
  }, [props.highlight]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { w, h } = sizeRef.current;
      const target = fitWorld(targetRef.current.focus, w, h, targetRef.current.inset);
      if (camRef.current === null) camRef.current = fitWorld("world", w, h, targetRef.current.inset);
      if (!manual.current) camRef.current = lerpCam(camRef.current, target, 1 - Math.exp(-dt * 1.6));
      const cam = camRef.current;
      const st = useStrategic.getState();
      const shake = shakeOffset(st.script, st.t, now, st.playing);
      gRef.current?.setAttribute("transform", `translate(${w / 2 - cam.cx * cam.scale + shake.x} ${h / 2 - cam.cy * cam.scale + shake.y}) scale(${cam.scale})`);

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
        const L = langRef.current;

        // country labels, sized to what fits at this zoom
        ctx.textAlign = "center";
        for (const lab of WORLD_LABELS) {
          const px = Math.sqrt(lab.area) * 100 * cam.scale;
          if (px < 55) continue;
          const p = toScreen({ x: lab.x, y: lab.y }, cam, w, h);
          if (p.x < -60 || p.x > w + 60 || p.y < -20 || p.y > h + 20) continue;
          const actor = WORLD_ACTOR.get(lab.key);
          ctx.font = `${actor !== undefined || lab.key === "israel" ? 600 : 400} ${Math.min(14, 9 + px / 90)}px Rubik, Heebo, system-ui, sans-serif`;
          const name = (L === "he" ? COUNTRY_HE[lab.key] : undefined) ?? WORLD_NAME.get(lab.key) ?? lab.key;
          ctx.lineJoin = "round";
          if (lab.key === "israel") {
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.strokeText(name, p.x, p.y);
            ctx.fillStyle = "#24518F";
          } else {
            ctx.lineWidth = 3;
            ctx.strokeStyle = actor !== undefined ? "rgba(255,255,255,0.8)" : "rgba(247,244,238,0.9)";
            ctx.strokeText(name, p.x, p.y);
            ctx.fillStyle = actor !== undefined ? "rgba(28,35,48,0.92)" : "rgba(110,104,94,0.75)";
          }
          ctx.fillText(name, p.x, p.y);
        }

        drawFrame(ctx, { script: st.script, t: st.t, cam, w, h, lang: L, nowMs: now, trackedId: st.trackedId, chrome: cam.scale > 1.4 });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const local = (e: React.MouseEvent | React.WheelEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const onWheel = (e: React.WheelEvent) => {
    const cam = camRef.current;
    if (cam === null) return;
    const at = local(e);
    const { w, h } = sizeRef.current;
    const before = toMap(at, cam, w, h);
    const scale = Math.max(0.03, Math.min(40, cam.scale * Math.exp(-e.deltaY * 0.0015)));
    const after = toMap(at, { ...cam, scale }, w, h);
    camRef.current = { scale, cx: cam.cx + (before.x - after.x), cy: cam.cy + (before.y - after.y) };
    manual.current = true;
  };

  const hoverKey = hover?.key ?? null;
  const hoverActor = hoverKey === null ? undefined : WORLD_ACTOR.get(hoverKey);
  const hoverName = hoverKey === null ? "" : (lang === "he" ? COUNTRY_HE[hoverKey] : undefined) ?? WORLD_NAME.get(hoverKey) ?? "";

  return (
    <div
      ref={wrapRef}
      dir="ltr"
      className="absolute inset-0 overflow-hidden select-none"
      style={{ background: "radial-gradient(ellipse at 55% 40%, #E3ECF0 0%, #CFDCE3 85%)", cursor: drag.current !== null ? "grabbing" : "grab" }}
      onWheel={onWheel}
      onMouseDown={(e) => {
        const cam = camRef.current;
        if (cam !== null) drag.current = { ...local(e), cam };
      }}
      onMouseMove={(e) => {
        const at = local(e);
        const d = drag.current;
        if (d !== null) {
          camRef.current = { ...d.cam, cx: d.cam.cx - (at.x - d.x) / d.cam.scale, cy: d.cam.cy - (at.y - d.y) / d.cam.scale };
          manual.current = true;
          return;
        }
        const key = (e.target as Element).getAttribute("data-key");
        setHover(key === null ? null : { ...at, key });
      }}
      onMouseUp={() => (drag.current = null)}
      onMouseLeave={() => {
        drag.current = null;
        setHover(null);
      }}
      onDoubleClick={() => (manual.current = false)}
    >
      <svg width={size.w} height={size.h} className="absolute inset-0 block">
        <g ref={gRef}>
          <Outlines fills={fills} highlight={highlight} />
        </g>
      </svg>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" style={{ width: size.w, height: size.h }} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(244,241,234,0) 65%, rgba(244,241,234,0.45) 100%)" }}
      />
      {hover !== null && hoverName !== "" && (
        <div
          className="overlay pointer-events-none absolute z-10 rounded-[10px] border border-line0 bg-bg1 px-3 py-2 text-[13px] leading-[19px]"
          style={{ left: hover.x + 14, top: hover.y + 12 }}
          dir={lang === "he" ? "rtl" : "ltr"}
        >
          <div className="font-medium text-fg0">{hoverName}</div>
          {hoverActor !== undefined && (
            <div className="flex items-center gap-1.5 text-fg1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TIER_COLORS[stances[hoverActor].tier] }} />
              {strategic.TIER_LABELS[stances[hoverActor].tier][lang]}
              <span className="num">({stances[hoverActor].score > 0 ? "+" : ""}{stances[hoverActor].score})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
