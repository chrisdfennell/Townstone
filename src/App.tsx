import { useMemo, useState } from "react";
import { useGame, type GameConfig } from "./game/useGame";
import { useHealthDeltas } from "./game/useHealthDeltas";
import { canAttack as engineCanAttack, canPlayCard, canUseHeroPower, sameRef, CLASS_LABEL } from "./engine";
import type { CharacterRef, GameState, Minion, PlayerId } from "./engine";
import { HandCard } from "./components/HandCard";
import { MinionView } from "./components/MinionView";
import { HeroView } from "./components/HeroView";
import { MulliganModal } from "./components/MulliganModal";
import { SetupScreen } from "./components/SetupScreen";
import type { HealthDelta } from "./components/FloatingNumber";

export function App() {
  // `config` null => show the setup/deckbuilder screen.
  const [config, setConfig] = useState<GameConfig | null>(null);
  // Bumping this key remounts the game (fresh useGame state) for a rematch.
  const [gameKey, setGameKey] = useState(0);

  if (!config) return <SetupScreen onStart={setConfig} />;

  return (
    <GameView
      key={gameKey}
      config={config}
      onRematch={() => setGameKey((k) => k + 1)}
      onExit={() => setConfig(null)}
    />
  );
}

function GameView({ config, onRematch, onExit }: { config: GameConfig; onRematch: () => void; onExit: () => void }) {
  const g = useGame(config);
  const { state } = g;
  const deltas = useHealthDeltas(state);
  const player = state.players.player;
  const ai = state.players.ai;

  const recentLog = useMemo(() => state.log.slice(-6).reverse(), [state.log]);

  const turnLabel =
    state.phase === "gameOver"
      ? "Game Over"
      : state.phase === "mulligan"
        ? "Mulligan"
        : g.aiThinking
          ? "Enemy is plotting…"
          : g.isMyTurn
            ? "Your Turn"
            : "Enemy Turn";

  return (
    <div className="app" onClick={g.clickBoard}>
      <header className="topbar">
        <h1 className="logo">
          Town<span>stone</span>
        </h1>
        <div className={"turn-banner" + (g.isMyTurn ? " turn-banner--mine" : "")}>{turnLabel}</div>
        <div className="topbar__btns">
          <button type="button" className="btn btn--ghost" onClick={(e) => { e.stopPropagation(); onRematch(); }}>
            Rematch
          </button>
          <button type="button" className="btn btn--ghost" onClick={(e) => { e.stopPropagation(); onExit(); }}>
            Main Menu
          </button>
        </div>
      </header>

      <main className="battlefield" onClick={(e) => e.stopPropagation()}>
        <HeroView
          hero={ai.hero}
          player="ai"
          name={`The Dark ${CLASS_LABEL[ai.hero.className]}`}
          mana={ai.mana}
          maxMana={ai.maxMana}
          deckCount={ai.deck.length}
          handCount={ai.hand.length}
          targetable={isTargeted(g.highlightedTargets, { kind: "hero", player: "ai" })}
          delta={deltas.get("hero:ai")}
          onClick={() => g.clickHero("ai")}
        />

        <Board owner="ai" minions={ai.board} g={g} state={state} deltas={deltas} />

        <div className="midline">
          <span className="midline__rune">✦ ✦ ✦</span>
        </div>

        <Board owner="player" minions={player.board} g={g} state={state} deltas={deltas} />

        <HeroView
          hero={player.hero}
          player="player"
          name={`You — ${CLASS_LABEL[player.hero.className]}`}
          mana={player.mana}
          maxMana={player.maxMana}
          deckCount={player.deck.length}
          handCount={player.hand.length}
          targetable={isTargeted(g.highlightedTargets, { kind: "hero", player: "player" })}
          delta={deltas.get("hero:player")}
          canUsePower={g.isMyTurn && canUseHeroPower(state, "player")}
          powerSelected={g.pending?.kind === "power"}
          onUsePower={g.clickHeroPower}
          onClick={() => g.clickHero("player")}
        />
      </main>

      <section className="hand" onClick={(e) => e.stopPropagation()}>
        {player.hand.map((card) => (
          <HandCard
            key={card.instanceId}
            card={card}
            playable={g.isMyTurn && canPlayCard(state, "player", card.instanceId)}
            selected={g.pending?.kind === "card" && g.pending.instanceId === card.instanceId}
            onClick={() => g.clickHandCard(card.instanceId)}
          />
        ))}
        {player.hand.length === 0 && <span className="hand__empty">No cards in hand.</span>}
      </section>

      <footer className="controls" onClick={(e) => e.stopPropagation()}>
        <div className="log">
          {recentLog.map((line, i) => (
            <div key={state.log.length - i} className={"log__line" + (i === 0 ? " log__line--new" : "")}>
              {line}
            </div>
          ))}
        </div>
        <button type="button" className="btn btn--primary" disabled={!g.isMyTurn} onClick={g.endMyTurn}>
          End Turn
        </button>
      </footer>

      {state.phase === "mulligan" && (
        <MulliganModal
          hand={player.hand}
          choices={g.mulliganChoices}
          goingFirst={state.first === "player"}
          onToggle={g.toggleMulligan}
          onConfirm={g.confirmMulligan}
        />
      )}

      {state.phase === "gameOver" && (
        <div className="overlay" onClick={(e) => e.stopPropagation()}>
          <div className="overlay__panel">
            <h2>{state.winner === "player" ? "Victory" : state.winner === "ai" ? "Defeat" : "Draw"}</h2>
            <p>
              {state.winner === "player"
                ? "The Dark Wanderer falls before you."
                : state.winner === "ai"
                  ? "Darkness claims another hero…"
                  : "Both heroes are consumed."}
            </p>
            <div className="overlay__btns">
              <button type="button" className="btn btn--primary" onClick={onRematch}>
                Rematch
              </button>
              <button type="button" className="btn btn--ghost" onClick={onExit}>
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isTargeted(targets: CharacterRef[], ref: CharacterRef): boolean {
  return targets.some((t) => sameRef(t, ref));
}

interface BoardProps {
  owner: PlayerId;
  minions: Minion[];
  g: ReturnType<typeof useGame>;
  state: GameState;
  deltas: Map<string, HealthDelta>;
}

function Board({ owner, minions, g, state, deltas }: BoardProps) {
  return (
    <div className={"board board--" + owner}>
      {minions.length === 0 && <span className="board__empty">— empty —</span>}
      {minions.map((m) => (
        <MinionView
          key={m.instanceId}
          minion={m}
          canAttack={owner === "player" && engineCanAttack(state, "player", m.instanceId)}
          selected={g.selectedAttackerId === m.instanceId}
          targetable={isTargeted(g.highlightedTargets, { kind: "minion", instanceId: m.instanceId })}
          delta={deltas.get(m.instanceId)}
          onClick={() => g.clickMinion(m.instanceId, owner)}
        />
      ))}
    </div>
  );
}
