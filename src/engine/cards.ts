import type { CardDef, HeroClass } from "./types";

/**
 * Townstone card pool.
 *
 * Diablo-flavored neutral + class cards. Stats are tuned loosely against the
 * usual "vanilla" curve (cost N minion ~ (N*2)/(N*2) stats) so games feel fair.
 */
export const CARD_DEFS: CardDef[] = [
  // ---- Neutral minions -----------------------------------------------------
  {
    id: "fallen_imp",
    name: "Fallen Imp",
    cost: 1,
    type: "minion",
    className: "neutral",
    attack: 1,
    health: 2,
    text: "",
    flavor: "They scuttle up from the Burning Hells in chittering swarms.",
  },
  {
    id: "quill_rat",
    name: "Quill Rat",
    cost: 1,
    type: "minion",
    className: "neutral",
    attack: 1,
    health: 1,
    keywords: ["poisonous"],
    text: "Poisonous",
    flavor: "One scratch is all it takes.",
  },
  {
    id: "skeleton_warrior",
    name: "Skeleton Warrior",
    cost: 2,
    type: "minion",
    className: "neutral",
    attack: 2,
    health: 3,
    text: "",
    flavor: "Death is only the beginning of its service.",
  },
  {
    id: "treasure_goblin",
    name: "Treasure Goblin",
    cost: 2,
    type: "minion",
    className: "neutral",
    attack: 1,
    health: 1,
    text: "Battlecry: Draw a card.",
    onPlay: [{ kind: "draw", amount: 1 }],
    flavor: "Catch it if you can. You can't.",
  },
  {
    id: "carver_brute",
    name: "Carver Brute",
    cost: 3,
    type: "minion",
    className: "neutral",
    attack: 3,
    health: 4,
    text: "",
    flavor: "It does not feel the wounds. It only feels hunger.",
  },
  {
    id: "hell_hound",
    name: "Hell Hound",
    cost: 3,
    type: "minion",
    className: "neutral",
    attack: 3,
    health: 2,
    keywords: ["charge"],
    text: "Charge",
    flavor: "It was hunting you before you were born.",
  },
  {
    id: "ancient_guardian",
    name: "Ancient Guardian",
    cost: 4,
    type: "minion",
    className: "neutral",
    attack: 2,
    health: 6,
    keywords: ["taunt"],
    text: "Taunt",
    flavor: "Stone does not tire, and stone does not yield.",
  },
  {
    id: "blood_clan_warrior",
    name: "Blood Clan Warrior",
    cost: 4,
    type: "minion",
    className: "neutral",
    attack: 4,
    health: 5,
    text: "",
    flavor: "The Blood Clan drink deep before every battle.",
  },
  {
    id: "winged_harpy",
    name: "Winged Harpy",
    cost: 4,
    type: "minion",
    className: "neutral",
    attack: 3,
    health: 3,
    keywords: ["windfury"],
    text: "Windfury",
    flavor: "It strikes twice before you hear the wings.",
  },
  {
    id: "blessed_paladin",
    name: "Zakarum Templar",
    cost: 3,
    type: "minion",
    className: "neutral",
    attack: 2,
    health: 3,
    keywords: ["divineShield"],
    text: "Divine Shield",
    flavor: "Faith is the finest armor.",
  },
  {
    id: "the_butcher",
    name: "The Butcher",
    cost: 7,
    type: "minion",
    className: "neutral",
    attack: 7,
    health: 7,
    keywords: ["taunt"],
    legendary: true,
    text: "Taunt. Battlecry: Deal 2 damage to all enemy minions.",
    onPlay: [{ kind: "damage", selector: "allEnemyMinions", amount: 2 }],
    flavor: "\"Fresh meat!\"",
  },
  {
    id: "andariel",
    name: "Andariel, Maiden of Anguish",
    cost: 6,
    type: "minion",
    className: "neutral",
    attack: 5,
    health: 5,
    legendary: true,
    text: "Deathrattle: Deal 3 damage to the enemy hero.",
    onDeath: [{ kind: "damage", selector: "enemyHero", amount: 3 }],
    flavor: "Her death is merely another kind of attack.",
  },
  {
    id: "diablo",
    name: "Diablo, Lord of Terror",
    cost: 9,
    type: "minion",
    className: "neutral",
    attack: 8,
    health: 8,
    keywords: ["charge"],
    legendary: true,
    text: "Charge.",
    flavor: "Not even death can save you from him.",
  },

  // ---- Barbarian -----------------------------------------------------------
  {
    id: "wirt_companion",
    name: "Wirt's Leg",
    cost: 1,
    type: "minion",
    className: "barbarian",
    attack: 1,
    health: 1,
    keywords: ["charge"],
    text: "Charge.",
    flavor: "A surprisingly effective weapon.",
  },
  {
    id: "whirlwind_berserker",
    name: "Whirlwind Berserker",
    cost: 5,
    type: "minion",
    className: "barbarian",
    attack: 3,
    health: 5,
    keywords: ["windfury"],
    text: "Windfury",
    flavor: "Round and round, and the screaming never stops.",
  },
  {
    id: "battle_cry",
    name: "Battle Rage",
    cost: 2,
    type: "spell",
    className: "barbarian",
    text: "Give your minions +1/+1.",
    onPlay: [{ kind: "buff", selector: "allFriendlyMinions", attack: 1, health: 1 }],
    flavor: "For the Ancients!",
  },
  {
    id: "iron_skin",
    name: "Iron Skin",
    cost: 1,
    type: "spell",
    className: "barbarian",
    text: "Gain 5 Armor.",
    onPlay: [{ kind: "armor", selector: "friendlyHero", amount: 5 }],
    flavor: "Let them come.",
  },
  {
    id: "leap_attack",
    name: "Leap Attack",
    cost: 2,
    type: "spell",
    className: "barbarian",
    text: "Deal 4 damage to a minion.",
    onPlay: [{ kind: "damage", selector: "chosen", amount: 4 }],
    requiresTarget: true,
    targetFilter: "anyMinion",
    flavor: "Gravity is a weapon.",
  },

  // ---- Sorceress -----------------------------------------------------------
  {
    id: "coven_acolyte",
    name: "Coven Acolyte",
    cost: 2,
    type: "minion",
    className: "sorceress",
    attack: 1,
    health: 3,
    spellDamage: 1,
    text: "Spell Damage +1",
    flavor: "Her whispers make the fire hotter.",
  },
  {
    id: "firebolt",
    name: "Firebolt",
    cost: 1,
    type: "spell",
    className: "sorceress",
    text: "Deal 2 damage.",
    onPlay: [{ kind: "damage", selector: "chosen", amount: 2 }],
    requiresTarget: true,
    targetFilter: "any",
    flavor: "The first spell every Sorceress learns.",
  },
  {
    id: "fireball",
    name: "Fireball",
    cost: 4,
    type: "spell",
    className: "sorceress",
    text: "Deal 6 damage.",
    onPlay: [{ kind: "damage", selector: "chosen", amount: 6 }],
    requiresTarget: true,
    targetFilter: "any",
    flavor: "Subtlety is for the timid.",
  },
  {
    id: "frost_nova",
    name: "Frozen Orb",
    cost: 3,
    type: "spell",
    className: "sorceress",
    text: "Deal 1 damage to all enemy minions and Freeze them.",
    onPlay: [
      { kind: "damage", selector: "allEnemyMinions", amount: 1 },
      { kind: "freeze", selector: "allEnemyMinions" },
    ],
    flavor: "It lingers, grinding everything in its path.",
  },
  {
    id: "glacial_spike",
    name: "Glacial Spike",
    cost: 2,
    type: "spell",
    className: "sorceress",
    text: "Deal 2 damage to a minion and Freeze it.",
    onPlay: [
      { kind: "damage", selector: "chosen", amount: 2 },
      { kind: "freeze", selector: "chosen" },
    ],
    requiresTarget: true,
    targetFilter: "anyMinion",
    flavor: "Cold enough to stop a heart mid-beat.",
  },

  // ---- Necromancer ---------------------------------------------------------
  {
    id: "skeletal_mage",
    name: "Skeletal Mage",
    cost: 3,
    type: "minion",
    className: "necromancer",
    attack: 2,
    health: 2,
    text: "Battlecry: Summon a 1/1 Skeleton.",
    onPlay: [{ kind: "summon", cardId: "skeleton_token", count: 1 }],
    flavor: "Raised to raise others.",
  },
  {
    id: "soul_reaver",
    name: "Soul Reaver",
    cost: 4,
    type: "minion",
    className: "necromancer",
    attack: 3,
    health: 4,
    keywords: ["lifesteal"],
    text: "Lifesteal",
    flavor: "Every wound it deals, it drinks.",
  },
  {
    id: "blood_golem",
    name: "Blood Golem",
    cost: 5,
    type: "minion",
    className: "necromancer",
    attack: 4,
    health: 6,
    keywords: ["taunt", "lifesteal"],
    text: "Taunt. Lifesteal.",
    flavor: "Clay, bone, and a great deal of blood.",
  },
  {
    id: "raise_dead",
    name: "Army of the Dead",
    cost: 3,
    type: "spell",
    className: "necromancer",
    text: "Summon two 2/3 Skeleton Warriors.",
    onPlay: [{ kind: "summon", cardId: "skeleton_warrior", count: 2 }],
    flavor: "The grave is never truly full.",
  },
  {
    id: "corpse_explosion",
    name: "Corpse Explosion",
    cost: 4,
    type: "spell",
    className: "necromancer",
    text: "Deal 2 damage to all enemy minions.",
    onPlay: [{ kind: "damage", selector: "allEnemyMinions", amount: 2 }],
    flavor: "Waste not.",
  },

  // ---- Demon Hunter --------------------------------------------------------
  {
    id: "shadow_imp",
    name: "Shadow Imp",
    cost: 2,
    type: "minion",
    className: "demonhunter",
    attack: 3,
    health: 2,
    text: "",
    flavor: "Bound, barely.",
  },
  {
    id: "vengeful_spirit",
    name: "Vengeful Spirit",
    cost: 3,
    type: "minion",
    className: "demonhunter",
    attack: 2,
    health: 2,
    keywords: ["lifesteal"],
    text: "Lifesteal",
    flavor: "It feeds on hatred — yours will do.",
  },
  {
    id: "fel_barrage",
    name: "Fel Barrage",
    cost: 3,
    type: "spell",
    className: "demonhunter",
    text: "Deal 3 damage to the enemy hero.",
    onPlay: [{ kind: "damage", selector: "enemyHero", amount: 3 }],
    flavor: "No mercy. No hesitation.",
  },
  {
    id: "metamorphosis",
    name: "Metamorphosis",
    cost: 2,
    type: "spell",
    className: "demonhunter",
    text: "Give a friendly minion +3/+1.",
    onPlay: [{ kind: "buff", selector: "chosen", attack: 3, health: 1 }],
    requiresTarget: true,
    targetFilter: "friendlyMinion",
    flavor: "Embrace the demon within.",
  },

  // ---- Neutral spell -------------------------------------------------------
  {
    id: "healing_potion",
    name: "Healing Potion",
    cost: 2,
    type: "spell",
    className: "neutral",
    text: "Restore 6 Health.",
    onPlay: [{ kind: "heal", selector: "chosen", amount: 6 }],
    requiresTarget: true,
    targetFilter: "any",
    flavor: "Bottoms up.",
  },

  // ---- Tokens & special (uncollectible) ------------------------------------
  {
    id: "skeleton_token",
    name: "Skeleton",
    cost: 1,
    type: "minion",
    className: "neutral",
    attack: 1,
    health: 1,
    uncollectible: true,
    text: "",
    flavor: "Risen for a single purpose.",
  },
  {
    id: "the_coin",
    name: "The Coin",
    cost: 0,
    type: "spell",
    className: "neutral",
    uncollectible: true,
    text: "Gain 1 Mana Crystal this turn only.",
    onPlay: [{ kind: "mana", amount: 1 }],
    flavor: "Heads you win.",
  },
];

const CARD_INDEX: Record<string, CardDef> = Object.fromEntries(CARD_DEFS.map((c) => [c.id, c]));

export function getCardDef(id: string): CardDef {
  const def = CARD_INDEX[id];
  if (!def) throw new Error(`Unknown card definition: ${id}`);
  return def;
}

/** All cards a player may put in a deck (excludes tokens, coin, etc.). */
export function collectibleCards(): CardDef[] {
  return CARD_DEFS.filter((c) => !c.uncollectible);
}

/** Cards available to a given class: that class plus neutrals. */
export function cardsForClass(className: HeroClass): CardDef[] {
  return collectibleCards().filter((c) => c.className === className || c.className === "neutral");
}

/**
 * A reasonable prebuilt 30-card deck for a class, drawn from its pool. Used as
 * the default deck and by the AI. Respects the 1-copy limit on legendaries.
 */
export function classDeck(className: HeroClass): string[] {
  const pool = cardsForClass(className);
  const byCost = [...pool].sort((a, b) => a.cost - b.cost);
  const deck: string[] = [];
  // Round-robin add copies until we reach 30, biasing toward a smooth curve.
  let i = 0;
  while (deck.length < 30 && byCost.length > 0) {
    const card = byCost[i % byCost.length];
    const copiesInDeck = deck.filter((id) => id === card.id).length;
    const limit = card.legendary ? 1 : 2;
    if (copiesInDeck < limit) deck.push(card.id);
    i++;
    // Safety: if we've cycled many times and can't fill, break.
    if (i > byCost.length * 4) break;
  }
  // Pad with the cheapest neutral if somehow short.
  while (deck.length < 30) deck.push("fallen_imp");
  return deck.slice(0, 30);
}

/** Legacy starter deck kept for tests/backwards-compat. */
export function starterDeck(): string[] {
  return classDeck("barbarian");
}
