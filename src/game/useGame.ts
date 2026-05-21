import { useCallback, useEffect, useRef, useState } from "react";
import {
  attack,
  beginPlay,
  canAttack,
  canPlayCard,
  canUseHeroPower,
  chooseMulligan,
  createGame,
  endTurn,
  getCardDef,
  mulligan,
  playCard,
  runAiTurn,
  sameRef,
  useHeroPower,
  validAttackTargets,
  validTargets,
} from "../engine";
import type { CharacterRef, GameState, HeroClass, PlayerId } from "../engine";

const AI_FRAME_DELAY_MS = 850;

export interface GameConfig {
  playerClass: HeroClass;
  playerDeck: string[];
  aiClass: HeroClass;
  aiDeck: string[];
  seed?: number;
}

/** What the player is currently committing to act with (awaiting a target). */
type Pending = { kind: "card"; instanceId: string } | { kind: "power" } | null;

export interface UseGame {
  state: GameState;
  aiThinking: boolean;
  pending: Pending;
  selectedAttackerId: string | null;
  highlightedTargets: CharacterRef[];
  isMyTurn: boolean;
  /** Hand instance ids the player has marked to replace during the mulligan. */
  mulliganChoices: string[];
  clickHandCard(instanceId: string): void;
  clickHeroPower(): void;
  clickMinion(instanceId: string, owner: PlayerId): void;
  clickHero(player: PlayerId): void;
  clickBoard(): void;
  endMyTurn(): void;
  toggleMulligan(instanceId: string): void;
  confirmMulligan(): void;
  cancelSelection(): void;
}

export function useGame(config: GameConfig): UseGame {
  const [state, setState] = useState<GameState>(() =>
    createGame({
      first: "player",
      playerClass: config.playerClass,
      playerDeck: config.playerDeck,
      aiClass: config.aiClass,
      aiDeck: config.aiDeck,
      seed: config.seed,
    }),
  );
  const [aiThinking, setAiThinking] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [mulliganChoices, setMulliganChoices] = useState<string[]>([]);
  const timers = useRef<number[]>([]);

  const clearSelection = useCallback(() => {
    setPending(null);
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
        setState(base.phase === "playing" ? endTurn(base, "ai") : base);
        setAiThinking(false);
      }
    };
    timers.current.push(window.setTimeout(playNext, AI_FRAME_DELAY_MS));
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.current, state.phase]);

  const inputLocked = aiThinking || state.current !== "player" || state.phase !== "playing";

  // Compute clickable targets based on the current pending action.
  let highlightedTargets: CharacterRef[] = [];
  if (!inputLocked) {
    if (pending?.kind === "card") {
      const card = state.players.player.hand.find((c) => c.instanceId === pending.instanceId);
      if (card) highlightedTargets = validTargets(state, "player", getCardDef(card.defId).targetFilter);
    } else if (pending?.kind === "power") {
      highlightedTargets = validTargets(state, "player", state.players.player.hero.power.targetFilter);
    } else if (selectedAttackerId) {
      highlightedTargets = validAttackTargets(state, "player");
    }
  }

  const resolvePendingOnTarget = useCallback(
    (ref: CharacterRef): boolean => {
      if (!pending) return false;
      if (!highlightedTargets.some((t) => sameRef(t, ref))) return false;
      if (pending.kind === "card") setState(playCard(state, "player", pending.instanceId, { target: ref }));
      else setState(useHeroPower(state, "player", { target: ref }));
      setPending(null);
      return true;
    },
    [pending, highlightedTargets, state],
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

  const clickHandCard = useCallback(
    (instanceId: string) => {
      if (inputLocked || !canPlayCard(state, "player", instanceId)) return;
      setSelectedAttackerId(null);
      const def = getCardDef(state.players.player.hand.find((c) => c.instanceId === instanceId)!.defId);
      if (def.requiresTarget) {
        setPending((prev) => (prev?.kind === "card" && prev.instanceId === instanceId ? null : { kind: "card", instanceId }));
      } else {
        setState(playCard(state, "player", instanceId));
        setPending(null);
      }
    },
    [state, inputLocked],
  );

  const clickHeroPower = useCallback(() => {
    if (inputLocked || !canUseHeroPower(state, "player")) return;
    setSelectedAttackerId(null);
    const power = state.players.player.hero.power;
    if (power.requiresTarget) {
      setPending((prev) => (prev?.kind === "power" ? null : { kind: "power" }));
    } else {
      setState(useHeroPower(state, "player"));
      setPending(null);
    }
  }, [state, inputLocked]);

  const clickMinion = useCallback(
    (instanceId: string, owner: PlayerId) => {
      if (inputLocked) return;
      const ref: CharacterRef = { kind: "minion", instanceId };
      if (resolvePendingOnTarget(ref)) return;
      if (tryAttack(ref)) return;
      if (owner === "player" && canAttack(state, "player", instanceId)) {
        setSelectedAttackerId((prev) => (prev === instanceId ? null : instanceId));
        setPending(null);
      }
    },
    [state, inputLocked, resolvePendingOnTarget, tryAttack],
  );

  const clickHero = useCallback(
    (player: PlayerId) => {
      if (inputLocked) return;
      const ref: CharacterRef = { kind: "hero", player };
      if (resolvePendingOnTarget(ref)) return;
      tryAttack(ref);
    },
    [inputLocked, resolvePendingOnTarget, tryAttack],
  );

  const clickBoard = useCallback(() => clearSelection(), [clearSelection]);

  const endMyTurn = useCallback(() => {
    if (inputLocked) return;
    clearSelection();
    setState(endTurn(state, "player"));
  }, [state, inputLocked, clearSelection]);

  const toggleMulligan = useCallback((instanceId: string) => {
    setMulliganChoices((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId],
    );
  }, []);

  const confirmMulligan = useCallback(() => {
    if (state.phase !== "mulligan") return;
    let s = mulligan(state, "player", mulliganChoices);
    s = mulligan(s, "ai", chooseMulligan(s, "ai"));
    s = beginPlay(s);
    setMulliganChoices([]);
    setState(s);
  }, [state, mulliganChoices]);

  return {
    state,
    aiThinking,
    pending,
    selectedAttackerId,
    highlightedTargets,
    isMyTurn: !inputLocked,
    mulliganChoices,
    clickHandCard,
    clickHeroPower,
    clickMinion,
    clickHero,
    clickBoard,
    endMyTurn,
    toggleMulligan,
    confirmMulligan,
    cancelSelection: clearSelection,
  };
}
