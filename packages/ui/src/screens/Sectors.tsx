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

  const totalPop = ORDER.reduce((a, id) => a + now.sectors[id].population, 0);

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      {/* population composition */}
      <section className="panel px-5 py-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="display text-[19px] leading-[26px]">{lang === "he" ? "חמישה מגזרים, חברה אחת" : "Five sectors, one society"}</h2>
          <span className="text-[12.5px] text-fg2">
            {lang === "he" ? "אוכלוסייה" : "Population"} <span className="num font-medium text-fg0">{fmtCompact(totalPop, 2)}</span>
          </span>
        </div>
        <bdi dir="ltr" className="block">
          <div className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full">
            {ORDER.map((id) => (
              <div key={id} className="h-full first:rounded-s-full last:rounded-e-full" style={{ width: `${(now.sectors[id].population / totalPop) * 100}%`, background: SECTOR_COLORS[id] }} />
            ))}
          </div>
        </bdi>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          {ORDER.map((id) => (
            <span key={id} className="flex items-center gap-1.5 text-[12.5px] text-fg1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SECTOR_COLORS[id] }} />
              {SECTOR_NAMES[id][lang]}
              <span className="num text-fg2">{fmtPct(now.sectors[id].population / totalPop, 0)}</span>
            </span>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {ORDER.map((id) => {
          const s = now.sectors[id];
          const grievanceHistory = frames.slice(-24).map((f) => f.sectors[id].grievance);
          const gTone = s.grievance > 0.6 ? SEM.bad : s.grievance > 0.4 ? SEM.warn : SEM.good;
          return (
            <section key={id} className="panel overflow-hidden">
              <div className="h-1 w-full" style={{ background: SECTOR_COLORS[id] }} />
              <header className="flex items-center gap-2.5 px-5 pt-4 pb-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: SECTOR_COLORS[id] }} />
                <span className="display text-[19px] leading-[26px]">{SECTOR_NAMES[id][lang]}</span>
                <span className="ms-auto flex items-baseline gap-1.5 text-[12px] text-fg2">
                  {lang === "he" ? "תושבים" : "residents"}
                  <span className="num text-[14px] font-medium text-fg1">{fmtCompact(s.population, 2)}</span>
                </span>
              </header>
              <div className="grid grid-cols-2 gap-3 px-5 pt-2">
                <KV label={t("poverty", lang)} path={`sectors.${id}.poverty_rate`} value={fmtPct(s.poverty_rate, 1)} raw={s.poverty_rate} dir={-1} />
                <KV label={t("income", lang)} path={`sectors.${id}.income_median`} value={`₪${fmtInt(s.income_median)}`} raw={s.income_median} dir={1} />
                <KV
                  label={`${t("participation", lang)} (${lang === "he" ? "ג/נ" : "M/W"})`}
                  path={`sectors.${id}.labour_participation`}
                  value={`${fmtPct(s.participation_men, 0)} · ${fmtPct(s.participation_women, 0)}`}
                  raw={s.participation_men + s.participation_women}
                  dir={1}
                />
                <KV label={t("approval", lang)} path={`politics.approval_by_sector.${id}`} value={fmtPct(s.approval, 0)} raw={s.approval} dir={1} />
              </div>
              <div className="px-5 pt-4 pb-5">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-[13px] text-fg1">{t("grievance", lang)}</span>
                  <span className="num text-[14px] font-medium" style={{ color: s.grievance > 0.6 ? SEM.badBright : s.grievance > 0.4 ? SEM.warnBright : SEM.goodBright }}>
                    {fmtPct(s.grievance, 0)}
                  </span>
                </div>
                <GaugeBar value={s.grievance} color={gTone} height={8} />
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line0 pt-3">
                  <span className="text-[12px] text-fg2">{lang === "he" ? "תרעומת, 6 שנים" : "Grievance, 6y"}</span>
                  <Sparkline values={grievanceHistory} color={SECTOR_COLORS[id]} width={150} height={26} />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KV(props: { label: string; path: string; value: string; raw: number; dir: number }) {
  return (
    <div className="flex flex-col rounded-[10px] bg-bg2 px-3 py-2">
      <span className="text-[12px] leading-[18px] text-fg1">{props.label}</span>
      <Traceable path={props.path} className="self-start">
        <Num value={props.value} raw={props.raw} direction={props.dir} className="text-[17px] leading-[24px] font-medium" />
      </Traceable>
    </div>
  );
}
