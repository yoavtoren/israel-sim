/** Top strip for the strategic screens: half-year clock, government, and the
 *  seven metrics at a glance. */

import { strategic } from "@engine";
import { useStore } from "../store";
import { useStrategic } from "../strategic/store";
import { Num } from "./ui";
import { SEM } from "../lib/colors";

const SHORT: Record<strategic.MetricKey, { he: string; en: string }> = {
  securityThreat: { he: "איום", en: "Threat" },
  internationalLegitimacy: { he: "לגיטימציה", en: "Legitimacy" },
  usMilitaryAid: { he: "סיוע ארה\"ב", en: "US aid" },
  economicStability: { he: "כלכלה", en: "Economy" },
  regionalRelations: { he: "אזורי", en: "Regional" },
  coalitionStability: { he: "קואליציה", en: "Coalition" },
  internalCohesion: { he: "לכידות", en: "Cohesion" },
};

export function StrategicStrip() {
  const lang = useStore((s) => s.lang);
  const sim = useStrategic((s) => s.sim);
  const half = strategic.halfYearLabel(sim.turn);
  return (
    <header className="flex items-center gap-5 border-b border-line0 bg-bg1 px-4 py-2">
      <div className="flex flex-col leading-[18px]">
        <span className="text-[18px] leading-[26px] font-medium">{half[lang]}</span>
        <span className="text-[11px] text-fg2">{strategic.COALITION_LABELS[sim.coalition][lang]}</span>
      </div>
      {strategic.METRIC_KEYS.map((k) => {
        const v = sim.metrics[k];
        const good = strategic.METRIC_POLARITY[k] === 1 ? v : 100 - v;
        return (
          <div key={k} className="flex flex-col items-center leading-[16px]">
            <Num value={v.toFixed(0)} raw={v} direction={strategic.METRIC_POLARITY[k]} className="text-[16px]" />
            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-fg1">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: good >= 55 ? SEM.good : good >= 35 ? SEM.warn : SEM.bad }} />
              {SHORT[k][lang]}
            </span>
          </div>
        );
      })}
      {sim.pendingCrisis !== null && (
        <span className="ms-auto animate-pulse rounded-[2px] border border-bad px-2 py-0.5 text-[12px] text-bad-bright">
          {lang === "he" ? "משבר פתוח" : "Crisis open"}
        </span>
      )}
      {sim.gameOver && (
        <span className={`ms-auto rounded-[2px] border px-2 py-0.5 text-[12px] ${sim.outcome === "TERM_COMPLETED" ? "border-good text-good-bright" : "border-bad text-bad-bright"}`}>
          {lang === "he" ? "הקדנציה הסתיימה" : "Term over"}
        </span>
      )}
    </header>
  );
}
