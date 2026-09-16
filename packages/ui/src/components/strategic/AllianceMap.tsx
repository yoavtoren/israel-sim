/** Alliance map: every relevant country filled by its stance toward Israel
 *  (six tiers, blue = with us → red = at war). SVG, one camera; wheel zoom,
 *  drag pan, double-click to reset, hover tooltip, click to select. */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { strategic } from "@engine";
import type { Lang } from "../../lib/strings";
import { project, toMap, type Camera, type LonLat } from "../../strategic/geo";
import {
  ACTOR_BY_MAPKEY, ALLIANCE_BOUNDS, CALLOUT_TARGETS, CONTEXT_FILL, CONTEXT_STROKE, COUNTRY_SHAPES,
  ISRAEL_FILL, LABEL_ANCHORS, PROXY_LINKS, SEA, TIER_COLORS, ringsPath,
} from "../../strategic/regionGeo";

type Stances = Record<strategic.ActorId, strategic.ActorStance>;

function fitCamera([a, b]: [LonLat, LonLat], w: number, h: number): Camera {
  const p0 = project([a[0], b[1]]);
  const p1 = project([b[0], a[1]]);
  return { cx: (p0.x + p1.x) / 2, cy: (p0.y + p1.y) / 2, scale: Math.min(w / (p1.x - p0.x), h / (p1.y - p0.y)) };
}

/** Static outlines, memoized so pan/zoom only rewrites the group transform. */
const PATHS = COUNTRY_SHAPES.map((c) => ({ key: c.key, d: ringsPath(c.rings) }));

const Graticule = memo(function Graticule() {
  const lines: string[] = [];
  for (let lon = 10; lon <= 70; lon += 5) {
    const a = project([lon, 0]);
    const b = project([lon, 50]);
    lines.push(`M${a.x},${a.y}L${b.x},${b.y}`);
  }
  for (let lat = 0; lat <= 50; lat += 5) {
    const a = project([10, lat]);
    const b = project([70, lat]);
    lines.push(`M${a.x},${a.y}L${b.x},${b.y}`);
  }
  return <path d={lines.join("")} stroke="#131B27" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />;
});

function proxyPath(from: LonLat, to: LonLat): string {
  const a = project(from);
  const b = project(to);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  // bow the arc northward-ish, perpendicular to the chord
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  const k = len * 0.18;
  return `M${a.x},${a.y}Q${mx + nx * k},${my + ny * k} ${b.x},${b.y}`;
}

export function AllianceMap(props: {
  stances: Stances;
  lang: Lang;
  selected: strategic.ActorId | null;
  onSelect: (id: strategic.ActorId | null) => void;
  showProxies: boolean;
}) {
  const { stances, lang, selected, onSelect, showProxies } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [cam, setCam] = useState<Camera | null>(null);
  const manual = useRef(false);
  const drag = useRef<{ x: number; y: number; cam: Camera; moved: boolean } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; key: string } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (el === null) return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const s = { w: Math.max(200, r.width), h: Math.max(200, r.height) };
      setSize(s);
      if (!manual.current) setCam(fitCamera(ALLIANCE_BOUNDS, s.w, s.h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const camera = cam ?? fitCamera(ALLIANCE_BOUNDS, size.w, size.h);
  const S = (p: LonLat) => {
    const q = project(p);
    return { x: size.w / 2 + (q.x - camera.cx) * camera.scale, y: size.h / 2 + (q.y - camera.cy) * camera.scale };
  };

  const fills = useMemo(() => {
    const out = new Map<string, string>();
    for (const c of COUNTRY_SHAPES) {
      const actor = ACTOR_BY_MAPKEY.get(c.key);
      if (c.key === "israel") out.set(c.key, ISRAEL_FILL);
      else if (actor !== undefined) out.set(c.key, TIER_COLORS[stances[actor].tier]);
    }
    return out;
  }, [stances]);

  const local = (e: React.MouseEvent | React.WheelEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const onWheel = (e: React.WheelEvent) => {
    const at = local(e);
    const before = toMap(at, camera, size.w, size.h);
    const scale = Math.max(0.08, Math.min(8, camera.scale * Math.exp(-e.deltaY * 0.0015)));
    const next = { ...camera, scale };
    const after = toMap(at, next, size.w, size.h);
    manual.current = true;
    setCam({ scale, cx: camera.cx + (before.x - after.x), cy: camera.cy + (before.y - after.y) });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { ...local(e), cam: camera, moved: false };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const p = local(e);
    const d = drag.current;
    if (d !== null && (d.moved || Math.hypot(p.x - d.x, p.y - d.y) > 3)) {
      d.moved = true;
      manual.current = true;
      setHover(null);
      setCam({ ...d.cam, cx: d.cam.cx - (p.x - d.x) / d.cam.scale, cy: d.cam.cy - (p.y - d.y) / d.cam.scale });
      return;
    }
    const key = (e.target as Element).getAttribute("data-key");
    setHover(key === null ? null : { ...p, key });
  };

  const onMouseUp = (e: React.MouseEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d === null || d.moved) return;
    const key = (e.target as Element).getAttribute("data-key");
    const actor = key === null ? undefined : ACTOR_BY_MAPKEY.get(key);
    onSelect(actor ?? null);
  };

  const selectedKey = selected === null ? null : strategic.ACTOR_DEFS[selected].mapKey;
  const hoverActor = hover === null ? undefined : ACTOR_BY_MAPKEY.get(hover.key);
  const labelScale = camera.scale / 0.23;

  return (
    <div
      ref={wrapRef}
      dir="ltr"
      className="absolute inset-0 overflow-hidden select-none"
      style={{ background: SEA, cursor: drag.current?.moved === true ? "grabbing" : hoverActor !== undefined ? "pointer" : "grab" }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => {
        drag.current = null;
        setHover(null);
      }}
      onDoubleClick={() => {
        manual.current = false;
        setCam(fitCamera(ALLIANCE_BOUNDS, size.w, size.h));
      }}
    >
      <svg width={size.w} height={size.h} className="absolute inset-0 block">
        <defs>
          <pattern id="enemy-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#000" strokeWidth="1.6" strokeOpacity="0.28" />
          </pattern>
        </defs>
        <g transform={`translate(${size.w / 2 - camera.cx * camera.scale} ${size.h / 2 - camera.cy * camera.scale}) scale(${camera.scale})`}>
          <Graticule />
          {PATHS.map((p) => {
            const fill = fills.get(p.key);
            const actor = ACTOR_BY_MAPKEY.get(p.key);
            const enemy = actor !== undefined && stances[actor].tier === "ENEMY";
            const isHover = hover?.key === p.key && (actor !== undefined || p.key === "israel");
            return (
              <g key={p.key}>
                <path
                  data-key={p.key}
                  d={p.d}
                  fill={fill ?? CONTEXT_FILL}
                  fillOpacity={fill === undefined ? 1 : isHover ? 1 : 0.88}
                  fillRule="evenodd"
                  stroke={fill === undefined ? CONTEXT_STROKE : "#0A0F16"}
                  strokeWidth={fill === undefined ? 0.8 : 1}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
                {enemy && <path d={p.d} fill="url(#enemy-hatch)" fillRule="evenodd" pointerEvents="none" />}
              </g>
            );
          })}
          {/* selection / hover outlines on top of neighbors */}
          {PATHS.filter((p) => p.key === selectedKey || (hover?.key === p.key && fills.has(p.key))).map((p) => (
            <path
              key={`hl-${p.key}`}
              d={p.d}
              fill="none"
              stroke={p.key === selectedKey ? "#FFFFFF" : "#C9D6E3"}
              strokeWidth={p.key === selectedKey ? 2.2 : 1.4}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ))}
          {showProxies &&
            PROXY_LINKS.map((l) => (
              <path
                key={`px-${l.actor}`}
                d={proxyPath(l.from, l.to)}
                fill="none"
                stroke="#F85149"
                strokeOpacity={0.55}
                strokeWidth={1.3}
                strokeDasharray="5 5"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
        </g>
      </svg>

      {/* labels in screen space so text stays crisp at every zoom */}
      <svg width={size.w} height={size.h} className="pointer-events-none absolute inset-0 block">
        {Object.entries(LABEL_ANCHORS).map(([key, anchor]) => {
          const actor = ACTOR_BY_MAPKEY.get(key);
          if (actor === undefined && key !== "israel") return null;
          if (anchor.callout === true && labelScale < 0.8 && key !== "gaza" && key !== "lebanon") return null;
          const p = S(anchor.at);
          if (p.x < -60 || p.x > size.w + 60 || p.y < -20 || p.y > size.h + 20) return null;
          const def = actor === undefined ? null : strategic.ACTOR_DEFS[actor];
          const name = key === "israel" ? (lang === "he" ? "ישראל" : "Israel") : def?.name[lang] ?? key;
          const target = CALLOUT_TARGETS[key];
          const t = target === undefined ? null : S(target);
          const fs = Math.round(Math.max(10, Math.min(15, 11 * Math.sqrt(labelScale))));
          const dark = key === "israel";
          return (
            <g key={`lb-${key}`}>
              {anchor.callout === true && t !== null && (
                <>
                  <line x1={p.x} y1={p.y + 3} x2={t.x} y2={t.y} stroke="#93A4B5" strokeOpacity={0.6} strokeWidth={0.8} />
                  <circle cx={t.x} cy={t.y} r={1.8} fill="#E6EDF3" />
                </>
              )}
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                fontSize={fs}
                fontWeight={key === "israel" ? 700 : 500}
                fontFamily="Heebo, system-ui, sans-serif"
                fill={dark ? "#0A0F16" : "#F0F4F8"}
                stroke={dark ? "none" : "#070B11"}
                strokeWidth={dark ? 0 : 3}
                strokeOpacity={0.75}
                paintOrder="stroke"
              >
                {name}
              </text>
              {actor !== undefined && labelScale >= 0.9 && (
                <text
                  x={p.x}
                  y={p.y + fs + 1}
                  textAnchor="middle"
                  fontSize={fs - 2}
                  fontFamily="IBM Plex Mono, ui-monospace, monospace"
                  fill="#C9D6E3"
                  stroke="#070B11"
                  strokeWidth={3}
                  strokeOpacity={0.75}
                  paintOrder="stroke"
                >
                  {stances[actor].score > 0 ? `+${stances[actor].score}` : stances[actor].score}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover !== null && (hoverActor !== undefined || hover.key === "israel") && (
        <div
          className="overlay pointer-events-none absolute z-10 rounded-[4px] border border-line1 bg-bg1 px-2 py-1 text-[12px] leading-[18px]"
          style={{ left: Math.min(hover.x + 14, size.w - 220), top: hover.y + 12 }}
          dir={lang === "he" ? "rtl" : "ltr"}
        >
          {hoverActor === undefined ? (
            <div className="text-fg0">{lang === "he" ? "ישראל" : "Israel"}</div>
          ) : (
            <>
              <div className="text-fg0">
                {strategic.ACTOR_DEFS[hoverActor].name[lang]}
                {strategic.ACTOR_DEFS[hoverActor].entity !== undefined && (
                  <span className="text-fg2"> · {strategic.ACTOR_DEFS[hoverActor].entity?.[lang]}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-fg1">
                <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: TIER_COLORS[stances[hoverActor].tier] }} />
                {strategic.TIER_LABELS[stances[hoverActor].tier][lang]}
                <bdi className="num text-fg0">{stances[hoverActor].score > 0 ? `+${stances[hoverActor].score}` : stances[hoverActor].score}</bdi>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
