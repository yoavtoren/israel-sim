/** The Strategic Cabinet: pick a coalition, decide a policy track every
 *  half-year, watch the seven metrics, the trusteeship checkpoints and the
 *  cabinet log. Decisions preview live (same reducer, no random draws). */

import { useMemo } from "react";
import { strategic } from "@engine";
import { useStore } from "../store";
import { useStrategic } from "../strategic/store";
import { Chip, GaugeBar, Num, Panel, Sparkline } from "../components/ui";
import { DOMAIN, INK, SEM } from "../lib/colors";
import type { Lang } from "../lib/strings";

const S = strategic;
type Bi = strategic.Bi;

export const tr = (b: Bi, lang: Lang): string => b[lang];

const THRESHOLD_TICK: Partial<Record<strategic.MetricKey, number>> = {
  securityThreat: S.THRESHOLDS.securityCeiling,
  economicStability: S.THRESHOLDS.economyFloor,
  internalCohesion: S.THRESHOLDS.cohesionFloor,
};

function metricColor(k: strategic.MetricKey, v: number): string {
  const good = S.METRIC_POLARITY[k] === 1 ? v / 100 : 1 - v / 100;
  return good >= 0.55 ? SEM.good : good >= 0.35 ? SEM.warn : SEM.bad;
}

const TRACK_ACCENT: Record<strategic.PolicyTrack, string> = {
  RADICAL_RIGHT_DEPORTATION: SEM.bad,
  CONSERVATIVE_RIGHT_ANNEXATION: DOMAIN.fiscal,
  PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: DOMAIN.macro,
  CENTER_LEFT_PA_RETURN: DOMAIN.diplomacy,
  RADICAL_LEFT_UNILATERAL_WITHDRAWAL: DOMAIN.social,
};

const L = {
  term: { he: "קדנציה", en: "Term" },
  coalition: { he: "הרכב הממשלה", en: "Government" },
  newTerm: { he: "קדנציה חדשה", en: "New term" },
  turn: { he: "הכרעה", en: "Decision" },
  metrics: { he: "מדדי מצב", en: "State metrics" },
  tracks: { he: "מסלולי מדיניות", en: "Policy tracks" },
  params: { he: "פרמטרי ההחלטה", en: "Decision parameters" },
  ambiguity: { he: "עמימות קונסטרוקטיבית (אופק מדיני)", en: "Constructive ambiguity (political horizon)" },
  idf: { he: "חופש פעולה מלא לצה\"ל", en: "Full IDF freedom of action" },
  settlements: { he: "מדיניות התנחלויות", en: "Settlement policy" },
  gaza: { he: "שליטה אזרחית בעזה", en: "Gaza civil control" },
  preview: { he: "תחזית ההכרעה", en: "Decision preview" },
  decide: { he: "הכרע", en: "Decide" },
  endsRun: { he: "ההכרעה מסיימת את הקדנציה", en: "This decision ends the term" },
  opensCrisis: { he: "ההכרעה פותחת משבר אזורי — יוצג במפה הטקטית", en: "This decision opens a regional crisis — shown on the tactical map" },
  checkpoints: { he: "נקודות בדיקה · מסלול מדורג", en: "Checkpoints · staged track" },
  rollback: { he: "מנגנון נסיגה: פיגוע או התחמשות מחודשת מקפיאים את התהליך ומחזירים את הסמכויות לצה\"ל.", en: "Withdrawal mechanism: an attack or rearmament freezes the process and returns powers to the IDF." },
  rollbackRisk: { he: "סיכון הקפאה בתור הבא", en: "Freeze risk next turn" },
  frozen: { he: "מוקפא", en: "Frozen" },
  flags: { he: "מצב אסטרטגי", en: "Strategic flags" },
  log: { he: "יומן הקבינט", en: "Cabinet log" },
  assumption: { he: "הנחה", en: "assumption" },
  assumptionNote: { he: "מקדמים מסומנים הם הנחות המודל, לא נתונים", en: "Marked coefficients are model assumptions, not data" },
  crisisPending: { he: "משבר פתוח: הקבינט נדרש להכריע במפה הטקטית", en: "Crisis open: the cabinet must decide on the tactical map" },
  openTactical: { he: "למפה הטקטית", en: "Open tactical map" },
  consequences: { he: "השלכות לפי המודל", en: "Modelled consequences" },
  current: { he: "בתוקף", en: "in force" },
};

const FLAG_LABELS: Record<"saudiNormalization" | "gulfFundsReconstruction" | "israelPaysForGazaAdministration" | "terrorInfrastructureGrowth", Bi> = {
  saudiNormalization: { he: "ערוץ נורמליזציה עם סעודיה", en: "Saudi normalization channel" },
  gulfFundsReconstruction: { he: "המפרץ מממן את שיקום עזה", en: "Gulf funds Gaza reconstruction" },
  israelPaysForGazaAdministration: { he: "ישראל מממנת את ניהול עזה", en: "Israel pays for Gaza administration" },
  terrorInfrastructureGrowth: { he: "צמיחת תשתיות טרור", en: "Terror infrastructure growing" },
};

function Segmented<T extends string>(props: { value: T; options: T[]; label: (v: T) => string; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {props.options.map((o) => (
        <button
          key={o}
          type="button"
          disabled={props.disabled}
          onClick={() => props.onChange(o)}
          className={`rounded-[2px] border px-2 py-1 text-[12px] ${
            props.value === o ? "border-info bg-info-dim/40 text-fg0" : "border-line0 bg-bg2 text-fg1 hover:bg-bg3"
          } disabled:opacity-40`}
        >
          {props.label(o)}
        </button>
      ))}
    </div>
  );
}

function Toggle(props: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 text-[13px] ${props.disabled === true ? "opacity-40" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={props.on}
        disabled={props.disabled}
        onClick={() => props.onChange(!props.on)}
        className={`relative h-[18px] w-[32px] shrink-0 rounded-full border ${props.on ? "border-info bg-info-dim" : "border-line1 bg-bg2"}`}
      >
        <bdi dir="ltr" className="absolute inset-0">
          <span className={`absolute top-[2px] h-[12px] w-[12px] rounded-full bg-fg0 transition-[left] ${props.on ? "left-[16px]" : "left-[2px]"}`} />
        </bdi>
      </button>
      {props.label}
    </label>
  );
}

function DeltaChip(props: { k: strategic.MetricKey; delta: number }) {
  if (Math.round(props.delta) === 0) return null;
  const good = Math.sign(props.delta) === S.METRIC_POLARITY[props.k];
  return (
    <span className={`num text-[11px] ${good ? "text-good-bright" : "text-bad-bright"}`}>
      {props.delta > 0 ? "+" : ""}
      {Math.round(props.delta)}
    </span>
  );
}

export function Cabinet() {
  const lang = useStore((s) => s.lang);
  const setScreen = useStore((s) => s.setScreen);
  const sim = useStrategic((s) => s.sim);
  const draft = useStrategic((s) => s.draft);
  const newTerm = useStrategic((s) => s.newTerm);
  const pickTrack = useStrategic((s) => s.pickTrack);
  const setDraft = useStrategic((s) => s.setDraft);
  const decide = useStrategic((s) => s.decide);
  const setModalOpen = useStrategic((s) => s.setModalOpen);

  const locked = sim.gameOver || sim.pendingCrisis !== null;
  const preview = useMemo(() => (locked ? null : S.previewPolicyDecision(sim, draft)), [sim, draft, locked]);
  const newLogs = preview === null ? [] : preview.historyLogs.slice(sim.historyLogs.length);
  const trackDef = S.TRACK_DEFS[draft.track];
  const reaction = S.COALITION_REACTION[sim.coalition][draft.track];
  const half = S.halfYearLabel(sim.turn);
  const nextCp = S.nextCheckpoint(sim.checkpoints);

  const onDecide = () => {
    if (decide()) setScreen("tactical");
  };

  return (
    <div className="grid grid-cols-[300px_minmax(0,1fr)_330px] gap-4">
      {/* ── left: term + metrics ─────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Panel title={tr(L.term, lang)} accent={DOMAIN.security}>
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-fg1">{tr(L.turn, lang)}</span>
            <span>
              <Num value={`${Math.min(sim.turn, sim.maxTurns)}/${sim.maxTurns}`} className="text-[20px]" />
              <span className="ms-2 text-[12px] text-fg1">{tr(half, lang)}</span>
            </span>
          </div>
          <div className="mt-3 text-[12px] text-fg1">{tr(L.coalition, lang)}</div>
          <div className="mt-1 flex flex-col gap-1">
            {S.COALITION_TYPES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => newTerm(c)}
                title={tr(L.newTerm, lang)}
                className={`rounded-[2px] border px-2 py-1 text-start text-[12px] ${
                  sim.coalition === c ? "border-info bg-info-dim/30 text-fg0" : "border-line0 bg-bg2 text-fg1 hover:bg-bg3"
                }`}
              >
                {tr(S.COALITION_LABELS[c], lang)}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[11px] leading-[16px] text-fg2">
            {lang === "he" ? "בחירת הרכב פותחת קדנציה חדשה." : "Choosing a government starts a new term."}
          </div>
        </Panel>

        <Panel title={tr(L.metrics, lang)} accent={DOMAIN.macro}>
          <div className="flex flex-col gap-3">
            {S.METRIC_KEYS.map((k) => {
              const v = sim.metrics[k];
              const series = sim.metricsHistory.map((m) => m[k]);
              const after = preview?.metrics[k];
              return (
                <div key={k}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-fg1">{tr(S.METRIC_LABELS[k], lang)}</span>
                    <span className="flex items-baseline gap-2">
                      {after !== undefined && <DeltaChip k={k} delta={after - v} />}
                      <Num value={v.toFixed(0)} raw={v} direction={S.METRIC_POLARITY[k]} className="text-[15px]" />
                    </span>
                  </div>
                  <GaugeBar value={v / 100} color={metricColor(k, v)} tick={THRESHOLD_TICK[k] !== undefined ? THRESHOLD_TICK[k] / 100 : undefined} height={7} />
                  {series.length > 1 && (
                    <div className="mt-1">
                      <Sparkline values={series} width={270} height={16} color={INK.fg1} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* ── center: tracks, parameters, preview ─────────────── */}
      <div className="flex min-w-0 flex-col gap-4">
        {sim.pendingCrisis !== null && (
          <div className="flex items-center justify-between rounded-[4px] border border-bad bg-bad-dim/30 px-3 py-2 text-[13px] text-bad-bright">
            {tr(L.crisisPending, lang)}
            <button
              type="button"
              className="rounded-[2px] border border-bad px-2 py-1 text-[12px] hover:bg-bad-dim/40"
              onClick={() => {
                setScreen("tactical");
                setModalOpen(false);
              }}
            >
              {tr(L.openTactical, lang)}
            </button>
          </div>
        )}
        {sim.gameOver && sim.gameOverReason !== null && (
          <div className={`rounded-[4px] border px-3 py-3 ${sim.outcome === "TERM_COMPLETED" ? "border-good bg-good-dim/20" : "border-bad bg-bad-dim/25"}`}>
            <div className={`text-[15px] font-medium ${sim.outcome === "TERM_COMPLETED" ? "text-good-bright" : "text-bad-bright"}`}>
              {tr(sim.gameOverReason, lang)}
            </div>
            <button
              type="button"
              className="mt-2 rounded-[2px] border border-line1 bg-bg2 px-3 py-1 text-[12px] hover:bg-bg3"
              onClick={() => newTerm(sim.coalition)}
            >
              {tr(L.newTerm, lang)}
            </button>
          </div>
        )}

        <Panel title={tr(L.tracks, lang)} accent={DOMAIN.diplomacy}>
          <div className="grid grid-cols-5 gap-2">
            {S.POLICY_TRACKS.map((track) => {
              const d = S.TRACK_DEFS[track];
              const selected = draft.track === track;
              return (
                <button
                  key={track}
                  type="button"
                  disabled={locked}
                  onClick={() => pickTrack(track)}
                  className={`flex min-h-[132px] flex-col rounded-[4px] border p-2 text-start ${
                    selected ? "border-info bg-bg3" : "border-line0 bg-bg2 hover:bg-bg3"
                  } disabled:opacity-50`}
                >
                  <span className="flex items-center gap-1.5 text-[11px] text-fg1">
                    <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: TRACK_ACCENT[track] }} />
                    {tr(d.spectrum, lang)}
                  </span>
                  <span className="mt-1 text-[13px] leading-[18px] font-medium text-fg0">{tr(d.label, lang)}</span>
                  {sim.activeTrack === track && (
                    <span className="mt-auto pt-1">
                      <Chip tone="info">{tr(L.current, lang)}</Chip>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-[4px] border border-line0 bg-bg0/40 p-3">
            <div className="text-[13px] leading-[20px] text-fg0">{tr(trackDef.action, lang)}</div>
            <div className="mt-2 text-[11px] text-fg2">{tr(L.consequences, lang)}</div>
            <ul className="mt-1 list-disc ps-5 text-[12px] leading-[18px] text-fg1">
              {trackDef.consequences.map((c, i) => (
                <li key={i}>{tr(c, lang)}</li>
              ))}
            </ul>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-4">
          <Panel title={tr(L.params, lang)} accent={DOMAIN.fiscal}>
            <div className="flex flex-col gap-3">
              <Toggle
                on={draft.concedeConstructiveAmbiguity === true}
                label={tr(L.ambiguity, lang)}
                disabled={locked}
                onChange={(v) => setDraft({ concedeConstructiveAmbiguity: v })}
              />
              <Toggle on={draft.allowIdfFreedomOfAction} label={tr(L.idf, lang)} disabled={locked} onChange={(v) => setDraft({ allowIdfFreedomOfAction: v })} />
              <div>
                <div className="mb-1 text-[12px] text-fg1">{tr(L.settlements, lang)}</div>
                <Segmented
                  value={draft.settlementPolicy}
                  options={["EXPAND", "FREEZE_OUTSIDE_BLOCS", "FULL_FREEZE", "EVACUATE_ALL"]}
                  label={(v) => tr(S.SETTLEMENT_LABELS[v], lang)}
                  onChange={(v) => setDraft({ settlementPolicy: v })}
                  disabled={locked}
                />
              </div>
              <div>
                <div className="mb-1 text-[12px] text-fg1">{tr(L.gaza, lang)}</div>
                <Segmented
                  value={draft.gazaCivilianControl}
                  options={["MILITARY_GOVERNMENT", "REGIONAL_COALITION", "PALESTINIAN_AUTHORITY", "NONE"]}
                  label={(v) => tr(S.GAZA_CONTROL_LABELS[v], lang)}
                  onChange={(v) => setDraft({ gazaCivilianControl: v })}
                  disabled={locked}
                />
              </div>
            </div>
          </Panel>

          <Panel title={tr(L.preview, lang)} accent={DOMAIN.infra}>
            {preview === null ? (
              <div className="text-[12px] text-fg2">—</div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1">
                  {trackDef.transition.source === "assumption" && <Chip tone="muted"><span className="assumption" title={tr(L.assumptionNote, lang)}>{tr(L.assumption, lang)} · {lang === "he" ? "זעזוע מעבר" : "transition"}</span></Chip>}
                  {reaction.source === "assumption" && <Chip tone="muted"><span className="assumption" title={tr(L.assumptionNote, lang)}>{tr(L.assumption, lang)} · {lang === "he" ? "תגובה קואליציונית" : "coalition reaction"}</span></Chip>}
                </div>
                {preview.pendingCrisis !== null && <Chip tone="bad">{tr(L.opensCrisis, lang)}</Chip>}
                {preview.gameOver && preview.pendingCrisis === null && <Chip tone="bad">{tr(L.endsRun, lang)}</Chip>}
                <ul className="flex max-h-[180px] flex-col gap-1 overflow-y-auto text-[12px] leading-[18px]">
                  {newLogs.map((l, i) => (
                    <li key={i} className={l.tone === "bad" ? "text-bad-bright" : l.tone === "warn" ? "text-warn-bright" : l.tone === "good" ? "text-good-bright" : "text-fg1"}>
                      {tr(l.text, lang)}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={locked}
                  onClick={onDecide}
                  className={`mt-1 rounded-[2px] border px-3 py-2 text-[14px] font-medium disabled:opacity-40 ${
                    draft.track === "RADICAL_RIGHT_DEPORTATION" ? "border-bad bg-bad-dim/40 text-bad-bright hover:bg-bad-dim/60" : "border-info bg-info-dim/50 text-fg0 hover:bg-info-dim/70"
                  }`}
                >
                  {tr(L.decide, lang)} · {tr(half, lang)}
                </button>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* ── right: checkpoints, flags, log ──────────────────── */}
      <div className="flex flex-col gap-4">
        <Panel title={tr(L.checkpoints, lang)} accent={DOMAIN.macro}>
          <ol className="flex flex-col gap-2">
            {S.CHECKPOINT_ORDER.map((k) => {
              const def = S.CHECKPOINT_DEFS[k];
              const done = sim.checkpoints[k];
              const isNext = nextCp === k && sim.activeTrack === "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP";
              return (
                <li key={k} className={`rounded-[4px] border p-2 ${done ? "border-good bg-good-dim/15" : isNext ? "border-warn" : "border-line0"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[13px] font-medium ${done ? "text-good-bright" : "text-fg0"}`}>{tr(def.label, lang)}</span>
                    <span className="text-[13px]">{done ? "✓" : isNext && sim.flags.processFrozenTurns > 0 ? <Chip tone="warn">{tr(L.frozen, lang)}</Chip> : ""}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] leading-[16px] text-fg1">{tr(def.detail, lang)}</div>
                  {!done && isNext && <div className="mt-1 text-[11px] leading-[16px] text-warn-bright">{tr(def.blocker, lang)}</div>}
                </li>
              );
            })}
          </ol>
          <div className="mt-2 text-[11px] leading-[16px] text-fg2">{tr(L.rollback, lang)}</div>
          {sim.checkpoints.demilitarizationVerified && (
            <div className="mt-1 flex items-baseline justify-between text-[12px] text-fg1">
              <span className="assumption" title={tr(L.assumptionNote, lang)}>{tr(L.rollbackRisk, lang)}</span>
              <Num value={`${Math.round(S.rollbackProbability(sim.metrics, sim.checkpoints) * 100)}%`} />
            </div>
          )}
        </Panel>

        <Panel title={tr(L.flags, lang)} accent={DOMAIN.diplomacy}>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(FLAG_LABELS) as Array<keyof typeof FLAG_LABELS>).map((f) => {
              const on = sim.flags[f];
              const bad = f === "israelPaysForGazaAdministration" || f === "terrorInfrastructureGrowth";
              return (
                <div key={f} className="flex items-center gap-2 text-[12px]">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: on ? (bad ? SEM.badBright : SEM.goodBright) : INK.line1 }} />
                  <span className={on ? "text-fg0" : "text-fg2"}>{tr(FLAG_LABELS[f], lang)}</span>
                </div>
              );
            })}
            {sim.flags.usConditionsTurns > 0 && (
              <Chip tone="warn">{lang === "he" ? `תנאים אמריקאיים · ${sim.flags.usConditionsTurns} תורות` : `US conditions · ${sim.flags.usConditionsTurns} turns`}</Chip>
            )}
          </div>
        </Panel>

        <Panel title={tr(L.log, lang)} accent={DOMAIN.security}>
          {/* newest first */}
          <ul className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto text-[12px] leading-[18px]">
            {[...sim.historyLogs].reverse().map((l, i) => (
              <li key={sim.historyLogs.length - i} className="flex gap-2">
                <Num value={`${l.turn}`} className="w-4 shrink-0 text-fg2" />
                <span className={l.tone === "bad" ? "text-bad-bright" : l.tone === "warn" ? "text-warn-bright" : l.tone === "good" ? "text-good-bright" : "text-fg1"}>
                  {tr(l.text, lang)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
