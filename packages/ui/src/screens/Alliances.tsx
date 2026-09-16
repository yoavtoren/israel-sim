/** Home screen — the alliance map. The region fills the screen, each country
 *  colored by its stance toward Israel; the legend, off-map powers and the
 *  selected country's breakdown float above it. Stances are recomputed from
 *  the strategic state, so every cabinet decision recolors the map. */

import { useMemo, useState } from "react";
import { strategic } from "@engine";
import { useStore } from "../store";
import { useStrategic } from "../strategic/store";
import { AllianceMap } from "../components/strategic/AllianceMap";
import { GEO_SOURCE, TIER_COLORS } from "../strategic/regionGeo";
import type { Lang } from "../lib/strings";

type Stances = Record<strategic.ActorId, strategic.ActorStance>;

const L = {
  title: { he: "מפת בריתות", en: "Alliance map" },
  subtitle: { he: "עמדת כל מדינה כלפי ישראל", en: "Each country's stance toward Israel" },
  withUs: { he: "איתנו", en: "With us" },
  againstUs: { he: "נגדנו", en: "Against us" },
  powers: { he: "מעצמות וגושים מחוץ למפה", en: "Powers off the map" },
  proxies: { he: "ציר ההתנגדות", en: "Axis of Resistance" },
  toCabinet: { he: "להכרעת הקבינט", en: "To the cabinet" },
  drivers: { he: "מה קובע את העמדה", en: "What drives the stance" },
  total: { he: "סה\"כ", en: "Total" },
  sinceLast: { he: "מאז ההכרעה הקודמת", en: "since the last decision" },
  close: { he: "סגור", en: "Close" },
  ranking: { he: "דירוג", en: "Ranking" },
  hint: { he: "גלגלת לזום · גרירה להזזה · לחיצה כפולה לאיפוס · לחיצה על מדינה לפירוט", en: "Wheel to zoom · drag to pan · double-click to reset · click a country for details" },
  assumptions: { he: "הציונים הם הנחות מודל, לא מדידה", en: "Scores are model assumptions, not measurements" },
  crisis: { he: "משבר פתוח — ממתין להכרעה במפה הטקטית", en: "Crisis open — awaiting a decision on the tactical map" },
};

const OFF_MAP: strategic.ActorId[] = strategic.ACTOR_IDS.filter((id) => strategic.ACTOR_DEFS[id].mapKey === null);

const signed = (v: number): string => (v > 0 ? `+${v}` : `${v}`);

function Swatch(props: { tier: strategic.StanceTier; size?: number }) {
  const s = props.size ?? 10;
  return <span className="inline-block shrink-0 rounded-[2px]" style={{ width: s, height: s, background: TIER_COLORS[props.tier] }} />;
}

/** −100…+100 bar with the tier bands underneath and a marker at the score. */
function StanceScale(props: { score: number; prev: number | null }) {
  const pos = (v: number) => `${((v + 100) / 200) * 100}%`;
  const bands: Array<[strategic.StanceTier, number, number]> = [
    ["ENEMY", -100, strategic.TIER_FLOOR.HOSTILE],
    ["HOSTILE", strategic.TIER_FLOOR.HOSTILE, strategic.TIER_FLOOR.COLD],
    ["COLD", strategic.TIER_FLOOR.COLD, strategic.TIER_FLOOR.NEUTRAL],
    ["NEUTRAL", strategic.TIER_FLOOR.NEUTRAL, strategic.TIER_FLOOR.FRIENDLY],
    ["FRIENDLY", strategic.TIER_FLOOR.FRIENDLY, strategic.TIER_FLOOR.ALLY],
    ["ALLY", strategic.TIER_FLOOR.ALLY, 100],
  ];
  return (
    <bdi dir="ltr" className="block w-full">
      <div className="relative h-3 w-full overflow-hidden rounded-[2px]">
        {bands.map(([tier, a, b]) => (
          <div key={tier} className="absolute inset-y-0" style={{ left: pos(a), width: `${((b - a) / 200) * 100}%`, background: TIER_COLORS[tier], opacity: 0.45 }} />
        ))}
        {props.prev !== null && props.prev !== props.score && (
          <div className="absolute inset-y-0 w-[2px] bg-fg2" style={{ left: pos(props.prev) }} />
        )}
        <div className="absolute -top-0.5 h-4 w-[3px] rounded-[1px] bg-white" style={{ left: `calc(${pos(props.score)} - 1px)` }} />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-fg2">
        <span className="num">−100</span>
        <span className="num">0</span>
        <span className="num">+100</span>
      </div>
    </bdi>
  );
}

function Delta(props: { now: number; prev: number | null; lang: Lang }) {
  if (props.prev === null || props.prev === props.now) return null;
  const d = props.now - props.prev;
  return (
    <span className={`num text-[11px] ${d > 0 ? "text-good-bright" : "text-bad-bright"}`} title={L.sinceLast[props.lang]}>
      {d > 0 ? "▲" : "▼"}
      {Math.abs(d)}
    </span>
  );
}

function DetailPanel(props: { id: strategic.ActorId; stances: Stances; prev: Stances | null; lang: Lang; onClose: () => void }) {
  const { id, stances, prev, lang } = props;
  const def = strategic.ACTOR_DEFS[id];
  const st = stances[id];
  const prevScore = prev === null ? null : prev[id].score;
  return (
    <div className="overlay w-[320px] rounded-[6px] border border-line0 bg-bg1/95 text-[13px]">
      <div className="flex items-start gap-2 border-b border-line0 px-3 py-2">
        <Swatch tier={st.tier} size={12} />
        <div className="min-w-0 flex-1 leading-[18px]">
          <div className="text-[15px] font-medium text-fg0">{def.name[lang]}</div>
          {def.entity !== undefined && <div className="text-[12px] text-fg1">{def.entity[lang]}</div>}
        </div>
        <button type="button" onClick={props.onClose} className="text-[12px] text-fg2 hover:text-fg0" aria-label={L.close[lang]}>
          ✕
        </button>
      </div>
      <div className="px-3 py-2">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="font-medium" style={{ color: TIER_COLORS[st.tier] === TIER_COLORS.NEUTRAL ? "#C9D1D9" : TIER_COLORS[st.tier] }}>
            {strategic.TIER_LABELS[st.tier][lang]}
          </span>
          <bdi className="num text-[18px] text-fg0">{signed(st.score)}</bdi>
          <Delta now={st.score} prev={prevScore} lang={lang} />
        </div>
        <StanceScale score={st.score} prev={prevScore} />
        <p className="mt-2 text-[12px] leading-[18px] text-fg1">{def.note[lang]}</p>
      </div>
      <div className="border-t border-line0 px-3 py-2">
        <div className="mb-1 text-[11px] text-fg2">{L.drivers[lang]}</div>
        <ul className="space-y-0.5">
          {st.drivers.map((d, i) => (
            <li key={i} className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="text-fg1">{d.label[lang]}</span>
              <bdi className={`num ${i === 0 ? "text-fg1" : d.delta > 0 ? "text-good-bright" : "text-bad-bright"}`}>{signed(d.delta)}</bdi>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-2 border-t border-line0 pt-0.5 text-[12px]">
            <span className="text-fg0">{L.total[lang]}</span>
            <bdi className="num text-fg0">{signed(st.score)}</bdi>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Ranking(props: { stances: Stances; prev: Stances | null; lang: Lang; onSelect: (id: strategic.ActorId) => void }) {
  const { stances, prev, lang } = props;
  const sorted = [...strategic.ACTOR_IDS].sort((a, b) => stances[b].score - stances[a].score);
  return (
    <div className="overlay flex max-h-full w-[260px] flex-col rounded-[6px] border border-line0 bg-bg1/95 text-[12px]">
      <div className="border-b border-line0 px-3 py-1.5 text-[11px] text-fg2">{L.ranking[lang]}</div>
      <ul className="min-h-0 overflow-y-auto py-1">
        {sorted.map((id) => (
          <li key={id}>
            <button type="button" onClick={() => props.onSelect(id)} className="flex w-full items-center gap-2 px-3 py-[3px] text-start hover:bg-bg3">
              <Swatch tier={stances[id].tier} />
              <span className="min-w-0 flex-1 truncate text-fg1">{strategic.ACTOR_DEFS[id].name[lang]}</span>
              <Delta now={stances[id].score} prev={prev === null ? null : prev[id].score} lang={lang} />
              <bdi className="num w-9 text-end text-fg0">{signed(stances[id].score)}</bdi>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Alliances() {
  const lang = useStore((s) => s.lang);
  const setScreen = useStore((s) => s.setScreen);
  const sim = useStrategic((s) => s.sim);
  const prevSim = useStrategic((s) => s.prevSim);
  const [selected, setSelected] = useState<strategic.ActorId | null>(null);
  const [showProxies, setShowProxies] = useState(true);

  const stances = useMemo(() => strategic.computeStances(sim), [sim]);
  const prev = useMemo(() => (prevSim === null ? null : strategic.computeStances(prevSim)), [prevSim]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(strategic.STANCE_TIERS.map((t) => [t, 0])) as Record<strategic.StanceTier, number>;
    for (const id of strategic.ACTOR_IDS) c[stances[id].tier] += 1;
    return c;
  }, [stances]);

  return (
    <div className="relative h-full w-full">
      <AllianceMap
        stances={stances}
        lang={lang}
        selected={selected}
        onSelect={setSelected}
        showProxies={showProxies}
        // legend + ranking sit on the start side (right in Hebrew); the powers strip at the bottom
        inset={{ x: lang === "he" ? 272 : -272, bottom: 90 }}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3">
        <div className="flex min-h-0 flex-1 items-start justify-between gap-3">
          {/* legend */}
          <div className="flex min-h-0 flex-col gap-3 self-stretch">
            <div className="overlay pointer-events-auto w-[260px] rounded-[6px] border border-line0 bg-bg1/95 px-3 py-2">
              <div className="text-[15px] leading-[22px] font-medium">{L.title[lang]}</div>
              <div className="mb-2 text-[11px] text-fg2">{L.subtitle[lang]}</div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span style={{ color: TIER_COLORS.ALLY }}>◀ {L.withUs[lang]}</span>
                <span style={{ color: TIER_COLORS.ENEMY }}>{L.againstUs[lang]} ▶</span>
              </div>
              <ul className="space-y-0.5 text-[12px]">
                {strategic.STANCE_TIERS.map((tier) => (
                  <li key={tier} className="flex items-center gap-2">
                    <Swatch tier={tier} size={12} />
                    <span className="flex-1 text-fg1">{strategic.TIER_LABELS[tier][lang]}</span>
                    <span className="num text-fg2">{counts[tier]}</span>
                  </li>
                ))}
              </ul>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-fg1">
                <input type="checkbox" checked={showProxies} onChange={(e) => setShowProxies(e.target.checked)} />
                <span className="inline-block h-0 w-4 border-t border-dashed" style={{ borderColor: "#F85149" }} />
                {L.proxies[lang]}
              </label>
              {sim.pendingCrisis !== null && (
                <div className="mt-2 animate-pulse rounded-[2px] border border-bad px-2 py-0.5 text-[12px] text-bad-bright">{L.crisis[lang]}</div>
              )}
              <button
                type="button"
                onClick={() => setScreen(sim.pendingCrisis !== null ? "tactical" : "cabinet")}
                className="mt-2 w-full rounded-[2px] border border-info px-2 py-1 text-[12px] text-info-bright hover:bg-bg3"
              >
                {L.toCabinet[lang]}
              </button>
            </div>
            <div className="pointer-events-auto flex min-h-0 flex-1">
              <Ranking stances={stances} prev={prev} lang={lang} onSelect={setSelected} />
            </div>
          </div>

          {selected !== null && (
            <div className="pointer-events-auto">
              <DetailPanel id={selected} stances={stances} prev={prev} lang={lang} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>

        {/* off-map powers */}
        <div className="overlay pointer-events-auto flex flex-wrap items-center gap-2 self-start rounded-[6px] border border-line0 bg-bg1/95 px-3 py-1.5 text-[12px]">
          <span className="text-[11px] text-fg2">{L.powers[lang]}</span>
          {OFF_MAP.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={`flex items-center gap-1.5 rounded-[2px] border px-1.5 py-0.5 hover:bg-bg3 ${selected === id ? "border-fg1" : "border-line0"}`}
            >
              <Swatch tier={stances[id].tier} />
              <span className="text-fg0">{strategic.ACTOR_DEFS[id].name[lang]}</span>
              <bdi className="num text-fg1">{signed(stances[id].score)}</bdi>
            </button>
          ))}
          <span className="ms-2 text-[10px] text-fg2">
            {L.hint[lang]} · {L.assumptions[lang]} · {GEO_SOURCE}
          </span>
        </div>
      </div>
    </div>
  );
}
