/** Screen 2 — The Map (DESIGN §6.2). Edge-to-edge MapLibre canvas; locality
 *  circles colored by indicator (no polygon boundaries in the data — documented
 *  in locality_coords sidecar); time scrubber recolors from run history.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from "maplibre-gl";
import { useStore } from "../store";
import { t, type UIKey } from "../lib/strings";
import { clusterColor, divColor, seqColor, INK } from "../lib/colors";
import { fmtCompact, fmtPct, fmtQuarter, fmtBudget, fmtInt } from "../lib/format";
import { Num, Sparkline } from "../components/ui";

type Indicator = "population" | "employment" | "service_access" | "migration" | "cluster";

const INDICATORS: Array<{ id: Indicator; label: UIKey }> = [
  { id: "population", label: "population" },
  { id: "employment", label: "employment" },
  { id: "service_access", label: "serviceAccess" },
  { id: "migration", label: "migration" },
  { id: "cluster", label: "cluster" },
];

const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#E9EEF0" } }],
};

interface Hover {
  x: number;
  y: number;
  idx: number;
}

export function MapScreen() {
  const lang = useStore((s) => s.lang);
  const meta = useStore((s) => s.meta);
  const frames = useStore((s) => s.frames);
  const state = useStore((s) => s.state);
  const [indicator, setIndicator] = useState<Indicator>("population");
  const [frameIdx, setFrameIdx] = useState<number | null>(null); // null = live (latest)
  const [hover, setHover] = useState<Hover | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const fi = frameIdx ?? frames.length - 1;
  const frame = frames[Math.max(0, Math.min(fi, frames.length - 1))];

  // one-time map init
  useEffect(() => {
    if (mapEl.current === null || map.current !== null) return;
    const m = new maplibregl.Map({
      container: mapEl.current,
      style: BLANK_STYLE,
      center: [35.0, 31.6],
      zoom: 6.6,
      attributionControl: false,
      dragRotate: false,
    });
    m.on("error", (e) => console.error("maplibre:", e.error.message));
    if (import.meta.env.DEV) (window as unknown as { __map?: maplibregl.Map }).__map = m;
    m.on("load", () => {
      m.addSource("localities", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "loc-circles",
        type: "circle",
        source: "localities",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, ["get", "r"], 10, ["*", ["get", "r"], 3.2]],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.9,
          // white hairline separates overlapping dots; periphery-program towns get an ink ring
          "circle-stroke-width": ["case", ["get", "periphery"], 1.8, 0.7],
          "circle-stroke-color": ["case", ["get", "periphery"], "#1C2330", "#FFFFFF"],
        },
      });
      m.on("mousemove", "loc-circles", (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (f?.properties !== undefined) {
          setHover({ x: e.point.x, y: e.point.y, idx: Number(f.properties.idx) });
          m.getCanvas().style.cursor = "crosshair";
        }
      });
      m.on("mouseleave", "loc-circles", () => {
        setHover(null);
        m.getCanvas().style.cursor = "";
      });
      setMapReady(true);
    });
    map.current = m;
    // In dev, utility CSS can land after Map() measures the container (it reads
    // height 0 and falls back to a 300px canvas) — track the real size ourselves.
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(mapEl.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      setMapReady(false);
    };
  }, []);

  // recolor on frame / indicator change (200ms crossfade comes from the paint transition)
  useEffect(() => {
    const m = map.current;
    if (m === null || !mapReady || meta === null || frame === undefined || state === null) return;
    const src = m.getSource("localities") as GeoJSONSource | undefined;
    if (src === undefined) return;
    const loc = meta.localities;
    const values = indicatorValues(indicator, frame, loc.cluster);
    const [lo, hi] = robustDomain(values, indicator);
    const peripheryClusters = new Set(state.fiscal.periphery_spend > 0 ? state.fiscal.periphery_target_clusters : []);
    const features: GeoJSON.Feature[] = [];
    for (let i = 0; i < loc.code.length; i++) {
      if (!Number.isFinite(loc.lon[i])) continue;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [loc.lon[i], loc.lat[i]] },
        properties: {
          idx: i,
          r: 1.2 + Math.sqrt(frame.loc_population[i]) / 90,
          color: colorFor(indicator, values[i], lo, hi),
          periphery: peripheryClusters.has(loc.cluster[i]),
        },
      });
    }
    src.setData({ type: "FeatureCollection", features });
  }, [mapReady, meta, frame, indicator, state]);

  const nationalSeries = useMemo(
    () => frames.map((f) => nationalAggregate(indicator, f)),
    [frames, indicator],
  );

  if (meta === null || state === null || frame === undefined) return null;

  const loc = meta.localities;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* inline style: maplibre's unlayered CSS overrides Tailwind's layered utilities */}
      <div ref={mapEl} style={{ position: "absolute", inset: 0 }} />

      {/* top-left stack: clock + national KPIs (DESIGN §6.2) */}
      <div className="panel overlay glass absolute top-4 start-4 w-[230px] px-4 py-3">
        <div className="eyebrow">{frameIdx === null ? (lang === "he" ? "עכשיו" : "Now") : lang === "he" ? "מבט לאחור" : "Looking back"}</div>
        <Num value={fmtQuarter(frame.year, frame.quarter)} className="display block text-[26px] leading-[34px]" />
        <div className="mt-2 flex flex-col gap-1 border-t border-line0 pt-2 text-[13px]">
          <KV label={t("gdp", lang)} value={fmtBudget(frame.gdp_real, 0)} />
          <KV label={t("unemployment", lang)} value={fmtPct(frame.unemployment, 2)} />
          <KV label={t("debtGdp", lang)} value={fmtPct(frame.debt_gdp, 1)} />
        </div>
      </div>

      {/* indicator selector */}
      <div className="panel overlay glass absolute top-4 end-4 flex w-[200px] flex-col gap-0.5 p-2">
        <div className="eyebrow px-2 pt-1 pb-1.5">{lang === "he" ? "צביעה לפי" : "Color by"}</div>
        {INDICATORS.map((ind) => (
          <button
            key={ind.id}
            type="button"
            onClick={() => setIndicator(ind.id)}
            className={`flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-start text-[13px] transition-colors ${
              indicator === ind.id ? "bg-fg0 font-medium text-white" : "text-fg1 hover:bg-bg2 hover:text-fg0"
            }`}
          >
            {t(ind.label, lang)}
          </button>
        ))}
        <Legend indicator={indicator} lang={lang} />
      </div>

      {/* hover locality card */}
      {hover !== null && (
        <LocalityCard hover={hover} frame={frame} lang={lang} names={loc.name_he} clusters={loc.cluster} />
      )}

      {/* bottom: national sparkline riding above the time scrubber */}
      <div className="panel overlay glass absolute inset-x-4 bottom-4 px-5 py-3">
        <div className="mb-2 flex items-center gap-3">
          <Sparkline values={nationalSeries} width={220} height={26} color={INK.fg1} />
          <span className="num text-[13px] font-medium text-fg0">{fmtCompact(nationalSeries[Math.max(0, Math.min(fi, nationalSeries.length - 1))] ?? 0, 2)}</span>
          <span className="num ms-auto text-[12px] text-fg2">
            {fmtQuarter(frames[0].year, frames[0].quarter)} → {fmtQuarter(frames[frames.length - 1].year, frames[frames.length - 1].quarter)}
          </span>
        </div>
        <bdi dir="ltr" className="block">
          <input
            type="range"
            className="w-full"
            min={0}
            max={frames.length - 1}
            value={fi}
            onChange={(e) => setFrameIdx(Number(e.target.value) === frames.length - 1 ? null : Number(e.target.value))}
          />
        </bdi>
      </div>
    </div>
  );
}

/** Tiny key for the active color ramp. */
function Legend(props: { indicator: Indicator; lang: "he" | "en" }) {
  const stops = Array.from({ length: 9 }, (_, i) => i / 8);
  const colors =
    props.indicator === "cluster"
      ? stops.map((u) => clusterColor(1 + u * 9))
      : props.indicator === "migration"
        ? stops.map((u) => divColor(u * 2 - 1))
        : stops.map((u) => seqColor(u));
  const [lo, hi] =
    props.indicator === "cluster"
      ? ["1", "10"]
      : props.indicator === "migration"
        ? [props.lang === "he" ? "עזיבה" : "Leaving", props.lang === "he" ? "הגעה" : "Arriving"]
        : [props.lang === "he" ? "נמוך" : "Low", props.lang === "he" ? "גבוה" : "High"];
  return (
    <div className="mt-2 border-t border-line0 px-2 pt-2.5 pb-1">
      <bdi dir="ltr" className="block">
        <div className="h-2 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${colors.join(",")})` }} />
        <div className="mt-1 flex justify-between text-[11.5px] text-fg2">
          <span>{lo}</span>
          <span>{hi}</span>
        </div>
      </bdi>
    </div>
  );
}

function KV(props: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-fg1">{props.label}</span>
      <span className="num text-fg0">{props.value}</span>
    </div>
  );
}

function LocalityCard(props: {
  hover: Hover;
  frame: { loc_population: Float64Array; loc_employment: Float64Array; loc_service_access: Float64Array; loc_migration: Float64Array };
  lang: "he" | "en";
  names: string[];
  clusters: number[];
}) {
  const i = props.hover.idx;
  const mig = props.frame.loc_migration[i];
  return (
    <div
      className="panel overlay pointer-events-none absolute z-40 w-64 px-4 py-3"
      style={{ left: Math.min(props.hover.x + 14, window.innerWidth - 540), top: props.hover.y + 14 }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="display text-[16px] leading-[22px]">{props.names[i]}</span>
        <span
          className="num inline-flex items-center gap-1 rounded-full px-2 text-[11.5px] leading-[20px] font-medium text-white"
          style={{ background: clusterColor(props.clusters[i]) }}
          title={t("cluster", props.lang)}
        >
          {props.clusters[i] > 0 ? props.clusters[i] : "—"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-y-1 border-t border-line0 pt-2 text-[13px]">
        <KV label={t("population", props.lang)} value={fmtInt(props.frame.loc_population[i])} />
        <KV label={t("employment", props.lang)} value={fmtPct(props.frame.loc_employment[i], 1)} />
        <KV label={t("serviceAccess", props.lang)} value={fmtPct(props.frame.loc_service_access[i], 0)} />
        <KV
          label={t("migration", props.lang)}
          value={`${mig > 0 ? "→+" : mig < 0 ? "→−" : ""}${fmtInt(Math.abs(mig))}`}
        />
      </div>
    </div>
  );
}

function indicatorValues(
  ind: Indicator,
  f: { loc_population: Float64Array; loc_employment: Float64Array; loc_service_access: Float64Array; loc_migration: Float64Array },
  clusters: number[],
): ArrayLike<number> {
  switch (ind) {
    case "population": return f.loc_population;
    case "employment": return f.loc_employment;
    case "service_access": return f.loc_service_access;
    case "migration": return f.loc_migration;
    case "cluster": return clusters;
  }
}

function robustDomain(values: ArrayLike<number>, ind: Indicator): [number, number] {
  if (ind === "cluster") return [1, 10];
  const arr = Array.from({ length: values.length }, (_, i) => values[i]).filter((v) => Number.isFinite(v));
  arr.sort((a, b) => a - b);
  const q = (p: number) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  if (ind === "migration") {
    const m = Math.max(Math.abs(q(0.05)), Math.abs(q(0.95)), 1e-9);
    return [-m, m];
  }
  if (ind === "population") return [Math.log10(Math.max(1, q(0.02))), Math.log10(Math.max(10, q(0.98)))];
  return [q(0.02), q(0.98)];
}

function colorFor(ind: Indicator, v: number, lo: number, hi: number): string {
  if (ind === "cluster") return clusterColor(v);
  if (ind === "migration") return divColor(v / (hi || 1));
  const x = ind === "population" ? Math.log10(Math.max(1, v)) : v;
  return seqColor((x - lo) / (hi - lo || 1));
}

function nationalAggregate(
  ind: Indicator,
  f: { loc_population: Float64Array; loc_employment: Float64Array; loc_service_access: Float64Array; loc_migration: Float64Array },
): number {
  const n = f.loc_population.length;
  if (n === 0) return 0;
  let pop = 0;
  for (let i = 0; i < n; i++) pop += f.loc_population[i];
  switch (ind) {
    case "population": return pop;
    case "cluster": return pop;
    case "migration": {
      let s = 0;
      for (let i = 0; i < n; i++) s += Math.abs(f.loc_migration[i]);
      return s;
    }
    case "employment": {
      let s = 0;
      for (let i = 0; i < n; i++) s += f.loc_employment[i] * f.loc_population[i];
      return s / (pop || 1);
    }
    case "service_access": {
      let s = 0;
      for (let i = 0; i < n; i++) s += f.loc_service_access[i] * f.loc_population[i];
      return s / (pop || 1);
    }
  }
}
