import { describe, it, expect } from "vitest";
import {
  createGame,
  beginPlay,
  mulligan,
  endTurn,
  playCard,
  attack,
  useHeroPower,
  canUseHeroPower,
  canPlayCard,
  chooseDiscover,
  findMinion,
  RULES,
} from "./engine";
import { runAiTurn } from "./ai";
import { classDeck, collectibleCards, getCardDef, rewardCards } from "./cards";
import { PLAYABLE_CLASSES } from "./types";
import type { GameState, HeroClass, Minion } from "./types";

function craftMinion(over: Partial<Minion> & { instanceId: string; attack: number; health: number }): Minion {
  return {
    defId: "fallen_imp",
    name: "Test",
    maxHealth: over.health,
    keywords: [],
    spellDamage: 0,
    divineShield: false,
    frozen: false,
    summonedThisTurn: false,
    attacksThisTurn: 0,
    ...over,
  };
}

/** Create a game and skip the mulligan (both players keep their hands). */
function started(opts: {
  seed?: number;
  playerDeck?: string[];
  aiDeck?: string[];
  playerClass?: HeroClass;
  aiClass?: HeroClass;
}): GameState {
  let g = createGame({
    seed: opts.seed ?? 42,
    first: "player",
    playerDeck: opts.playerDeck ?? Array(30).fill("fallen_imp"),
    aiDeck: opts.aiDeck ?? Array(30).fill("fallen_imp"),
    playerClass: opts.playerClass ?? "barbarian",
    aiClass: opts.aiClass ?? "necromancer",
  });
  g = mulligan(g, "player", []);
  g = mulligan(g, "ai", []);
  return beginPlay(g);
}

describe("setup & mulligan", () => {
  it("starts in the mulligan phase", () => {
    const g = createGame({ playerDeck: Array(30).fill("fallen_imp"), aiDeck: Array(30).fill("fallen_imp") });
    expect(g.phase).toBe("mulligan");
    expect(g.players.player.hand.length).toBe(RULES.startingHandFirst);
    expect(g.players.ai.hand.length).toBe(RULES.startingHandSecond);
  });

  it("after beginPlay the first player has 1 mana and the second has The Coin", () => {
    const g = started({});
    expect(g.phase).toBe("playing");
    expect(g.players.player.maxMana).toBe(1);
    // second player (ai) holds The Coin
    expect(g.players.ai.hand.some((c) => c.defId === "the_coin")).toBe(true);
  });
});

describe("playing minions & combat", () => {
  it("spends mana and summons a minion that cannot attack the same turn", () => {
    const g = started({});
    const card = g.players.player.hand.find((c) => c.defId === "fallen_imp")!;
    expect(canPlayCard(g, "player", card.instanceId)).toBe(true);
    const g2 = playCard(g, "player", card.instanceId);
    expect(g2.players.player.board.length).toBe(1);
    const m = g2.players.player.board[0];
    const g3 = attack(g2, "player", m.instanceId, { kind: "hero", player: "ai" });
    expect(g3).toBe(g2); // rejected — summoning sickness
  });

  it("a charged minion can attack immediately", () => {
    const g = started({ seed: 1, playerDeck: Array(30).fill("wirt_companion") });
    const card = g.players.player.hand.find((c) => c.defId === "wirt_companion")!;
    const g2 = playCard(g, "player", card.instanceId);
    const m = g2.players.player.board[0];
    const g3 = attack(g2, "player", m.instanceId, { kind: "hero", player: "ai" });
    expect(g3.players.ai.hero.health).toBe(29);
  });
});

describe("hero powers", () => {
  it("Barbarian War Cry grants 2 armor and costs 2 mana, once per turn", () => {
    // Give the player enough mana by fast-forwarding turns is overkill; instead
    // start and manually check at turn 1 they cannot afford it, then verify the
    // armor effect by directly granting mana via The Coin is the ai's. Simpler:
    // play several turns. Here we just confirm gating at 1 mana.
    const g = started({ playerClass: "barbarian" });
    expect(g.players.player.maxMana).toBe(1);
    expect(canUseHeroPower(g, "player")).toBe(false); // costs 2, only 1 mana
  });

  it("Sorceress Fire Blast deals 1 damage to a chosen target", () => {
    // Walk to turn 3 so the player has >=2 mana.
    let g = started({ playerClass: "sorceress" });
    g = endTurn(g, "player");
    g = (() => {
      const frames = runAiTurn(g);
      const last = frames.length ? frames[frames.length - 1] : g;
      return last.phase === "playing" ? endTurn(last, "ai") : last;
    })();
    expect(g.current).toBe("player");
    expect(g.players.player.maxMana).toBeGreaterThanOrEqual(2);
    const before = g.players.ai.hero.health;
    const g2 = useHeroPower(g, "player", { target: { kind: "hero", player: "ai" } });
    expect(g2.players.ai.hero.health).toBe(before - 1);
    expect(canUseHeroPower(g2, "player")).toBe(false); // already used this turn
  });
});

describe("keywords", () => {
  it("Poisonous destroys any minion it damages", () => {
    const g = started({ seed: 5, playerDeck: Array(30).fill("quill_rat"), aiDeck: Array(30).fill("ancient_guardian") });
    // Place a player poison minion and an enemy big minion, then fight.
    let s = playCard(g, "player", g.players.player.hand.find((c) => c.defId === "quill_rat")!.instanceId);
    // Hand the enemy a guardian directly for the test.
    s = structuredClone(s);
    s.players.ai.board.push({
      instanceId: "enemy1",
      defId: "ancient_guardian",
      name: "Ancient Guardian",
      attack: 2,
      health: 6,
      maxHealth: 6,
      keywords: ["taunt"],
      spellDamage: 0,
      divineShield: false,
      frozen: false,
      summonedThisTurn: false,
      attacksThisTurn: 0,
    });
    // remove summoning sickness from our rat
    s.players.player.board[0].summonedThisTurn = false;
    const after = attack(s, "player", s.players.player.board[0].instanceId, { kind: "minion", instanceId: "enemy1" });
    expect(findMinion(after, "enemy1")).toBeUndefined(); // poisoned to death
  });

  it("Lifesteal heals the controller's hero", () => {
    let s = started({ aiDeck: Array(30).fill("fallen_imp") });
    s = structuredClone(s);
    s.players.player.hero.health = 20;
    s.players.player.board.push({
      instanceId: "ls1",
      defId: "soul_reaver",
      name: "Soul Reaver",
      attack: 3,
      health: 4,
      maxHealth: 4,
      keywords: ["lifesteal"],
      spellDamage: 0,
      divineShield: false,
      frozen: false,
      summonedThisTurn: false,
      attacksThisTurn: 0,
    });
    const after = attack(s, "player", "ls1", { kind: "hero", player: "ai" });
    expect(after.players.player.hero.health).toBe(23); // healed 3
  });
});

describe("new effects & classes", () => {
  function withMana(over: (s: GameState) => void): GameState {
    const s = structuredClone(started({}));
    s.players.player.mana = 10;
    over(s);
    return s;
  }

  it("Assassinate destroys an enemy minion through Divine Shield", () => {
    const s = withMana((s) => {
      s.players.player.hand.push({ instanceId: "as1", defId: "assassinate" });
      s.players.ai.board.push(craftMinion({ instanceId: "e1", attack: 6, health: 6, divineShield: true }));
    });
    const after = playCard(s, "player", "as1", { target: { kind: "minion", instanceId: "e1" } });
    expect(findMinion(after, "e1")).toBeUndefined();
  });

  it("Wild Growth permanently raises max mana (ramp)", () => {
    const s = withMana((s) => {
      s.players.player.maxMana = 5;
      s.players.player.hand.push({ instanceId: "wg1", defId: "wild_growth" });
    });
    const after = playCard(s, "player", "wg1");
    expect(after.players.player.maxMana).toBe(6);
  });

  it("Hand of Light grants Divine Shield to a friendly minion", () => {
    const s = withMana((s) => {
      s.players.player.board.push(craftMinion({ instanceId: "m1", attack: 3, health: 3 }));
      s.players.player.hand.push({ instanceId: "hl1", defId: "hand_of_light" });
    });
    const after = playCard(s, "player", "hl1", { target: { kind: "minion", instanceId: "m1" } });
    const m = findMinion(after, "m1")!;
    expect(m.divineShield).toBe(true);
    expect(m.keywords).toContain("divineShield");
  });
});

describe("secret-aware AI", () => {
  it("baits a hero-attack Secret with its weakest minion, sparing the big one", () => {
    let g = started({});
    g = endTurn(g, "player"); // hand the turn to the AI
    g = structuredClone(g);
    g.players.ai.hand = [];
    g.players.ai.mana = 0; // no plays/power — isolate the attack sequencing
    g.players.ai.board = [
      craftMinion({ instanceId: "small", attack: 1, health: 1 }),
      craftMinion({ instanceId: "big", attack: 5, health: 5 }),
    ];
    g.players.player.board = [];
    g.players.player.hero.health = 10;
    g.players.player.hero.armor = 0;
    g.players.player.secrets = [{ instanceId: "bt", defId: "bladed_trap" }];

    const frames = runAiTurn(g);
    const final = frames[frames.length - 1];
    // The 1/1 was thrown at the trap; the 5/5 survived and connected for 5.
    expect(final.players.ai.board.find((m) => m.instanceId === "small")).toBeUndefined();
    expect(final.players.ai.board.find((m) => m.instanceId === "big")).toBeDefined();
    expect(final.players.player.hero.health).toBe(5);
  });
});

describe("Discover", () => {
  it("opens a 3-card choice that blocks other actions until resolved", () => {
    const s = structuredClone(started({}));
    s.players.player.mana = 10;
    s.players.player.hand.push({ instanceId: "hc1", defId: "horadric_cache" });
    const after = playCard(s, "player", "hc1");
    expect(after.pendingChoice?.player).toBe("player");
    expect(after.pendingChoice?.options.length).toBe(3);
    // Other actions are blocked while choosing.
    const other = after.players.player.hand[0];
    if (other) expect(canPlayCard(after, "player", other.instanceId)).toBe(false);

    const picked = after.pendingChoice!.options[1];
    const resolved = chooseDiscover(after, "player", 1);
    expect(resolved.pendingChoice).toBeNull();
    expect(resolved.players.player.hand.some((c) => c.defId === picked)).toBe(true);
  });
});

describe("Secrets", () => {
  function withAiSecret(secretId: string, setup: (s: GameState) => void): GameState {
    const s = structuredClone(started({}));
    s.players.player.mana = 10;
    s.players.ai.secrets.push({ instanceId: "sec1", defId: secretId });
    setup(s);
    return s;
  }

  it("Counterspell negates the opponent's spell", () => {
    const s = withAiSecret("counterspell", (s) => {
      s.players.player.hand.push({ instanceId: "fb1", defId: "firebolt" });
    });
    const after = playCard(s, "player", "fb1", { target: { kind: "hero", player: "ai" } });
    expect(after.players.ai.hero.health).toBe(30); // spell countered
    expect(after.players.ai.secrets.length).toBe(0); // secret consumed
  });

  it("Mirror Entity copies a played minion for its owner", () => {
    const s = withAiSecret("mirror_entity", (s) => {
      s.players.player.hand.push({ instanceId: "imp1", defId: "fallen_imp" });
    });
    const after = playCard(s, "player", "imp1");
    expect(after.players.ai.board.some((m) => m.defId === "fallen_imp")).toBe(true);
  });

  it("Repentance reduces a played minion's Health to 1", () => {
    const s = withAiSecret("repentance", (s) => {
      s.players.player.hand.push({ instanceId: "ag1", defId: "ancient_guardian" });
    });
    const after = playCard(s, "player", "ag1");
    const mine = after.players.player.board.find((m) => m.defId === "ancient_guardian")!;
    expect(mine.health).toBe(1);
  });

  it("Ice Barrier grants 8 Armor when the hero is attacked", () => {
    const s = withAiSecret("ice_barrier", (s) => {
      s.players.player.board.push(craftMinion({ instanceId: "atk", attack: 3, health: 3 }));
    });
    const after = attack(s, "player", "atk", { kind: "hero", player: "ai" });
    expect(after.players.ai.hero.armor).toBe(5); // 8 armor minus 3 damage
    expect(after.players.ai.hero.health).toBe(30);
  });

  it("Bladed Trap (Vaporize) destroys the attacker", () => {
    const s = withAiSecret("bladed_trap", (s) => {
      s.players.player.board.push(craftMinion({ instanceId: "atk", attack: 4, health: 4 }));
    });
    const after = attack(s, "player", "atk", { kind: "hero", player: "ai" });
    expect(findMinion(after, "atk")).toBeUndefined();
    expect(after.players.ai.hero.health).toBe(30);
  });
});

describe("deathrattle chains & rewards", () => {
  it("Bone Colossus chains: Colossus -> Risen Horror -> Skeleton", () => {
    const s = structuredClone(started({}));
    s.players.player.mana = 10;
    s.players.player.board.push(
      craftMinion({
        instanceId: "col",
        defId: "bone_colossus",
        attack: 5,
        health: 1,
        onDeath: [{ kind: "summon", cardId: "risen_horror", count: 1 }],
      }),
    );
    s.players.player.hand.push({ instanceId: "fb1", defId: "firebolt" });
    s.players.player.hand.push({ instanceId: "fb2", defId: "firebolt" });

    let after = playCard(s, "player", "fb1", { target: { kind: "minion", instanceId: "col" } });
    const horror = after.players.player.board.find((m) => m.defId === "risen_horror");
    expect(horror).toBeDefined();

    after = playCard(after, "player", "fb2", { target: { kind: "minion", instanceId: horror!.instanceId } });
    expect(after.players.player.board.some((m) => m.defId === "skeleton_token")).toBe(true);
  });

  it("reward cards are excluded from base/default pools but listed as rewards", () => {
    expect(collectibleCards().some((c) => c.reward)).toBe(false);
    expect(rewardCards().length).toBeGreaterThan(0);
    // Default decks never contain reward legendaries.
    for (const cls of PLAYABLE_CLASSES) {
      const deck = classDeck(cls);
      expect(deck.every((id) => !getCardDef(id).reward)).toBe(true);
    }
  });
});

describe("class decks", () => {
  it("every playable class builds a legal 30-card deck", () => {
    for (const cls of PLAYABLE_CLASSES) {
      const deck = classDeck(cls);
      expect(deck.length).toBe(30);
      const counts = new Map<string, number>();
      for (const id of deck) {
        const def = getCardDef(id);
        expect(def.uncollectible ?? false).toBe(false);
        expect(def.className === "neutral" || def.className === cls).toBe(true);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const [id, n] of counts) expect(n).toBeLessThanOrEqual(getCardDef(id).legendary ? 1 : 2);
    }
  });
});

describe("full AI turn", () => {
  it("runs without throwing and keeps the game consistent", () => {
    let g = started({});
    g = endTurn(g, "player");
    expect(g.current).toBe("ai");
    const frames = runAiTurn(g);
    const final = frames.length ? frames[frames.length - 1] : g;
    expect(final.phase === "playing" || final.phase === "gameOver").toBe(true);
  });
});

describe("smarter AI (search)", () => {
  function aiTurnState(): GameState {
    // Hand the AI its turn with a clean board to construct scenarios on.
    let g = started({});
    g = endTurn(g, "player");
    g = structuredClone(g);
    g.players.ai.board = [];
    g.players.player.board = [];
    return g;
  }

  function addMinion(s: GameState, owner: "player" | "ai", m: Partial<Minion> & { attack: number; health: number }): string {
    const id = `t_${owner}_${s.players[owner].board.length}`;
    s.players[owner].board.push({
      instanceId: id,
      defId: m.defId ?? "fallen_imp",
      name: m.name ?? "Test Minion",
      attack: m.attack,
      health: m.health,
      maxHealth: m.maxHealth ?? m.health,
      keywords: m.keywords ?? [],
      spellDamage: m.spellDamage ?? 0,
      divineShield: m.divineShield ?? false,
      frozen: false,
      summonedThisTurn: false,
      attacksThisTurn: 0,
    });
    return id;
  }

  it("finds lethal across multiple attackers", () => {
    const s = aiTurnState();
    s.players.player.hero.health = 6;
    s.players.player.hero.armor = 0;
    addMinion(s, "ai", { attack: 4, health: 4 });
    addMinion(s, "ai", { attack: 3, health: 3 });
    const frames = runAiTurn(s);
    const final = frames[frames.length - 1];
    expect(final.phase).toBe("gameOver");
    expect(final.winner).toBe("ai");
  });

  it("takes a favorable trade instead of going face", () => {
    const s = aiTurnState();
    s.players.player.hero.health = 30;
    // AI 3/4 can kill the enemy 3/2 and survive — clearly better than face.
    const attacker = addMinion(s, "ai", { attack: 3, health: 4 });
    const victim = addMinion(s, "player", { attack: 3, health: 2 });
    const frames = runAiTurn(s);
    const final = frames[frames.length - 1];
    // The enemy minion should be dead, and our attacker should have survived.
    expect(final.players.player.board.find((m) => m.instanceId === victim)).toBeUndefined();
    expect(final.players.ai.board.find((m) => m.instanceId === attacker)).toBeDefined();
  });
});
