import { useMemo } from "react";
import { useGame } from "./game/useGame";
import { canAttack as engineCanAttack, canPlayCard } from "./engine";
import type { CharacterRef, PlayerId } from "./engine";
import { HandCard } from "./components/HandCard";
import { MinionView } from "./components/MinionView";
import { HeroView } from "./components/HeroView";

function isTargeted(targets: CharacterRef[], ref: CharacterRef): boolean {
  return targets.some((t) =>
    t.kind === "hero" && ref.kind === "hero"
      ? t.player === ref.player
      : t.kind === "minion" && ref.kind === "minion" && t.instanceId === ref.instanceId,
  );
}

export function App() {
  const g = useGame();
  const { state } = g;
  const player = state.players.player;
  const ai = state.players.ai;

  const recentLog = useMemo(() => state.log.slice(-6).reverse(), [state.log]);

  const turnLabel =
    state.phase === "gameOver"
      ? "Game Over"
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
        <button type="button" className="btn btn--ghost" onClick={(e) => { e.stopPropagation(); g.newGame(); }}>
          New Game
        </button>
      </header>

      <main className="battlefield" onClick={(e) => e.stopPropagation()}>
        {/* Enemy hero */}
        <HeroView
          hero={ai.hero}
          player="ai"
          name="The Dark Wanderer"
          mana={ai.mana}
          maxMana={ai.maxMana}
          deckCount={ai.deck.length}
          handCount={ai.hand.length}
          targetable={isTargeted(g.highlightedTargets, { kind: "hero", player: "ai" })}
          onClick={() => g.clickHero("ai")}
        />

        {/* Enemy board */}
        <Board
          owner="ai"
          minions={ai.board}
          highlightedTargets={g.highlightedTargets}
          selectedAttackerId={g.selectedAttackerId}
          state={state}
          onMinionClick={g.clickMinion}
        />

        <div className="midline">
          <span className="midline__rune">✦ ✦ ✦</span>
        </div>

        {/* Player board */}
        <Board
          owner="player"
          minions={player.board}
          highlightedTargets={g.highlightedTargets}
          selectedAttackerId={g.selectedAttackerId}
          state={state}
          onMinionClick={g.clickMinion}
        />

        {/* Player hero */}
        <HeroView
          hero={player.hero}
          player="player"
          name="You"
          mana={player.mana}
          maxMana={player.maxMana}
          deckCount={player.deck.length}
          handCount={player.hand.length}
          targetable={isTargeted(g.highlightedTargets, { kind: "hero", player: "player" })}
          onClick={() => g.clickHero("player")}
        />
      </main>

      {/* Player hand */}
      <section className="hand" onClick={(e) => e.stopPropagation()}>
        {player.hand.map((card) => (
          <HandCard
            key={card.instanceId}
            card={card}
            playable={g.isMyTurn && canPlayCard(state, "player", card.instanceId)}
            selected={g.pendingPlayId === card.instanceId}
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
        <button
          type="button"
          className="btn btn--primary"
          disabled={!g.isMyTurn}
          onClick={g.endMyTurn}
        >
          End Turn
        </button>
      </footer>

      {state.phase === "gameOver" && (
        <div className="overlay" onClick={(e) => e.stopPropagation()}>
          <div className="overlay__panel">
            <h2>
              {state.winner === "player"
                ? "Victory"
                : state.winner === "ai"
                  ? "Defeat"
                  : "Draw"}
            </h2>
            <p>
              {state.winner === "player"
                ? "The Dark Wanderer falls before you."
                : state.winner === "ai"
                  ? "Darkness claims another hero…"
                  : "Both heroes are consumed."}
            </p>
            <button type="button" className="btn btn--primary" onClick={g.newGame}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface BoardProps {
  owner: PlayerId;
  minions: import("./engine").Minion[];
  highlightedTargets: CharacterRef[];
  selectedAttackerId: string | null;
  state: import("./engine").GameState;
  onMinionClick: (instanceId: string, owner: PlayerId) => void;
}

function Board({ owner, minions, highlightedTargets, selectedAttackerId, state, onMinionClick }: BoardProps) {
  return (
    <div className={"board board--" + owner}>
      {minions.length === 0 && <span className="board__empty">— empty —</span>}
      {minions.map((m) => (
        <MinionView
          key={m.instanceId}
          minion={m}
          canAttack={owner === "player" && engineCanAttack(state, "player", m.instanceId)}
          selected={selectedAttackerId === m.instanceId}
          targetable={isTargeted(highlightedTargets, { kind: "minion", instanceId: m.instanceId })}
          onClick={() => onMinionClick(m.instanceId, owner)}
        />
      ))}
    </div>
  );
}
