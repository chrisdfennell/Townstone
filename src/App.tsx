import { useState } from "react";
import { CLASS_LABEL } from "./engine";
import { useGame, type GameConfig, type UseGame } from "./game/useGame";
import { useOnlineGame, type OnlineConfig, type OnlineStatus } from "./game/useOnlineGame";
import { GameBoard } from "./components/GameBoard";
import { SetupScreen } from "./components/SetupScreen";

type Mode = "setup" | "local" | "online";

export function App() {
  const [mode, setMode] = useState<Mode>("setup");
  const [localConfig, setLocalConfig] = useState<GameConfig | null>(null);
  const [onlineConfig, setOnlineConfig] = useState<OnlineConfig | null>(null);
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
    />
  );
}

function LocalGame({ config, onExit, onRematch }: { config: GameConfig; onExit: () => void; onRematch: () => void }) {
  const ctrl = useGame(config);
  return (
    <GameBoard
      ctrl={ctrl}
      selfName="You"
      enemyName={`The Dark ${CLASS_LABEL[ctrl.state.players.ai.hero.className]}`}
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
