/** Screen 3 — The Security Board (DESIGN §6.3): stockpile gauges with
 *  quarters-of-supply, fronts strip, readiness/deterrence dials with ghosts,
 *  threat matrix with 8-quarter trend arrows, security event ticker.
 */

import type { MunitionClass } from "@engine";
import { useStore } from "../store";
import { ADVERSARY_NAMES, MUNITION_NAMES, t } from "../lib/strings";
import { fmtInt, fmtPct, fmtQuarter } from "../lib/format";
import { DOMAIN, SEM, threatColor, bandColor } from "../lib/colors";
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
  const qosColor = qos < 4 ? SEM.badBright : qos < 8 ? SEM.warnBright : SEM.good;

  return (
    <div className="grid grid-cols-[320px_1fr_300px] gap-4">
      {/* left: stockpile gauges */}
      <Panel title={t("stockpiles", lang)} accent={DOMAIN.security}>
        <div className="flex flex-col gap-4">
          {MUNITIONS.map((m) => {
            const cap = Math.max(first.stockpiles[m], 1);
            const v = now.stockpiles[m];
            return (
              <div key={m}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[12px] text-fg1">{MUNITION_NAMES[m][lang]}</span>
                  <Traceable path={`security.stockpiles.${m}`}>
                    <Num value={fmtInt(v)} raw={v} direction={1} className="text-[13px]" />
                  </Traceable>
                </div>
                <GaugeBar value={v / cap} color={bandColor(v / cap, 0.5, 0.25)} height={10} />
              </div>
            );
          })}
          <div className="border-t border-line0 pt-3">
            <span className="text-[12px] text-fg1">{t("quartersOfSupply", lang)}: </span>
            <Num
              value={Number.isFinite(qos) ? qos.toFixed(1) : "∞"}
              raw={Number.isFinite(qos) ? qos : 9999}
              direction={1}
              className="text-[24px] leading-[32px]"
            />
            <span className="ms-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: qosColor }} />
          </div>
        </div>
      </Panel>

      {/* center: fronts + dials */}
      <div className="flex flex-col gap-4">
        <Panel title={t("fronts", lang)} accent={DOMAIN.security}>
          {now.fronts.length === 0 ? (
            <div className="py-2 text-center text-[13px] text-fg2">{t("noActiveFronts", lang)}</div>
          ) : (
            <div className="flex flex-col gap-2">
              {now.fronts.map((f) => (
                <div key={f.id} className="flex items-center gap-3">
                  <span className="w-40 text-[13px] text-bad-bright">{f.id}</span>
                  <div className="flex-1">
                    <GaugeBar value={f.intensity} color={SEM.badBright} height={8} />
                  </div>
                  <span className="num text-[12px] text-fg1">{fmtPct(f.intensity, 0)}</span>
                </div>
              ))}
              <div className="mt-1 text-[12px] text-fg2">
                {lang === "he" ? "נפגעים מצטברים" : "Cumulative casualties"}:{" "}
                <span className="num text-bad-bright">{fmtInt(now.war_casualties)}</span>
              </div>
            </div>
          )}
        </Panel>

        <Panel title={`${t("readiness", lang)} · ${t("deterrence", lang)}`} accent={DOMAIN.security}>
          <div className="flex items-start justify-around">
            <Traceable path="security.force_readiness">
              <Dial value={now.readiness} ghost={ghost.readiness} label={t("readiness", lang)} color={bandColor(now.readiness, 0.6, 0.4)} />
            </Traceable>
            <Traceable path="security.deterrence_index">
              <Dial value={now.deterrence} ghost={ghost.deterrence} label={t("deterrence", lang)} color={bandColor(now.deterrence, 0.5, 0.3)} />
            </Traceable>
            <Traceable path="security.reserve_mobilization">
              <Dial value={now.mobilization} ghost={ghost.mobilization} label={lang === "he" ? "גיוס מילואים" : "Mobilization"} color={SEM.warnBright} />
            </Traceable>
          </div>
        </Panel>

        {/* bottom ticker: security events, mono timestamps (DESIGN §6.3) */}
        <Panel title={t("eventTicker", lang)} accent={DOMAIN.security} className="min-h-0">
          <div className="max-h-56 overflow-y-auto">
            {feed.length === 0 ? (
              <div className="text-[12px] text-fg2">—</div>
            ) : (
              [...feed].reverse().map((e, i) => (
                <div key={i} className="flex gap-3 border-b border-line0/40 py-1 text-[12px] leading-[16px] last:border-0" title={e.note}>
                  <span className="num shrink-0 text-fg2">{fmtQuarter(e.year, e.quarter)}</span>
                  <span className="num text-fg1">
                    {e.id}
                    {e.count > 1 && <span className="text-fg2"> ×{e.count}</span>}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* right: threat matrix */}
      <Panel title={t("threatMatrix", lang)} accent={DOMAIN.security}>
        <div className="flex flex-col gap-2">
          {Object.entries(now.threat).map(([adv, level]) => {
            const back = frames[Math.max(0, frames.length - 9)];
            const delta = level - (back.threat[adv] ?? level);
            return (
              <div key={adv} className="flex items-center gap-2">
                <span className="w-28 text-[12px] text-fg1">{ADVERSARY_NAMES[adv]?.[lang] ?? adv}</span>
                <div
                  className="flex h-8 flex-1 items-center justify-center rounded-[2px] border border-line0"
                  style={{ background: threatColor(level) }}
                >
                  <span className="num text-[13px] text-fg0">{fmtPct(level, 0)}</span>
                </div>
                <span className="num w-6 text-center text-[13px]">
                  <TrendArrow delta={delta} goodDir={-1} />
                </span>
              </div>
            );
          })}
          <div className="mt-2 border-t border-line0 pt-2 text-[11px] leading-[16px] text-fg2">
            {lang === "he" ? "חץ: מגמת 8 רבעונים" : "Arrow: 8-quarter trend"}
          </div>
        </div>
      </Panel>
    </div>
  );
}
