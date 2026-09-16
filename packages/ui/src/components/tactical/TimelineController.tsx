/** Scrubbable playback timeline: play/pause, speed, date/time clock, event
 *  markers. Also hosts the playback driver (rAF clock, crisis halt, audio). */

import { useEffect } from "react";
import { useStore } from "../../store";
import { SIM_RATE, SPEEDS, useStrategic } from "../../strategic/store";
import { AFFILIATION, endTime, type MarkerKind } from "../../strategic/scenarios";
import { sound } from "../../strategic/sound";

const MARKER_COLOR: Record<MarkerKind, string> = {
  info: "#93A4B5",
  alert: "#E3B341",
  mobilize: "#F0883E",
  launch: "#F85149",
  intercept: "#56D4DD",
  impact: "#F0883E",
  halt: "#F85149",
  strike: "#58A6FF",
  ceasefire: "#3FB950",
  crisis: "#F85149",
  success: "#3FB950",
  failure: "#F85149",
};

/** rAF playback clock; mount once while the tactical screen is visible. */
export function usePlaybackDriver(): void {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = useStrategic.getState();
      if (s.playing) {
        const prev = s.t;
        let t = prev + dt * SIM_RATE * s.speed;
        let playing = true;
        let modalOpen = s.modalOpen;
        const halt = s.script.haltAt;
        if (halt !== null && s.sim.pendingCrisis !== null && t >= halt) {
          t = halt;
          playing = false;
          modalOpen = true;
          if (s.soundOn) sound.crisisChime();
        }
        if (t >= s.script.duration) {
          t = s.script.duration;
          playing = false;
        }
        if (s.soundOn) {
          for (const m of s.script.markers) if (m.kind !== "halt" && m.t > prev && m.t <= t) sound.forMarker(m.kind);
          const crossed = (x: number) => x > prev && x <= t;
          if (s.script.launches.some((l) => l.intercept?.success === true && crossed(l.intercept.tHit))) sound.intercept();
          if (s.script.launches.some((l) => AFFILIATION[l.faction] !== "friend" && l.intercept?.success !== true && crossed(l.t0 + l.flight))) sound.impact();
        }
        useStrategic.setState({ t, playing, modalOpen });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

function fmtClock(iso: string, t: number, lang: "he" | "en"): string {
  const d = new Date(new Date(iso).getTime() + t * 1000);
  return d.toLocaleString(lang === "he" ? "he-IL" : "en-GB", {
    timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function fmtT(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `T+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimelineController() {
  const lang = useStore((s) => s.lang);
  const script = useStrategic((s) => s.script);
  const t = useStrategic((s) => s.t);
  const playing = useStrategic((s) => s.playing);
  const speed = useStrategic((s) => s.speed);
  const sim = useStrategic((s) => s.sim);
  const modalOpen = useStrategic((s) => s.modalOpen);
  const setT = useStrategic((s) => s.setT);
  const setPlaying = useStrategic((s) => s.setPlaying);
  const setSpeed = useStrategic((s) => s.setSpeed);
  const setModalOpen = useStrategic((s) => s.setModalOpen);

  const halted = script.haltAt !== null && sim.pendingCrisis !== null && t >= script.haltAt;
  const active = script.launches.filter((l) => AFFILIATION[l.faction] !== "friend" && t >= l.t0 && t < endTime(l)).length;

  return (
    <div className="overlay rounded-[6px] border border-line0 bg-bg1/95 px-3 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            sound.unlock();
            if (halted) setModalOpen(true);
            else setPlaying(!playing);
          }}
          className={`h-8 min-w-8 rounded-[4px] border px-2 text-[14px] ${halted ? "border-bad text-bad-bright" : "border-line1 bg-bg2 text-fg0 hover:bg-bg3"}`}
          aria-label={playing ? "pause" : "play"}
        >
          {halted ? (lang === "he" ? "הכרעה" : "Decide") : playing ? "❚❚" : "▶"}
        </button>
        <div className="flex gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`num rounded-[2px] border px-1.5 py-0.5 text-[11px] ${speed === s ? "border-info text-info-bright" : "border-line0 text-fg1 hover:bg-bg3"}`}
            >
              {s}×
            </button>
          ))}
        </div>
        <div className="flex flex-col leading-[16px]">
          <span className="num text-[13px] text-fg0">{fmtClock(script.baseTime, t, lang)}</span>
          <span className="num text-[11px] text-fg2">{fmtT(t)}</span>
        </div>
        <div className="ms-auto flex items-center gap-3 text-[12px] text-fg1">
          <span>{script.title[lang]}</span>
          {active > 0 && (
            <span className="num rounded-[2px] border border-bad px-1.5 text-bad-bright">
              {active} {lang === "he" ? "באוויר" : "airborne"}
            </span>
          )}
          {halted && !modalOpen && (
            <button type="button" className="rounded-[2px] border border-bad px-2 py-0.5 text-bad-bright hover:bg-bad-dim/40" onClick={() => setModalOpen(true)}>
              {lang === "he" ? "פתח חדר הכרעה" : "Open decision"}
            </button>
          )}
        </div>
      </div>

      <bdi dir="ltr" className="relative mt-2 block h-7">
        {/* event markers */}
        <div className="pointer-events-none absolute inset-x-[5px] top-0 h-3">
          {script.markers.map((m, i) => (
            <span
              key={i}
              title={`${fmtT(m.t)} · ${m.label[lang]}`}
              className="pointer-events-auto absolute top-0 h-3 w-[3px] -translate-x-1/2 cursor-pointer rounded-[1px]"
              style={{ left: `${(m.t / script.duration) * 100}%`, background: MARKER_COLOR[m.kind], width: m.kind === "halt" ? 5 : 3 }}
              onClick={() => setT(m.t)}
            />
          ))}
          {script.haltAt !== null && sim.pendingCrisis !== null && (
            <span
              className="absolute top-3 h-4 -translate-x-1/2 border-s border-dashed border-bad"
              style={{ left: `${(script.haltAt / script.duration) * 100}%` }}
            />
          )}
        </div>
        <input
          type="range"
          min={0}
          max={script.duration}
          step={0.5}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="absolute inset-x-0 bottom-1 w-full"
          aria-label="timeline"
        />
      </bdi>

      {/* latest marker caption */}
      <div className="mt-0.5 h-4 truncate text-[11px] leading-[16px] text-fg1">
        {(() => {
          const past = script.markers.filter((m) => m.t <= t);
          const m = past[past.length - 1];
          return m === undefined ? "" : `${fmtT(m.t)} · ${m.label[lang]}`;
        })()}
      </div>
    </div>
  );
}
