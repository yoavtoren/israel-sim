/** Shell: sidebar navigation, top strip (clock + run controls), screen switch. */

import { useEffect } from "react";
import { useStore, type Screen } from "./store";
import { t, type UIKey } from "./lib/strings";
import { DOMAIN } from "./lib/colors";
import { fmtBudget, fmtPct, fmtQuarter } from "./lib/format";
import { Num } from "./components/ui";
import { Overview } from "./screens/Overview";
import { Budget } from "./screens/Budget";
import { MapScreen } from "./screens/MapScreen";
import { Security } from "./screens/Security";
import { Pipeline } from "./screens/Pipeline";
import { Sectors } from "./screens/Sectors";
import { Reforms } from "./screens/Reforms";
import { History } from "./screens/History";
import { PostMortem } from "./screens/PostMortem";

const NAV: Array<{ screen: Screen; label: UIKey; accent: string }> = [
  { screen: "overview", label: "overview", accent: DOMAIN.macro },
  { screen: "budget", label: "budget", accent: DOMAIN.fiscal },
  { screen: "map", label: "map", accent: DOMAIN.infra },
  { screen: "security", label: "security", accent: DOMAIN.security },
  { screen: "pipeline", label: "pipeline", accent: DOMAIN.fiscal },
  { screen: "sectors", label: "sectors", accent: DOMAIN.social },
  { screen: "reforms", label: "reforms", accent: DOMAIN.diplomacy },
  { screen: "history", label: "history", accent: DOMAIN.macro },
];

const STEPS: Array<{ label: string; quarters: number }> = [
  { label: "1Q", quarters: 1 },
  { label: "1Y", quarters: 4 },
  { label: "2Y", quarters: 8 },
  { label: "5Y", quarters: 20 },
  { label: "10Y", quarters: 40 },
];

export function App() {
  const booted = useStore((s) => s.booted);
  const boot = useStore((s) => s.boot);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const state = useStore((s) => s.state);
  const busy = useStore((s) => s.busy);
  const advance = useStore((s) => s.advance);
  const seed = useStore((s) => s.seed);

  useEffect(() => {
    if (!booted) void boot();
  }, [booted, boot]);

  if (!booted || state === null) {
    return (
      <div className="flex h-full items-center justify-center bg-bg0 text-fg1">
        <span className="animate-pulse text-[15px]">{t("loading", lang)}</span>
      </div>
    );
  }

  const ended = state.outcome.ended;

  return (
    <div className="flex h-full bg-bg0">
      {/* sidebar — 280px (DESIGN §2) */}
      <aside className="flex w-[280px] shrink-0 flex-col border-e border-line0 bg-bg1">
        <div className="border-b border-line0 px-4 py-3">
          <div className="text-[18px] leading-[26px] font-bold">{t("appTitle", lang)}</div>
          <div className="num text-[11px] text-fg2">israel-sim</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map((n) => (
            <button
              key={n.screen}
              type="button"
              onClick={() => setScreen(n.screen)}
              className={`flex w-full items-center gap-2 px-4 py-2 text-start text-[13px] leading-[20px] ${
                screen === n.screen ? "bg-bg3 text-fg0" : "text-fg1 hover:bg-bg2"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: n.accent }} />
              {t(n.label, lang)}
            </button>
          ))}
          {ended && (
            <button
              type="button"
              onClick={() => setScreen("postmortem")}
              className={`flex w-full items-center gap-2 px-4 py-2 text-start text-[13px] ${
                screen === "postmortem" ? "bg-bg3 text-fg0" : "text-bad-bright hover:bg-bg2"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-[2px] bg-bad" />
              {t("postmortem", lang)}
            </button>
          )}
        </nav>
        <div className="border-t border-line0 px-4 py-2 text-[11px] leading-[16px] text-fg2">
          <div>
            {t("seed", lang)}: <span className="num">{seed}</span>
          </div>
          <button type="button" className="mt-1 text-info-bright hover:underline" onClick={() => setLang(lang === "he" ? "en" : "he")}>
            {lang === "he" ? "English" : "עברית"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top strip: clock, headline KPIs, run controls */}
        <header className="flex items-center gap-6 border-b border-line0 bg-bg1 px-4 py-2">
          <Num value={fmtQuarter(state.t.year, state.t.quarter)} className="text-[24px] leading-[32px] font-medium" />
          <div className="flex items-baseline gap-1 text-[12px] text-fg1">
            {t("gdp", lang)}
            <Num value={fmtBudget(state.macro.gdp_real, 0)} raw={state.macro.gdp_real} direction={1} className="text-fg0" />
          </div>
          <div className="flex items-baseline gap-1 text-[12px] text-fg1">
            {t("debtGdp", lang)}
            <Num value={fmtPct(state.macro.debt_gdp, 1)} raw={state.macro.debt_gdp} direction={-1} className="text-fg0" />
          </div>
          <div className="flex items-baseline gap-1 text-[12px] text-fg1">
            {t("unemployment", lang)}
            <Num value={fmtPct(state.macro.unemployment, 2)} raw={state.macro.unemployment} direction={-1} className="text-fg0" />
          </div>
          <div className="ms-auto flex items-center gap-1">
            {busy && <span className="me-2 animate-pulse text-[12px] text-fg2">…</span>}
            {STEPS.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={busy || ended}
                onClick={() => void advance(s.quarters)}
                className="num rounded-[2px] border border-line0 bg-bg2 px-2 py-1 text-[12px] text-fg1 hover:bg-bg3 hover:text-fg0 disabled:opacity-40"
              >
                {s.label}
              </button>
            ))}
          </div>
        </header>

        {ended && screen !== "postmortem" && (
          <div className="border-b border-bad bg-bad-dim/30 px-4 py-1.5 text-[13px] text-bad-bright">
            {t("runEnded", lang)} — {state.outcome.kind}
          </div>
        )}

        <main className={`min-h-0 flex-1 ${screen === "map" ? "" : "overflow-y-auto p-4"}`}>
          {screen === "overview" && <Overview />}
          {screen === "budget" && <Budget />}
          {screen === "map" && <MapScreen />}
          {screen === "security" && <Security />}
          {screen === "pipeline" && <Pipeline />}
          {screen === "sectors" && <Sectors />}
          {screen === "reforms" && <Reforms />}
          {screen === "history" && <History />}
          {screen === "postmortem" && <PostMortem />}
        </main>
      </div>
    </div>
  );
}
