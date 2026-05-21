import type { CharacterRef, GameState, PlayerId, PlayerState } from "../src/engine";

/**
 * Turns the canonical game state into the view a given seat is allowed to see:
 *  1. swap so the viewer is always "player" (reuses the single-player UI), and
 *  2. redact the opponent's hidden information (hand contents + deck).
 */
export function viewFor(state: GameState, viewer: PlayerId): GameState {
  const oriented = viewer === "player" ? state : swapState(state);
  return redactOpponent(oriented);
}

/** Mirrors the board: the "ai" seat becomes "player" and vice-versa. */
export function swapState(state: GameState): GameState {
  const s = structuredClone(state);
  const player = s.players.player;
  const ai = s.players.ai;
  player.id = "ai";
  ai.id = "player";
  s.players = { player: ai, ai: player };
  s.current = flip(s.current);
  s.first = flip(s.first);
  s.winner = s.winner == null ? null : flip(s.winner);
  if (s.pendingChoice) s.pendingChoice = { ...s.pendingChoice, player: flip(s.pendingChoice.player) };
  return s;
}

/** Hides what the viewer ("player") shouldn't see about the opponent ("ai"). */
function redactOpponent(state: GameState): GameState {
  const opp: PlayerState = state.players.ai;
  // Keep instance ids (and thus counts) but blank out card identities.
  opp.hand = opp.hand.map((c) => ({ instanceId: c.instanceId, defId: "__hidden__" }));
  opp.deck = opp.deck.map((c) => ({ instanceId: c.instanceId, defId: "__hidden__" }));
  opp.secrets = opp.secrets.map((c) => ({ instanceId: c.instanceId, defId: "__hidden__" }));
  // Don't reveal the opponent's Discover options to the viewer.
  if (state.pendingChoice && state.pendingChoice.player === "ai") {
    state.pendingChoice = { player: "ai", options: [] };
  }
  return state;
}

/** Rewrites a hero reference authored by `viewer` into canonical seats. */
export function refFromViewer(ref: CharacterRef, viewer: PlayerId): CharacterRef {
  if (viewer === "player") return ref; // already canonical
  if (ref.kind === "hero") return { kind: "hero", player: flip(ref.player) };
  return ref; // minion ids are global — no remap needed
}

function flip(p: PlayerId): PlayerId {
  return p === "player" ? "ai" : "player";
}
