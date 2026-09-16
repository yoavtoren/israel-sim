/** Live telemetry: tracked projectile (velocity, interception probability,
 *  impact timer), engagement counters, attack-vector legend. */

import { useStore } from "../../store";
import { useStrategic } from "../../strategic/store";
import { BATTERIES } from "../../strategic/geo";
import {
  AFFILIATION, FACTION_COLORS, FACTION_NAMES, INTERCEPTOR_COLOR, KIND_NAMES, endTime, speedKmS,
  type Faction, type Launch,
} from "../../strategic/scenarios";

const MACH_KMS = 0.343;

function fmtCountdown(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px] leading-[18px]">
      <span className="text-fg1">{props.label}</span>
      <span className="text-fg0">{props.children}</span>
    </div>
  );
}

export function Telemetry() {
  const lang = useStore((s) => s.lang);
  const script = useStrategic((s) => s.script);
  const t = useStrategic((s) => s.t);
  const trackedId = useStrategic((s) => s.trackedId);
  const setTracked = useStrategic((s) => s.setTracked);

  const incoming = script.launches.filter((l) => AFFILIATION[l.faction] !== "friend");
  const active = incoming.filter((l) => t >= l.t0 && t < endTime(l));
  const launched = incoming.filter((l) => t >= l.t0).length;
  const intercepted = incoming.filter((l) => l.intercept?.success === true && t >= l.intercept.tHit).length;
  const impacts = incoming.filter((l) => l.intercept?.success !== true && t >= l.t0 + l.flight).length;
  const strikes = script.launches.filter((l) => AFFILIATION[l.faction] === "friend" && t >= l.t0 + l.flight).length;
  const units = script.units.filter((u) => t >= u.t0 && t < u.until);
  const hostileUnits = units.filter((u) => AFFILIATION[u.faction] === "hostile" && u.type !== "naval" && u.type !== "air").length;
  const moving = units.filter((u) => t >= u.t0 && t < u.t1).length;

  const tracked: Launch | undefined =
    script.launches.find((l) => l.id === trackedId) ??
    [...active].sort((a, b) => endTime(a) - endTime(b))[0];

  const he = lang === "he";

  return (
    <div className="flex w-[270px] flex-col gap-2">
      <div className="overlay rounded-[6px] border border-line0 bg-bg1/95 p-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-fg2">
          <span>{he ? "טלמטריה" : "Telemetry"}</span>
          {trackedId !== null && (
            <button type="button" className="text-info-bright hover:underline" onClick={() => setTracked(null)}>
              {he ? "מעקב אוטומטי" : "auto-track"}
            </button>
          )}
        </div>
        {tracked === undefined ? (
          <div className="text-[12px] text-fg2">{he ? "אין איומים באוויר · לחצו על מסלול למעקב" : "Nothing airborne · click a track to follow"}</div>
        ) : (
          (() => {
            const l = tracked;
            const kms = speedKmS(l);
            const ic = l.intercept;
            const battery = ic !== null ? BATTERIES[ic.battery] : null;
            const tImpact = l.t0 + l.flight;
            const status =
              t < l.t0 ? (he ? "טרם שוגר" : "not launched")
              : ic?.success === true && t >= ic.tHit ? (he ? "יורט" : "intercepted")
              : t >= tImpact ? (AFFILIATION[l.faction] === "friend" ? (he ? "פגיעה במטרה" : "on target") : he ? "פגיעה" : "impact")
              : he ? "בטיסה" : "in flight";
            const statusColor = status === (he ? "יורט" : "intercepted") ? "text-good-bright" : status === (he ? "פגיעה" : "impact") ? "text-bad-bright" : "text-warn-bright";
            return (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: FACTION_COLORS[l.faction] }} />
                  {KIND_NAMES[l.kind][lang]} · {FACTION_NAMES[l.faction][lang]}
                </div>
                <div className="mb-1 text-[12px] text-fg1">
                  {l.originName[lang]} → {l.targetName[lang]}
                </div>
                <Row label={he ? "מהירות" : "Velocity"}>
                  <span className="num">{kms.toFixed(2)} km/s · M{(kms / MACH_KMS).toFixed(1)}</span>
                </Row>
                {battery !== null && (
                  <Row label={he ? "סוללה" : "Battery"}>
                    <span style={{ color: INTERCEPTOR_COLOR }}>{battery.name[lang]}</span>
                  </Row>
                )}
                {battery !== null && (
                  <Row label={he ? "הסתברות יירוט (הערכה)" : "Intercept prob. (est.)"}>
                    <span className="num assumption" title={he ? "הנחת תצוגה, לא נתון מבצעי" : "Display assumption, not operational data"}>
                      {Math.round(battery.pk * 100)}%
                    </span>
                  </Row>
                )}
                <Row label={he ? "זמן לפגיעה" : "Impact timer"}>
                  <span className="num">{t < tImpact ? `T−${fmtCountdown((tImpact - Math.max(t, l.t0)) * l.compression)}` : "—"}</span>
                </Row>
                <Row label={he ? "סטטוס" : "Status"}>
                  <span className={statusColor}>{status}</span>
                </Row>
              </div>
            );
          })()
        )}
      </div>

      <div className="overlay grid grid-cols-2 gap-x-3 gap-y-1 rounded-[6px] border border-line0 bg-bg1/95 p-3 text-[12px]">
        <Row label={he ? "שוגרו" : "Launched"}><span className="num">{launched}</span></Row>
        <Row label={he ? "באוויר" : "Airborne"}><span className="num text-warn-bright">{active.length}</span></Row>
        <Row label={he ? "יורטו" : "Intercepted"}><span className="num text-good-bright">{intercepted}</span></Row>
        <Row label={he ? "פגיעות" : "Impacts"}><span className="num text-bad-bright">{impacts}</span></Row>
        <Row label={he ? "תקיפות שלנו" : "Our strikes"}><span className="num text-info-bright">{strikes}</span></Row>
        <Row label={he ? "כוחות עוינים" : "Hostile units"}><span className="num text-bad-bright">{hostileUnits}</span></Row>
        <Row label={he ? "כוחות בתנועה" : "Units moving"}><span className="num">{moving}</span></Row>
      </div>

      <div className="overlay rounded-[6px] border border-line0 bg-bg1/95 p-3 text-[11px] leading-[18px] text-fg1">
        {(["egypt", "gaza", "iran", "hezbollah", "militants", "idf"] as Faction[]).map((f) => (
          <div key={f} className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-4 rounded" style={{ background: FACTION_COLORS[f] }} />
            {f === "iran" ? (he ? "איראן / עיראק" : "Iran / Iraq") : FACTION_NAMES[f][lang]}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="inline-block h-[3px] w-4 rounded" style={{ background: INTERCEPTOR_COLOR }} />
          {he ? "מיירטים · מעטפות הגנה" : "Interceptors · defense envelopes"}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className="inline-block h-3 w-4 border-[1.5px] border-[#80E0FF]" /> {he ? "ידידותי" : "Friendly"}
          <span className="inline-block h-3 w-3 rotate-45 border-[1.5px] border-[#FF8080]" /> {he ? "עוין" : "Hostile"}
          <span className="inline-block h-3 w-3 border-[1.5px] border-[#AAFFAA]" /> {he ? "ניטרלי" : "Neutral"}
        </div>
        <div className="mt-1 text-fg2">{he ? "גבולות Natural Earth · מסלולים מסוגננים · כטב\"מים ושיוט בדחיסת זמן" : "Natural Earth borders · stylized trajectories · drones & cruise time-compressed"}</div>
      </div>
    </div>
  );
}
