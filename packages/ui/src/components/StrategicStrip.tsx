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
    <header className="flex items-center gap-6 border-b border-line0 bg-bg0 px-6 py-3">
      <div className="me-2 flex flex-col">
        <span className="display text-[20px] leading-[26px]">{half[lang]}</span>
        <span className="text-[12px] leading-[18px] text-fg2">{strategic.COALITION_LABELS[sim.coalition][lang]}</span>
      </div>
      {strategic.METRIC_KEYS.map((k) => {
        const v = sim.metrics[k];
        const good = strategic.METRIC_POLARITY[k] === 1 ? v : 100 - v;
        return (
          <div key={k} className="flex flex-col items-center">
            <Num value={v.toFixed(0)} raw={v} direction={strategic.METRIC_POLARITY[k]} className="text-[18px] leading-[24px] font-medium" />
            <span className="flex items-center gap-1.5 text-[12px] leading-[16px] text-fg1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: good >= 55 ? SEM.good : good >= 35 ? SEM.warn : SEM.bad }} />
              {SHORT[k][lang]}
            </span>
          </div>
        );
      })}
      {sim.pendingCrisis !== null && (
        <span className="ms-auto flex animate-pulse items-center gap-1.5 rounded-full bg-bad-dim px-3 py-1 text-[12.5px] font-medium text-bad-bright">
          <span className="inline-block h-2 w-2 rounded-full bg-bad" />
          {lang === "he" ? "משבר פתוח" : "Crisis open"}
        </span>
      )}
      {sim.gameOver && (
        <span className={`ms-auto rounded-full px-3 py-1 text-[12.5px] font-medium ${sim.outcome === "TERM_COMPLETED" ? "bg-good-dim text-good-bright" : "bg-bad-dim text-bad-bright"}`}>
          {lang === "he" ? "הקדנציה הסתיימה" : "Term over"}
        </span>
      )}
    </header>
  );
}
