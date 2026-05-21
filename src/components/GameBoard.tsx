import { useMemo } from "react";
import type { ReactNode } from "react";
import { canAttack as engineCanAttack, canPlayCard, canUseHeroPower, sameRef, CLASS_LABEL } from "../engine";
import type { CharacterRef, GameState, Minion, PlayerId } from "../engine";
import type { UseGame } from "../game/useGame";
import { useHealthDeltas } from "../game/useHealthDeltas";
import { HandCard } from "./HandCard";
import { MinionView } from "./MinionView";
import { HeroView } from "./HeroView";
import { MulliganModal } from "./MulliganModal";
import type { HealthDelta } from "./FloatingNumber";

interface Props {
  ctrl: UseGame;
  selfName: string;
  enemyName: string;
  showMulligan: boolean;
  onExit: () => void;
  /** When provided, a Rematch button is shown (local games). */
  onRematch?: () => void;
  /** Extra overlay rendered on top (online connection status). */
  banner?: ReactNode;
}

export function GameBoard({ ctrl, selfName, enemyName, showMulligan, onExit, onRematch, banner }: Props) {
  const { state } = ctrl;
  const deltas = useHealthDeltas(state);
  const player = state.players.player;
  const ai = state.players.ai;
  const recentLog = useMemo(() => state.log.slice(-6).reverse(), [state.log]);

  const turnLabel =
    state.phase === "gameOver"
      ? "Game Over"
      : state.phase === "mulligan"
        ? "Mulligan"
        : ctrl.aiThinking
          ? "Enemy is plotting…"
          : ctrl.isMyTurn
            ? "Your Turn"
            : "Enemy Turn";

  return (
    <div className="app" onClick={ctrl.clickBoard}>
      <header className="topbar">
        <h1 className="logo">
          Town<span>stone</span>
        </h1>
        <div className={"turn-banner" + (ctrl.isMyTurn ? " turn-banner--mine" : "")}>{turnLabel}</div>
        <div className="topbar__btns">
          {onRematch && (
            <button type="button" className="btn btn--ghost" onClick={(e) => { e.stopPropagation(); onRematch(); }}>
              Rematch
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={(e) => { e.stopPropagation(); onExit(); }}>
            Main Menu
          </button>
        </div>
      </header>

      <main className="battlefield" onClick={(e) => e.stopPropagation()}>
        <HeroView
          hero={ai.hero}
          player="ai"
          name={enemyName}
          mana={ai.mana}
          maxMana={ai.maxMana}
          deckCount={ai.deck.length}
          handCount={ai.hand.length}
          targetable={isTargeted(ctrl.highlightedTargets, { kind: "hero", player: "ai" })}
          delta={deltas.get("hero:ai")}
          onClick={() => ctrl.clickHero("ai")}
        />

        <Board owner="ai" minions={ai.board} ctrl={ctrl} state={state} deltas={deltas} />

        <div className="midline">
          <span className="midline__rune">✦ ✦ ✦</span>
        </div>

        <Board owner="player" minions={player.board} ctrl={ctrl} state={state} deltas={deltas} />

        <HeroView
          hero={player.hero}
          player="player"
          name={`${selfName} — ${CLASS_LABEL[player.hero.className]}`}
          mana={player.mana}
          maxMana={player.maxMana}
          deckCount={player.deck.length}
          handCount={player.hand.length}
          targetable={isTargeted(ctrl.highlightedTargets, { kind: "hero", player: "player" })}
          delta={deltas.get("hero:player")}
          canUsePower={ctrl.isMyTurn && canUseHeroPower(state, "player")}
          powerSelected={ctrl.pending?.kind === "power"}
          onUsePower={ctrl.clickHeroPower}
          onClick={() => ctrl.clickHero("player")}
        />
      </main>

      <section className="hand" onClick={(e) => e.stopPropagation()}>
        {player.hand.map((card) => (
          <HandCard
            key={card.instanceId}
            card={card}
            playable={ctrl.isMyTurn && canPlayCard(state, "player", card.instanceId)}
            selected={ctrl.pending?.kind === "card" && ctrl.pending.instanceId === card.instanceId}
            onClick={() => ctrl.clickHandCard(card.instanceId)}
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
        <button type="button" className="btn btn--primary" disabled={!ctrl.isMyTurn} onClick={ctrl.endMyTurn}>
          End Turn
        </button>
      </footer>

      {showMulligan && (
        <MulliganModal
          hand={player.hand}
          choices={ctrl.mulliganChoices}
          goingFirst={state.first === "player"}
          onToggle={ctrl.toggleMulligan}
          onConfirm={ctrl.confirmMulligan}
        />
      )}

      {state.phase === "gameOver" && (
        <div className="overlay" onClick={(e) => e.stopPropagation()}>
          <div className="overlay__panel">
            <h2>{state.winner === "player" ? "Victory" : state.winner === "ai" ? "Defeat" : "Draw"}</h2>
            <p>
              {state.winner === "player"
                ? `${enemyName} falls before you.`
                : state.winner === "ai"
                  ? "Darkness claims another hero…"
                  : "Both heroes are consumed."}
            </p>
            <div className="overlay__btns">
              {onRematch && (
                <button type="button" className="btn btn--primary" onClick={onRematch}>
                  Rematch
                </button>
              )}
              <button type="button" className={"btn " + (onRematch ? "btn--ghost" : "btn--primary")} onClick={onExit}>
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {banner}
    </div>
  );
}

function isTargeted(targets: CharacterRef[], ref: CharacterRef): boolean {
  return targets.some((t) => sameRef(t, ref));
}

interface BoardProps {
  owner: PlayerId;
  minions: Minion[];
  ctrl: UseGame;
  state: GameState;
  deltas: Map<string, HealthDelta>;
}

function Board({ owner, minions, ctrl, state, deltas }: BoardProps) {
  return (
    <div className={"board board--" + owner}>
      {minions.length === 0 && <span className="board__empty">— empty —</span>}
      {minions.map((m) => (
        <MinionView
          key={m.instanceId}
          minion={m}
          canAttack={owner === "player" && ctrl.isMyTurn && engineCanAttack(state, "player", m.instanceId)}
          selected={ctrl.selectedAttackerId === m.instanceId}
          targetable={isTargeted(ctrl.highlightedTargets, { kind: "minion", instanceId: m.instanceId })}
          delta={deltas.get(m.instanceId)}
          onClick={() => ctrl.clickMinion(m.instanceId, owner)}
        />
      ))}
    </div>
  );
}
