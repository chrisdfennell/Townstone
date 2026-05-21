import type { CharacterRef, GameState, HeroClass } from "../engine";

/**
 * Wire protocol shared by the client and the authoritative server.
 *
 * Perspective rule: the server keeps one canonical game with the two seats
 * named "player" and "ai" (the engine's PlayerIds). Every `state` message is
 * rewritten so that the *recipient* is always "player" — that way the existing
 * single-player board UI works unchanged for online matches.
 */

export const DEFAULT_PORT = 8787;

/** A character reference as authored from the sender's own perspective. */
export type { CharacterRef };

// ---- Client -> Server ----
export type ClientMessage =
  | { t: "queue"; name: string; className: HeroClass; deck: string[] }
  | { t: "mulligan"; replaceIds: string[] }
  | { t: "play"; instanceId: string; target?: CharacterRef }
  | { t: "power"; target?: CharacterRef }
  | { t: "attack"; attackerId: string; target: CharacterRef }
  | { t: "discover"; index: number }
  | { t: "endTurn" }
  | { t: "leave" };

// ---- Server -> Client ----
export type ServerMessage =
  | { t: "waiting" }
  | { t: "matched"; opponentName: string }
  | { t: "state"; state: GameState }
  | { t: "opponentLeft" }
  | { t: "error"; message: string };
