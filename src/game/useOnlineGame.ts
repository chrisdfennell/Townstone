import { useCallback, useEffect, useRef, useState } from "react";
import {
  canAttack,
  canPlayCard,
  canUseHeroPower,
  getCardDef,
  sameRef,
  validAttackTargets,
  validTargets,
} from "../engine";
import type { CharacterRef, GameState, HeroClass, PlayerId } from "../engine";
import { Connection } from "../net/connection";
import type { UseGame } from "./useGame";

export interface OnlineConfig {
  name: string;
  playerClass: HeroClass;
  playerDeck: string[];
}

export type OnlineStatus =
  | "connecting"
  | "waiting"
  | "mulligan"
  | "playing"
  | "gameOver"
  | "opponentLeft"
  | "error";

type Pending = { kind: "card"; instanceId: string } | { kind: "power" } | null;

/** UseGame-compatible controller, plus connection status, for online matches. */
export interface OnlineController extends Omit<UseGame, "state"> {
  state: GameState | null;
  status: OnlineStatus;
  opponentName: string;
  mulliganSubmitted: boolean;
}

export function useOnlineGame(config: OnlineConfig): OnlineController {
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<OnlineStatus>("connecting");
  const [opponentName, setOpponentName] = useState("Opponent");
  const [pending, setPending] = useState<Pending>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [mulliganChoices, setMulliganChoices] = useState<string[]>([]);
  const [mulliganSubmitted, setMulliganSubmitted] = useState(false);
  // Locks input between sending an action and receiving the authoritative reply.
  const [awaiting, setAwaiting] = useState(false);
  const conn = useRef<Connection | null>(null);
  // Did we ever get into a game? Distinguishes "opponent left" from "couldn't connect".
  const gotState = useRef(false);

  useEffect(() => {
    const c = new Connection({
      onOpen: () => c.send({ t: "queue", name: config.name, className: config.playerClass, deck: config.playerDeck }),
      onMessage: (msg) => {
        switch (msg.t) {
          case "waiting":
            setStatus("waiting");
            break;
          case "matched":
            setOpponentName(msg.opponentName);
            break;
          case "state":
            gotState.current = true;
            setState(msg.state);
            setAwaiting(false);
            setStatus(msg.state.phase === "mulligan" ? "mulligan" : msg.state.phase === "gameOver" ? "gameOver" : "playing");
            break;
          case "opponentLeft":
            setStatus("opponentLeft");
            break;
          case "error":
            setStatus("error");
            break;
        }
      },
      // Closed/failed before any game state means we never reached the server.
      onClose: () => setStatus((s) => (s === "gameOver" ? s : gotState.current ? "opponentLeft" : "error")),
      onError: () => setStatus((s) => (gotState.current ? s : "error")),
    });
    conn.current = c;
    return () => {
      c.send({ t: "leave" });
      c.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearSelection = useCallback(() => {
    setPending(null);
    setSelectedAttackerId(null);
  }, []);

  const inputLocked =
    awaiting || !state || state.phase !== "playing" || state.current !== "player";

  let highlightedTargets: CharacterRef[] = [];
  if (!inputLocked && state) {
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
      if (!pending || !state) return false;
      if (!highlightedTargets.some((t) => sameRef(t, ref))) return false;
      if (pending.kind === "card") conn.current?.send({ t: "play", instanceId: pending.instanceId, target: ref });
      else conn.current?.send({ t: "power", target: ref });
      setPending(null);
      setAwaiting(true);
      return true;
    },
    [pending, state, highlightedTargets],
  );

  const tryAttack = useCallback(
    (ref: CharacterRef): boolean => {
      if (!selectedAttackerId) return false;
      if (!highlightedTargets.some((t) => sameRef(t, ref))) return false;
      conn.current?.send({ t: "attack", attackerId: selectedAttackerId, target: ref });
      setSelectedAttackerId(null);
      setAwaiting(true);
      return true;
    },
    [selectedAttackerId, highlightedTargets],
  );

  const clickHandCard = useCallback(
    (instanceId: string) => {
      if (inputLocked || !state || !canPlayCard(state, "player", instanceId)) return;
      setSelectedAttackerId(null);
      const def = getCardDef(state.players.player.hand.find((c) => c.instanceId === instanceId)!.defId);
      if (def.requiresTarget) {
        setPending((prev) => (prev?.kind === "card" && prev.instanceId === instanceId ? null : { kind: "card", instanceId }));
      } else {
        conn.current?.send({ t: "play", instanceId });
        setPending(null);
        setAwaiting(true);
      }
    },
    [state, inputLocked],
  );

  const clickHeroPower = useCallback(() => {
    if (inputLocked || !state || !canUseHeroPower(state, "player")) return;
    setSelectedAttackerId(null);
    if (state.players.player.hero.power.requiresTarget) {
      setPending((prev) => (prev?.kind === "power" ? null : { kind: "power" }));
    } else {
      conn.current?.send({ t: "power" });
      setPending(null);
      setAwaiting(true);
    }
  }, [state, inputLocked]);

  const clickMinion = useCallback(
    (instanceId: string, owner: PlayerId) => {
      if (inputLocked || !state) return;
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

  const endMyTurn = useCallback(() => {
    if (inputLocked) return;
    clearSelection();
    conn.current?.send({ t: "endTurn" });
    setAwaiting(true);
  }, [inputLocked, clearSelection]);

  const chooseDiscoverOption = useCallback(
    (index: number) => {
      if (state?.pendingChoice?.player !== "player") return;
      conn.current?.send({ t: "discover", index });
      setAwaiting(true);
    },
    [state],
  );

  const toggleMulligan = useCallback((instanceId: string) => {
    setMulliganChoices((prev) => (prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId]));
  }, []);

  const confirmMulligan = useCallback(() => {
    conn.current?.send({ t: "mulligan", replaceIds: mulliganChoices });
    setMulliganSubmitted(true);
  }, [mulliganChoices]);

  return {
    state,
    status,
    opponentName,
    mulliganSubmitted,
    aiThinking: false,
    pending,
    selectedAttackerId,
    highlightedTargets,
    isMyTurn: !inputLocked,
    mulliganChoices,
    clickHandCard,
    clickHeroPower,
    clickMinion,
    clickHero,
    clickBoard: clearSelection,
    endMyTurn,
    toggleMulligan,
    confirmMulligan,
    chooseDiscover: chooseDiscoverOption,
    cancelSelection: clearSelection,
  };
}
