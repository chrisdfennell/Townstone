import { describe, it, expect } from "vitest";
import { Match, sanitizeDeck, type Seat } from "./match";
import { classDeck, createGame, getCardDef } from "../src/engine";
import type { GameState } from "../src/engine";
import { viewFor } from "./perspective";
import type { ServerMessage } from "../src/net/protocol";

function makeSeat(name: string, className: "barbarian" | "sorceress" | "necromancer" | "demonhunter") {
  const inbox: ServerMessage[] = [];
  const seat: Seat = { name, className, deck: classDeck(className), send: (m) => inbox.push(m) };
  return {
    seat,
    inbox,
    lastState(): GameState | undefined {
      for (let i = inbox.length - 1; i >= 0; i--) if (inbox[i].t === "state") return (inbox[i] as { state: GameState }).state;
      return undefined;
    },
  };
}

describe("deck sanitization", () => {
  it("rejects an oversized / illegal deck and falls back to the class deck", () => {
    expect(sanitizeDeck("barbarian", Array(30).fill("fallen_imp")).length).toBe(30); // too many copies -> fallback
    // 30 imps would exceed the 2-copy limit, so we expect the default deck instead.
    expect(sanitizeDeck("barbarian", Array(30).fill("fallen_imp")).filter((id) => id === "fallen_imp").length).toBeLessThanOrEqual(2);
    expect(sanitizeDeck("sorceress", "not-an-array").length).toBe(30);
  });
});

describe("Match perspective & sync", () => {
  it("orients each seat as 'player' and redacts the opponent's hand", () => {
    const a = makeSeat("Aidan", "barbarian");
    const b = makeSeat("Bron", "sorceress");
    new Match(a.seat, b.seat, 123);

    // Both got matched with the correct opponent name.
    expect(a.inbox.find((m) => m.t === "matched")).toMatchObject({ opponentName: "Bron" });
    expect(b.inbox.find((m) => m.t === "matched")).toMatchObject({ opponentName: "Aidan" });

    const av = a.lastState()!;
    const bv = b.lastState()!;
    // Each viewer sees themselves under the "player" seat.
    expect(av.players.player.hero.className).toBe("barbarian");
    expect(bv.players.player.hero.className).toBe("sorceress");
    // The opponent's hand is hidden but its size is preserved.
    expect(av.players.ai.hand.every((c) => c.defId === "__hidden__")).toBe(true);
    expect(av.players.player.hand.every((c) => c.defId !== "__hidden__")).toBe(true);
    expect(bv.players.ai.hand.every((c) => c.defId === "__hidden__")).toBe(true);
  });

  it("starts the first player's turn after both mulligan, from each perspective", () => {
    const a = makeSeat("A", "barbarian");
    const b = makeSeat("B", "necromancer");
    const match = new Match(a.seat, b.seat, 7);

    match.handle("player", { t: "mulligan", replaceIds: [] });
    match.handle("ai", { t: "mulligan", replaceIds: [] });

    expect(a.lastState()!.phase).toBe("playing");
    // It is seat A's turn: A sees current="player"; B sees current="ai" (opponent).
    expect(a.lastState()!.current).toBe("player");
    expect(b.lastState()!.current).toBe("ai");
  });

  it("redacts the opponent's Secrets and Discover options", () => {
    const g = createGame({
      seed: 3,
      first: "player",
      playerClass: "sorceress",
      aiClass: "rogue",
      playerDeck: classDeck("sorceress"),
      aiDeck: classDeck("rogue"),
    });
    // "player" seat is mid-Discover and holds a Secret.
    g.pendingChoice = { player: "player", options: ["firebolt", "fireball", "frost_nova"] };
    g.players.player.secrets.push({ instanceId: "s1", defId: "counterspell" });

    // The choosing player sees their own options and Secret identity.
    const own = viewFor(g, "player");
    expect(own.pendingChoice?.options.length).toBe(3);
    expect(own.players.player.secrets[0].defId).toBe("counterspell");

    // The opponent sees neither: options blanked, secret hidden.
    const foe = viewFor(g, "ai");
    expect(foe.pendingChoice?.player).toBe("ai"); // the *other* seat is choosing
    expect(foe.pendingChoice?.options.length).toBe(0);
    expect(foe.players.ai.secrets[0].defId).toBe("__hidden__");
  });

  it("a play by one seat appears on the opponent's board view too", () => {
    const a = makeSeat("A", "barbarian");
    const b = makeSeat("B", "necromancer");
    const match = new Match(a.seat, b.seat, 7);
    match.handle("player", { t: "mulligan", replaceIds: [] });
    match.handle("ai", { t: "mulligan", replaceIds: [] });

    // Seat A plays the cheapest non-targeted minion it can afford this turn.
    const av = a.lastState()!;
    const playable = av.players.player.hand.find((c) => {
      const def = getCardDef(c.defId);
      return def.type === "minion" && def.cost <= av.players.player.mana && !def.requiresTarget;
    });
    if (!playable) return; // unlucky opening hand; perspective already covered above

    match.handle("player", { t: "play", instanceId: playable.instanceId });

    // A sees it on its own board; B sees the same minion on the opponent's board.
    expect(a.lastState()!.players.player.board.length).toBe(1);
    expect(b.lastState()!.players.ai.board.length).toBe(1);
    expect(a.lastState()!.players.player.board[0].instanceId).toBe(b.lastState()!.players.ai.board[0].instanceId);
  });
});
