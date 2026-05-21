import { describe, it, expect } from "vitest";
import {
  createGame,
  endTurn,
  playCard,
  attack,
  canPlayCard,
  RULES,
} from "./engine";
import { runAiTurn } from "./ai";
import type { GameState } from "./types";

function newGame(seed = 42): GameState {
  return createGame({
    seed,
    first: "player",
    playerDeck: Array(30).fill("fallen_imp"),
    aiDeck: Array(30).fill("fallen_imp"),
  });
}

describe("setup", () => {
  it("deals opening hands and gives the first player 1 mana", () => {
    const g = newGame();
    expect(g.players.player.hand.length).toBe(RULES.startingHandFirst + 1); // +1 from beginTurn draw
    expect(g.players.ai.hand.length).toBe(RULES.startingHandSecond);
    expect(g.players.player.maxMana).toBe(1);
    expect(g.players.player.hero.health).toBe(30);
  });
});

describe("playing minions", () => {
  it("spends mana and puts a minion on the board", () => {
    const g = newGame();
    const card = g.players.player.hand[0];
    expect(canPlayCard(g, "player", card.instanceId)).toBe(true);
    const g2 = playCard(g, "player", card.instanceId);
    expect(g2.players.player.board.length).toBe(1);
    expect(g2.players.player.mana).toBe(0);
  });

  it("cannot attack the turn it is summoned (no charge)", () => {
    const g = newGame();
    const card = g.players.player.hand[0];
    const g2 = playCard(g, "player", card.instanceId);
    const minion = g2.players.player.board[0];
    // attacking the enemy hero should be rejected (returns same state)
    const g3 = attack(g2, "player", minion.instanceId, { kind: "hero", player: "ai" });
    expect(g3).toBe(g2);
  });
});

describe("combat", () => {
  it("a charged minion can attack the enemy hero immediately", () => {
    const g = createGame({
      seed: 1,
      playerDeck: Array(30).fill("wirt_companion"), // 1/1 charge
      aiDeck: Array(30).fill("fallen_imp"),
    });
    const card = g.players.player.hand[0];
    const g2 = playCard(g, "player", card.instanceId);
    const minion = g2.players.player.board[0];
    const g3 = attack(g2, "player", minion.instanceId, { kind: "hero", player: "ai" });
    expect(g3.players.ai.hero.health).toBe(29);
  });
});

describe("full turn cycle + AI", () => {
  it("AI takes a turn without throwing and the game stays consistent", () => {
    let g = newGame();
    // player ends immediately
    g = endTurn(g, "player");
    expect(g.current).toBe("ai");
    const frames = runAiTurn(g);
    const final = frames.length ? frames[frames.length - 1] : g;
    expect(final.players.ai.hero.health).toBeLessThanOrEqual(30);
    expect(final.phase === "playing" || final.phase === "gameOver").toBe(true);
  });
});
