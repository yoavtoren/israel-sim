/** Screen 3 — The Security Board (DESIGN §6.3): stockpile gauges with
 *  quarters-of-supply, fronts strip, readiness/deterrence dials with ghosts,
 *  threat matrix with 8-quarter trend arrows, security event ticker.
 */

import type { MunitionClass } from "@engine";
import { useStore } from "../store";
import { ADVERSARY_NAMES, MUNITION_NAMES, t } from "../lib/strings";
import { fmtInt, fmtPct } from "../lib/format";
import { EventFeed } from "./Overview";
import { DOMAIN, SEM, bandColor } from "../lib/colors";
import { Dial, GaugeBar, Num, Panel, TrendArrow } from "../components/ui";
import { Traceable } from "../components/CausalTrace";

const MUNITIONS: MunitionClass[] = ["interceptors", "precision_guided", "artillery_shells"];

export function Security() {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  const frames = useStore((s) => s.frames);
  const feed = useStore((s) => s.feed);
  if (state === null || frames.length === 0) return null;

  const now = frames[frames.length - 1];
  const ghost = frames[Math.max(0, frames.length - 5)];
  const first = frames[0];
  const qos = now.quarters_of_supply;

  const fmtQos = Number.isFinite(qos) ? qos.toFixed(1) : "∞";
  const qosTone = qos < 4 ? "bg-bad-dim text-bad-bright" : qos < 8 ? "bg-warn-dim text-warn-bright" : "bg-good-dim text-good-bright";

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* left: stockpile gauges */}
      <Panel title={t("stockpiles", lang)} accent={DOMAIN.security}>
        <div className="flex flex-col gap-5">
          {MUNITIONS.map((m) => {
            const cap = Math.max(first.stockpiles[m], 1);
            const v = now.stockpiles[m];
            return (
              <div key={m}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-fg1">{MUNITION_NAMES[m][lang]}</span>
                  <Traceable path={`security.stockpiles.${m}`}>
                    <Num value={fmtInt(v)} raw={v} direction={1} className="text-[15px] font-medium" />
                  </Traceable>
                </div>
                <GaugeBar value={v / cap} color={bandColor(v / cap, 0.5, 0.25)} height={8} />
                <div className="mt-1 text-[12px] leading-[16px] text-fg2">
                  <span className="num">{fmtPct(v / cap, 0)}</span> {lang === "he" ? "מהמלאי ההתחלתי" : "of starting stock"}
                </div>
              </div>
            );
          })}
          <div className={`rounded-[12px] px-4 py-3 ${qosTone}`}>
            <div className="text-[12.5px] leading-[18px] opacity-90">{t("quartersOfSupply", lang)}</div>
            <div className="flex items-baseline gap-2">
              <Num value={fmtQos} raw={Number.isFinite(qos) ? qos : 9999} direction={1} className="text-[30px] leading-[38px] font-medium" />
              <span className="text-[12px]">{lang === "he" ? "רבעונים" : "quarters"}</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* center: fronts + dials */}
      <div className="flex min-w-0 flex-col gap-5">
        <Panel title={t("fronts", lang)} accent={DOMAIN.security}>
          {now.fronts.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-[10px] bg-good-dim/60 py-4 text-[13px] text-good-bright">
              <span className="inline-block h-2 w-2 rounded-full bg-good" />
              {t("noActiveFronts", lang)}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {now.fronts.map((f) => (
                <div key={f.id} className="flex items-center gap-4">
                  <span className="w-40 truncate text-[13px] font-medium text-fg0">{f.id}</span>
                  <div className="flex-1">
                    <GaugeBar value={f.intensity} color={SEM.bad} height={8} />
                  </div>
                  <span className="num w-10 text-end text-[13px] text-bad-bright">{fmtPct(f.intensity, 0)}</span>
                </div>
              ))}
              <div className="mt-1 flex items-baseline gap-2 border-t border-line0 pt-3 text-[13px] text-fg1">
                {lang === "he" ? "נפגעים מצטברים" : "Cumulative casualties"}
                <span className="num text-[17px] font-medium text-bad-bright">{fmtInt(now.war_casualties)}</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel title={`${t("readiness", lang)} · ${t("deterrence", lang)}`} accent={DOMAIN.security}>
          <div className="flex flex-wrap items-start justify-around gap-4 pt-1">
            <Traceable path="security.force_readiness">
              <Dial value={now.readiness} ghost={ghost.readiness} label={t("readiness", lang)} color={bandColor(now.readiness, 0.6, 0.4)} size={132} />
            </Traceable>
            <Traceable path="security.deterrence_index">
              <Dial value={now.deterrence} ghost={ghost.deterrence} label={t("deterrence", lang)} color={bandColor(now.deterrence, 0.5, 0.3)} size={132} />
            </Traceable>
            <Traceable path="security.reserve_mobilization">
              <Dial value={now.mobilization} ghost={ghost.mobilization} label={lang === "he" ? "גיוס מילואים" : "Mobilization"} color={SEM.warn} size={132} />
            </Traceable>
          </div>
          <div className="mt-3 text-center text-[12px] text-fg2">
            {lang === "he" ? "מחוג מקווקו: הערך לפני שנה" : "Dashed needle: value a year ago"}
          </div>
        </Panel>

        {/* security events */}
        <Panel title={t("eventTicker", lang)} accent={DOMAIN.security} className="min-h-0">
          <EventFeed feed={feed} lang={lang} maxHeight="max-h-64" />
        </Panel>
      </div>

      {/* right: threat matrix */}
      <Panel title={t("threatMatrix", lang)} accent={DOMAIN.security}>
        <div className="flex flex-col gap-1">
          {Object.entries(now.threat).map(([adv, level]) => {
            const back = frames[Math.max(0, frames.length - 9)];
            const delta = level - (back.threat[adv] ?? level);
            return (
              <div key={adv} className="-mx-2 rounded-[10px] px-2 py-2 hover:bg-bg2">
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg0">{ADVERSARY_NAMES[adv]?.[lang] ?? adv}</span>
                  <span className="num text-[13px]">
                    <TrendArrow delta={delta} goodDir={-1} />
                  </span>
                  <span className="num w-10 text-end text-[14px] font-medium text-fg0">{fmtPct(level, 0)}</span>
                </div>
                <bdi dir="ltr" className="block">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-bg3">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, level * 100)}%`, background: level > 0.66 ? SEM.bad : level > 0.33 ? SEM.warn : SEM.good }} />
                  </div>
                </bdi>
              </div>
            );
          })}
          <div className="mt-3 border-t border-line0 pt-3 text-[12px] leading-[18px] text-fg2">
            {lang === "he" ? "חץ: מגמת 8 רבעונים" : "Arrow: 8-quarter trend"}
          </div>
        </div>
      </Panel>
    </div>
  );
}
