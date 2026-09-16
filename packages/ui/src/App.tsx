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
import { Alliances } from "./screens/Alliances";
import { Game } from "./screens/Game";
import { Tactical } from "./screens/Tactical";
import { StrategicStrip } from "./components/StrategicStrip";

const STRATEGY_NAV: Array<{ screen: Screen; label: UIKey; accent: string }> = [
  { screen: "game", label: "game", accent: DOMAIN.security },
  { screen: "alliances", label: "alliances", accent: DOMAIN.diplomacy },
  { screen: "tactical", label: "tactical", accent: DOMAIN.diplomacy },
];

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
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg0 text-fg1">
        <div className="display text-[28px] text-fg0">{t("appTitle", lang)}</div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-bg3">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-info" />
        </div>
        <span className="text-[14px]">{t("loading", lang)}</span>
      </div>
    );
  }

  const ended = state.outcome.ended;
  const strategicScreen = screen === "game" || screen === "alliances" || screen === "tactical";
  const navButton = (n: { screen: Screen; label: UIKey; accent: string }) => {
    const active = screen === n.screen;
    return (
      <button
        key={n.screen}
        type="button"
        onClick={() => setScreen(n.screen)}
        aria-current={active ? "page" : undefined}
        className={`group flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-start text-[14px] leading-[20px] transition-colors ${
          active ? "bg-bg1 font-medium text-fg0 shadow-[0_1px_2px_rgb(40_32_20/0.08),0_2px_6px_rgb(40_32_20/0.05)]" : "text-fg1 hover:bg-bg3/60 hover:text-fg0"
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full transition-transform ${active ? "scale-125" : "opacity-70 group-hover:opacity-100"}`}
          style={{ background: n.accent }}
        />
        {t(n.label, lang)}
      </button>
    );
  };

  return (
    <div className="flex h-full bg-bg0">
      <aside className="flex w-[240px] shrink-0 flex-col border-e border-line0 bg-bg0">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-fg0 text-[15px] text-white">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <rect x="2" y="8" width="3" height="6" rx="1" fill="#E9C77E" />
                <rect x="6.5" y="5" width="3" height="9" rx="1" fill="#86B2D6" />
                <rect x="11" y="2" width="3" height="12" rx="1" fill="#8FD1A8" />
              </svg>
            </span>
            <div className="display text-[19px] leading-[24px]">{t("appTitle", lang)}</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
          <div className="eyebrow px-3 pt-2 pb-1.5">{t("strategySection", lang)}</div>
          {STRATEGY_NAV.map(navButton)}
          <div className="eyebrow px-3 pt-5 pb-1.5">{t("economySection", lang)}</div>
          {NAV.map(navButton)}
          {ended && (
            <button
              type="button"
              onClick={() => setScreen("postmortem")}
              className={`mt-2 flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-start text-[14px] ${
                screen === "postmortem" ? "bg-bad-dim font-medium text-bad-bright" : "text-bad-bright hover:bg-bad-dim/60"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-bad" />
              {t("postmortem", lang)}
            </button>
          )}
        </nav>
        <div className="flex items-center justify-between border-t border-line0 px-5 py-3 text-[12px] text-fg2">
          <span>
            {t("seed", lang)} <span className="num text-fg1">{seed}</span>
          </span>
          <button
            type="button"
            className="rounded-full border border-line0 bg-bg1 px-2.5 py-0.5 text-[12px] text-fg1 hover:border-line1 hover:text-fg0"
            onClick={() => setLang(lang === "he" ? "en" : "he")}
          >
            {lang === "he" ? "English" : "עברית"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {screen === "game" ? null : strategicScreen ? <StrategicStrip /> : <header className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line0 bg-bg0 px-6 py-3">
          <Num value={fmtQuarter(state.t.year, state.t.quarter)} className="display text-[26px] leading-[32px]" />
          <div className="flex flex-col leading-[18px]">
            <span className="text-[12px] text-fg2">{t("gdp", lang)}</span>
            <Num value={fmtBudget(state.macro.gdp_real, 0)} raw={state.macro.gdp_real} direction={1} className="text-[16px] font-medium text-fg0" />
          </div>
          <div className="flex flex-col leading-[18px]">
            <span className="text-[12px] text-fg2">{t("debtGdp", lang)}</span>
            <Num value={fmtPct(state.macro.debt_gdp, 1)} raw={state.macro.debt_gdp} direction={-1} className="text-[16px] font-medium text-fg0" />
          </div>
          <div className="flex flex-col leading-[18px]">
            <span className="text-[12px] text-fg2">{t("unemployment", lang)}</span>
            <Num value={fmtPct(state.macro.unemployment, 2)} raw={state.macro.unemployment} direction={-1} className="text-[16px] font-medium text-fg0" />
          </div>
          <div className="ms-auto flex items-center gap-3">
            {busy && <span className="animate-pulse text-[13px] text-fg2">{t("loading", lang)}</span>}
            <div dir="ltr" className="flex items-center rounded-[10px] border border-line0 bg-bg1 p-0.5">
              {STEPS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={busy || ended}
                  onClick={() => void advance(s.quarters)}
                  className="num rounded-[8px] px-2.5 py-1 text-[13px] text-fg1 transition-colors hover:bg-bg3 hover:text-fg0 disabled:opacity-40"
                >
                  +{s.label}
                </button>
              ))}
            </div>
          </div>
        </header>}

        {ended && !strategicScreen && screen !== "postmortem" && (
          <div className="border-b border-bad/30 bg-bad-dim px-6 py-2 text-[14px] text-bad-bright">
            {t("runEnded", lang)} — {state.outcome.kind}
          </div>
        )}

        <main className={`min-h-0 flex-1 ${screen === "map" || screen === "tactical" || screen === "alliances" || screen === "game" ? "relative" : "overflow-y-auto p-6"}`}>
          {screen === "alliances" && <Alliances />}
          {screen === "game" && <Game />}
          {screen === "tactical" && <Tactical />}
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
