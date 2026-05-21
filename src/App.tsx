import { useEffect, useRef, useState } from "react";
import { CLASS_LABEL } from "./engine";
import type { HeroClass, PlayerId } from "./engine";
import { useGame, type GameConfig, type UseGame } from "./game/useGame";
import { useOnlineGame, type OnlineConfig, type OnlineStatus } from "./game/useOnlineGame";
import { BOSSES, bossDeck } from "./game/campaign";
import { loadDeck } from "./game/deckStore";
import { markBossBeaten, unlockCard } from "./game/collection";
import { GameBoard } from "./components/GameBoard";
import { SetupScreen } from "./components/SetupScreen";
import { CampaignScreen } from "./components/CampaignScreen";

type Mode = "setup" | "local" | "online" | "campaign" | "campaign-fight";

export function App() {
  const [mode, setMode] = useState<Mode>("setup");
  const [localConfig, setLocalConfig] = useState<GameConfig | null>(null);
  const [onlineConfig, setOnlineConfig] = useState<OnlineConfig | null>(null);
  const [campaignBossId, setCampaignBossId] = useState<string | null>(null);
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
  // Bumping the key remounts the game for a fresh rematch.
  const [gameKey, setGameKey] = useState(0);

  if (mode === "local" && localConfig) {
    return (
      <LocalGame
        key={gameKey}
        config={localConfig}
        onExit={() => setMode("setup")}
        onRematch={() => setGameKey((k) => k + 1)}
      />
    );
  }
  if (mode === "online" && onlineConfig) {
    return (
      <OnlineGame
        key={gameKey}
        config={onlineConfig}
        onExit={() => setMode("setup")}
        onRematch={() => setGameKey((k) => k + 1)}
      />
    );
  }
  if (mode === "campaign-fight" && localConfig && campaignBossId) {
    const boss = BOSSES.find((b) => b.id === campaignBossId)!;
    return (
      <LocalGame
        key={gameKey}
        config={localConfig}
        enemyName={`${boss.name}, ${boss.title}`}
        onExit={() => setMode("campaign")}
        onRematch={() => setGameKey((k) => k + 1)}
        onResult={(winner) => {
          if (winner === "player") {
            markBossBeaten(boss.id);
            unlockCard(boss.rewardCardId);
            setJustUnlocked(boss.rewardCardId);
          }
        }}
      />
    );
  }
  if (mode === "campaign") {
    return (
      <CampaignScreen
        justUnlocked={justUnlocked}
        onExit={() => {
          setJustUnlocked(null);
          setMode("setup");
        }}
        onFight={(bossId, playerClass) => {
          const boss = BOSSES.find((b) => b.id === bossId)!;
          setJustUnlocked(null);
          setCampaignBossId(bossId);
          setLocalConfig({
            playerClass,
            playerDeck: loadDeck(playerClass),
            aiClass: boss.deckClass,
            aiDeck: bossDeck(boss),
            aiPower: boss.power,
            difficulty: "normal",
          });
          setGameKey((k) => k + 1);
          setMode("campaign-fight");
        }}
      />
    );
  }

  return (
    <SetupScreen
      onStartLocal={(c) => {
        setLocalConfig(c);
        setGameKey((k) => k + 1);
        setMode("local");
      }}
      onStartOnline={(c) => {
        setOnlineConfig(c);
        setGameKey((k) => k + 1);
        setMode("online");
      }}
      onCampaign={() => {
        setJustUnlocked(null);
        setMode("campaign");
      }}
    />
  );
}

function LocalGame({
  config,
  onExit,
  onRematch,
  enemyName,
  onResult,
}: {
  config: GameConfig;
  onExit: () => void;
  onRematch: () => void;
  enemyName?: string;
  onResult?: (winner: PlayerId | null) => void;
}) {
  const ctrl = useGame(config);
  const reported = useRef(false);

  // Report the outcome once when the game ends (drives campaign unlocks).
  useEffect(() => {
    if (ctrl.state.phase === "gameOver" && !reported.current) {
      reported.current = true;
      onResult?.(ctrl.state.winner);
    }
  }, [ctrl.state.phase, ctrl.state.winner, onResult]);

  const enemyClass: HeroClass = ctrl.state.players.ai.hero.className;
  return (
    <GameBoard
      ctrl={ctrl}
      selfName="You"
      enemyName={enemyName ?? `The Dark ${CLASS_LABEL[enemyClass]}`}
      showMulligan={ctrl.state.phase === "mulligan"}
      onExit={onExit}
      onRematch={onRematch}
    />
  );
}

function OnlineGame({ config, onExit, onRematch }: { config: OnlineConfig; onExit: () => void; onRematch: () => void }) {
  const ctrl = useOnlineGame(config);

  if (!ctrl.state) return <ConnectionScreen status={ctrl.status} onExit={onExit} />;

  const gameCtrl = { ...ctrl, state: ctrl.state } as UseGame;
  const showMulligan = ctrl.status === "mulligan" && !ctrl.mulliganSubmitted;
  // Only offer rematch (re-queue) once the match has concluded.
  const ended = ctrl.state.phase === "gameOver" || ctrl.status === "opponentLeft";

  let banner = null;
  if (ctrl.status === "opponentLeft" && ctrl.state.phase !== "gameOver") {
    banner = (
      <div className="overlay">
        <div className="overlay__panel">
          <h2>Opponent Left</h2>
          <p>Your foe has fled the battle.</p>
          <div className="overlay__btns">
            <button type="button" className="btn btn--primary" onClick={onRematch}>
              Find New Match
            </button>
            <button type="button" className="btn btn--ghost" onClick={onExit}>
              Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  } else if (ctrl.status === "mulligan" && ctrl.mulliganSubmitted) {
    banner = (
      <div className="overlay">
        <div className="overlay__panel">
          <h2>Ready</h2>
          <p>Waiting for {ctrl.opponentName} to choose their hand…</p>
        </div>
      </div>
    );
  }

  return (
    <GameBoard
      ctrl={gameCtrl}
      selfName={config.name}
      enemyName={ctrl.opponentName}
      showMulligan={showMulligan}
      onExit={onExit}
      onRematch={ended ? onRematch : undefined}
      banner={banner}
    />
  );
}

function ConnectionScreen({ status, onExit }: { status: OnlineStatus; onExit: () => void }) {
  const message: Record<OnlineStatus, string> = {
    connecting: "Reaching the server…",
    waiting: "Searching for a worthy opponent…",
    mulligan: "Match found! Preparing the battle…",
    playing: "Entering the battle…",
    gameOver: "The battle has ended.",
    opponentLeft: "Your opponent has left the battle.",
    error: "Couldn't reach a game server.",
  };
  return (
    <div className="setup conn-screen">
      <h1 className="logo logo--big">
        Town<span>stone</span>
      </h1>
      <p className="conn-screen__status">{message[status]}</p>
      {status === "error" && (
        <p className="conn-screen__hint">
          Online play needs the WebSocket server running. It isn't hosted on this
          public site — to play online, run it locally with <code>npm run dev:all</code>
          and open <code>http://localhost:5173</code> in two tabs.
        </p>
      )}
      {(status === "waiting" || status === "connecting") && <div className="conn-spinner" aria-hidden />}
      <button type="button" className="btn btn--ghost" onClick={onExit}>
        {status === "error" || status === "opponentLeft" ? "Back" : "Cancel"}
      </button>
    </div>
  );
}
