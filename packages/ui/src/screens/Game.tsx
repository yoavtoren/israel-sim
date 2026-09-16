/** The Prime Minister campaign — the app's main screen. The world map fills
 *  the screen; setup popups, the decision panel and consequence popups float
 *  over it, and the camera flies to whatever the story is about. */

import { useMemo } from "react";
import { strategic } from "@engine";
import { useStore } from "../store";
import { useCampaign } from "../strategic/campaignStore";
import { useStrategic } from "../strategic/store";
import { sound } from "../strategic/sound";
import { usePlaybackDriver } from "../components/tactical/TimelineController";
import { WorldMap, type Inset } from "../components/game/WorldMap";
import { CoalitionBuilder, PartyPicker } from "../components/game/Setup";
import { ConsequenceCard, DecisionPanel, EndScreen, EventLog, Hud, StanceLegend } from "../components/game/Play";
import type { WorldFocus } from "../strategic/worldGeo";

const DECISION_WIDTH = 500;

export function Game() {
  usePlaybackDriver();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const game = useCampaign((s) => s.game);
  const soundOn = useStrategic((s) => s.soundOn);
  const setSound = useStrategic((s) => s.setSound);
  const stances = useMemo(() => strategic.campaignStances(game), [game]);

  const head = game.phase === "consequences" ? game.queue[0] : undefined;
  const dilemma = game.phase === "dilemma" || game.phase === "policy" ? strategic.currentDilemma(game) : null;
  const inGame = game.phase !== "party" && game.phase !== "coalition";

  const focus: WorldFocus = head?.focus ?? dilemma?.focus ?? (game.phase === "ended" ? "world" : inGame ? "israel" : "world");
  const highlight = head !== undefined ? (Object.keys(head.stance) as strategic.ActorId[]) : [];
  // keep the story's focal area clear of the panels
  const sideInset = dilemma !== null ? DECISION_WIDTH + 24 : 0;
  const inset: Inset = lang === "he"
    ? { left: 0, right: sideInset, top: inGame ? 90 : 0, bottom: head !== undefined ? 240 : 40 }
    : { left: sideInset, right: 0, top: inGame ? 90 : 0, bottom: head !== undefined ? 240 : 40 };

  return (
    <div className="relative h-full w-full">
      <WorldMap stances={stances} lang={lang} focus={focus} inset={inset} highlight={highlight} />

      <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-4">
        {inGame && <Hud game={game} lang={lang} />}
        <div className="flex min-h-0 flex-1 gap-3">
          {dilemma !== null && <DecisionPanel game={game} lang={lang} />}
          <div className="flex min-w-0 flex-1 flex-col items-center justify-end">
            {head !== undefined && <ConsequenceCard game={game} lang={lang} />}
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          {inGame ? <EventLog game={game} lang={lang} /> : <span />}
          <div className="pointer-events-auto flex items-center gap-2">
            <StanceLegend lang={lang} />
            <button
              type="button"
              onClick={() => {
                sound.unlock();
                setSound(!soundOn);
              }}
              className="glass overlay flex h-9 w-9 items-center justify-center rounded-full border border-line0 text-[14px] hover:bg-bg1"
              aria-pressed={soundOn}
            >
              {soundOn ? "🔊" : "🔇"}
            </button>
            <button type="button" onClick={() => setLang(lang === "he" ? "en" : "he")} className="glass overlay flex h-9 min-w-9 items-center justify-center rounded-full border border-line0 px-2.5 text-[13px] font-medium text-fg1 hover:bg-bg1 hover:text-fg0">
              {lang === "he" ? "EN" : "עב"}
            </button>
          </div>
        </div>
      </div>

      {game.phase === "party" && <PartyPicker lang={lang} />}
      {game.phase === "coalition" && <CoalitionBuilder lang={lang} />}
      {game.phase === "ended" && <EndScreen game={game} lang={lang} />}
    </div>
  );
}
