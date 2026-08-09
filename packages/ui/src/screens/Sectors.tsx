/** Sector cards — fixed sector palette everywhere (DESIGN §1). */

import type { SectorId } from "@engine";
import { useStore } from "../store";
import { SECTOR_NAMES, t } from "../lib/strings";
import { fmtCompact, fmtInt, fmtPct } from "../lib/format";
import { SECTOR_COLORS, SEM } from "../lib/colors";
import { GaugeBar, Num, Sparkline } from "../components/ui";
import { Traceable } from "../components/CausalTrace";

const ORDER: SectorId[] = ["secular", "national_religious", "haredi", "arab", "other"];

export function Sectors() {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  const frames = useStore((s) => s.frames);
  if (state === null || frames.length === 0) return null;
  const now = frames[frames.length - 1];

  return (
    <div className="grid grid-cols-2 gap-4 2xl:grid-cols-3">
      {ORDER.map((id) => {
        const s = now.sectors[id];
        const grievanceHistory = frames.slice(-24).map((f) => f.sectors[id].grievance);
        return (
          <section key={id} className="panel">
            <header className="flex items-center gap-2 border-b border-line0 px-3 py-2" style={{ borderTop: `2px solid ${SECTOR_COLORS[id]}` }}>
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: SECTOR_COLORS[id] }} />
              <span className="text-[15px] font-medium">{SECTOR_NAMES[id][lang]}</span>
              <span className="num ms-auto text-[13px] text-fg1">{fmtCompact(s.population, 2)}</span>
            </header>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-[12px]">
              <KV label={t("poverty", lang)} path={`sectors.${id}.poverty_rate`} value={fmtPct(s.poverty_rate, 1)} raw={s.poverty_rate} dir={-1} />
              <KV label={t("income", lang)} path={`sectors.${id}.income_median`} value={`₪${fmtInt(s.income_median)}`} raw={s.income_median} dir={1} />
              <KV
                label={`${t("participation", lang)} (${lang === "he" ? "ג/נ" : "M/W"})`}
                path={`sectors.${id}.labour_participation`}
                value={`${fmtPct(s.participation_men, 0)}·${fmtPct(s.participation_women, 0)}`}
                raw={s.participation_men + s.participation_women}
                dir={1}
              />
              <KV label={t("approval", lang)} path={`politics.approval_by_sector.${id}`} value={fmtPct(s.approval, 0)} raw={s.approval} dir={1} />

              <div className="col-span-2">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-fg2">{t("grievance", lang)}</span>
                  <span className="num text-fg1">{fmtPct(s.grievance, 0)}</span>
                </div>
                <GaugeBar value={s.grievance} color={s.grievance > 0.6 ? SEM.badBright : s.grievance > 0.4 ? SEM.warnBright : SEM.good} height={6} />
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-line0 pt-2">
                <span className="text-[11px] text-fg2">{lang === "he" ? "תרעומת, 6 שנים" : "Grievance, 6y"}</span>
                <Sparkline values={grievanceHistory} color={SECTOR_COLORS[id]} width={140} height={20} />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KV(props: { label: string; path: string; value: string; raw: number; dir: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] leading-[16px] text-fg2">{props.label}</span>
      <Traceable path={props.path}>
        <Num value={props.value} raw={props.raw} direction={props.dir} className="text-[13px]" />
      </Traceable>
    </div>
  );
}
