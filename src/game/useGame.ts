import { useCallback, useEffect, useRef, useState } from "react";
import {
  attack,
  canAttack,
  canPlayCard,
  createGame,
  endTurn,
  getCardDef,
  playCard,
  runAiTurn,
  starterDeck,
  validAttackTargets,
  validTargets,
} from "../engine";
import type { CharacterRef, GameState, PlayerId } from "../engine";

const AI_FRAME_DELAY_MS = 850;

function sameRef(a: CharacterRef, b: CharacterRef): boolean {
  if (a.kind === "hero" && b.kind === "hero") return a.player === b.player;
  if (a.kind === "minion" && b.kind === "minion") return a.instanceId === b.instanceId;
  return false;
}

function freshGame(): GameState {
  return createGame({
    first: "player",
    playerDeck: starterDeck(),
    aiDeck: starterDeck(),
    playerClass: "barbarian",
    aiClass: "necromancer",
  });
}

export interface UseGame {
  state: GameState;
  /** Whether the AI is currently taking its turn (input locked). */
  aiThinking: boolean;
  /** Hand card the player is about to play (awaiting a target), if any. */
  pendingPlayId: string | null;
  /** Player minion currently selected as an attacker, if any. */
  selectedAttackerId: string | null;
  /** Characters that can be clicked right now given the current selection. */
  highlightedTargets: CharacterRef[];
  isMyTurn: boolean;
  clickHandCard(instanceId: string): void;
  clickMinion(instanceId: string, owner: PlayerId): void;
  clickHero(player: PlayerId): void;
  clickBoard(): void;
  endMyTurn(): void;
  cancelSelection(): void;
  newGame(): void;
}

export function useGame(): UseGame {
  const [state, setState] = useState<GameState>(freshGame);
  const [aiThinking, setAiThinking] = useState(false);
  const [pendingPlayId, setPendingPlayId] = useState<string | null>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const clearSelection = useCallback(() => {
    setPendingPlayId(null);
    setSelectedAttackerId(null);
  }, []);

  // Drive the AI's turn whenever it becomes the AI's move.
  useEffect(() => {
    if (state.phase !== "playing" || state.current !== "ai" || aiThinking) return;
    setAiThinking(true);
    clearSelection();
    const frames = runAiTurn(state);
    let i = 0;
    const playNext = () => {
      if (i < frames.length) {
        setState(frames[i]);
        i += 1;
        timers.current.push(window.setTimeout(playNext, AI_FRAME_DELAY_MS));
      } else {
        const base = frames.length ? frames[frames.length - 1] : state;
        if (base.phase === "playing") {
          setState(endTurn(base, "ai"));
        } else {
          setState(base);
        }
        setAiThinking(false);
      }
    };
    // Small initial pause so the player sees the turn hand off.
    timers.current.push(window.setTimeout(playNext, AI_FRAME_DELAY_MS));
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.current, state.phase]);

  const inputLocked = aiThinking || state.current !== "player" || state.phase !== "playing";

  // Compute clickable targets based on current selection.
  let highlightedTargets: CharacterRef[] = [];
  if (!inputLocked) {
    if (pendingPlayId) {
      const card = state.players.player.hand.find((c) => c.instanceId === pendingPlayId);
      if (card) highlightedTargets = validTargets(state, "player", getCardDef(card.defId));
    } else if (selectedAttackerId) {
      highlightedTargets = validAttackTargets(state, "player");
    }
  }

  const clickHandCard = useCallback(
    (instanceId: string) => {
      if (inputLocked) return;
      if (!canPlayCard(state, "player", instanceId)) return;
      setSelectedAttackerId(null);
      const def = getCardDef(state.players.player.hand.find((c) => c.instanceId === instanceId)!.defId);
      if (def.requiresTarget) {
        // Toggle off if re-clicking the same card.
        setPendingPlayId((prev) => (prev === instanceId ? null : instanceId));
      } else {
        setState(playCard(state, "player", instanceId));
        setPendingPlayId(null);
      }
    },
    [state, inputLocked],
  );

  const tryPlayOnTarget = useCallback(
    (ref: CharacterRef): boolean => {
      if (!pendingPlayId) return false;
      if (!highlightedTargets.some((t) => sameRef(t, ref))) return false;
      setState(playCard(state, "player", pendingPlayId, { target: ref }));
      setPendingPlayId(null);
      return true;
    },
    [pendingPlayId, highlightedTargets, state],
  );

  const tryAttack = useCallback(
    (ref: CharacterRef): boolean => {
      if (!selectedAttackerId) return false;
      if (!highlightedTargets.some((t) => sameRef(t, ref))) return false;
      setState(attack(state, "player", selectedAttackerId, ref));
      setSelectedAttackerId(null);
      return true;
    },
    [selectedAttackerId, highlightedTargets, state],
  );

  const clickMinion = useCallback(
    (instanceId: string, owner: PlayerId) => {
      if (inputLocked) return;
      const ref: CharacterRef = { kind: "minion", instanceId };
      if (tryPlayOnTarget(ref)) return;
      if (tryAttack(ref)) return;
      if (owner === "player" && canAttack(state, "player", instanceId)) {
        setSelectedAttackerId((prev) => (prev === instanceId ? null : instanceId));
        setPendingPlayId(null);
      }
    },
    [state, inputLocked, tryPlayOnTarget, tryAttack],
  );

  const clickHero = useCallback(
    (player: PlayerId) => {
      if (inputLocked) return;
      const ref: CharacterRef = { kind: "hero", player };
      if (tryPlayOnTarget(ref)) return;
      tryAttack(ref);
    },
    [inputLocked, tryPlayOnTarget, tryAttack],
  );

  const clickBoard = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const endMyTurn = useCallback(() => {
    if (inputLocked) return;
    clearSelection();
    setState(endTurn(state, "player"));
  }, [state, inputLocked, clearSelection]);

  const newGame = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setAiThinking(false);
    clearSelection();
    setState(freshGame());
  }, [clearSelection]);

  return {
    state,
    aiThinking,
    pendingPlayId,
    selectedAttackerId,
    highlightedTargets,
    isMyTurn: !inputLocked,
    clickHandCard,
    clickMinion,
    clickHero,
    clickBoard,
    endMyTurn,
    cancelSelection: clearSelection,
    newGame,
  };
}
