/** Tactical situation room: the map fills the screen; telemetry, camera and
 *  sound controls float above it; the timeline docks at the bottom. Whenever
 *  the crisis engine halts playback the screen edge flashes red and the
 *  crisis decision modal opens over the focal zone. */

import { useStore } from "../store";
import { useStrategic, type CameraMode } from "../strategic/store";
import { sound } from "../strategic/sound";
import { TacticalMap } from "../components/tactical/TacticalMap";
import { TimelineController, usePlaybackDriver } from "../components/tactical/TimelineController";
import { Telemetry } from "../components/tactical/Telemetry";
import { CrisisDecisionModal } from "../components/tactical/CrisisDecisionModal";

const CAMERA_LABELS: Record<CameraMode, { he: string; en: string }> = {
  auto: { he: "אוטומטי", en: "Auto" },
  theater: { he: "זירה", en: "Theater" },
  israel: { he: "ישראל", en: "Israel" },
  tel_aviv: { he: "גוש דן", en: "Gush Dan" },
  west_bank: { he: "יו\"ש", en: "West Bank" },
  gaza: { he: "עזה", en: "Gaza" },
  sinai: { he: "סיני", en: "Sinai" },
};

export function Tactical() {
  usePlaybackDriver();
  const lang = useStore((s) => s.lang);
  const cameraMode = useStrategic((s) => s.cameraMode);
  const setCameraMode = useStrategic((s) => s.setCameraMode);
  const soundOn = useStrategic((s) => s.soundOn);
  const setSound = useStrategic((s) => s.setSound);
  const crisisHalted = useStrategic((s) => s.sim.pendingCrisis !== null && s.script.haltAt !== null && s.t >= s.script.haltAt);
  const crisisKey = useStrategic((s) => (s.sim.pendingCrisis === null ? "" : `${s.sim.pendingCrisis.id}:${s.sim.turn}`));

  return (
    <div className="relative h-full w-full">
      <TacticalMap />

      {crisisHalted && (
        <div key={crisisKey} className="crisis-flash pointer-events-none absolute inset-0 z-20" aria-hidden="true" />
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto">
            <Telemetry />
          </div>
          <div className="glass overlay pointer-events-auto flex flex-wrap items-center gap-1 rounded-full border border-line0 py-1 ps-3.5 pe-1 text-[13px]">
            <span className="eyebrow me-1">{lang === "he" ? "מצלמה" : "Camera"}</span>
            {(Object.keys(CAMERA_LABELS) as CameraMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCameraMode(m)}
                className={`rounded-full px-2.5 leading-[28px] transition-colors ${cameraMode === m ? "bg-info-dim font-medium text-info-bright" : "text-fg1 hover:bg-bg2 hover:text-fg0"}`}
              >
                {CAMERA_LABELS[m][lang]}
              </button>
            ))}
            <span className="mx-1 h-5 border-s border-line0" />
            <button
              type="button"
              onClick={() => {
                sound.unlock();
                setSound(!soundOn);
              }}
              className={`rounded-full px-2.5 leading-[28px] transition-colors ${soundOn ? "bg-warn-dim font-medium text-warn-bright" : "text-fg1 hover:bg-bg2 hover:text-fg0"}`}
              aria-pressed={soundOn}
            >
              {soundOn ? (lang === "he" ? "🔊 קול" : "🔊 Sound") : lang === "he" ? "🔇 קול" : "🔇 Sound"}
            </button>
          </div>
        </div>
        <div className="pointer-events-auto mt-auto">
          <TimelineController />
        </div>
      </div>

      <CrisisDecisionModal />
    </div>
  );
}
