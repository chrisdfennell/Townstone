import type { CardDef } from "./types";

/**
 * Townstone card pool — milestone 1.
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
    id: "the_butcher",
    name: "The Butcher",
    cost: 7,
    type: "minion",
    className: "neutral",
    attack: 7,
    health: 7,
    keywords: ["taunt"],
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
    text: "Charge.",
    flavor: "Not even death can save you from him.",
  },

  // ---- Class minions -------------------------------------------------------
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
    id: "skeletal_mage",
    name: "Skeletal Mage",
    cost: 3,
    type: "minion",
    className: "necromancer",
    attack: 2,
    health: 2,
    text: "Battlecry: Summon a 1/1 Fallen Imp.",
    onPlay: [{ kind: "summon", cardId: "fallen_imp", count: 1 }],
    flavor: "Raised to raise others.",
  },

  // ---- Spells --------------------------------------------------------------
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
    id: "frost_nova",
    name: "Frozen Orb",
    cost: 3,
    type: "spell",
    className: "sorceress",
    text: "Deal 1 damage to all enemy minions.",
    onPlay: [{ kind: "damage", selector: "allEnemyMinions", amount: 1 }],
    flavor: "It lingers, grinding everything in its path.",
  },
  {
    id: "raise_dead",
    name: "Raise Dead",
    cost: 3,
    type: "spell",
    className: "necromancer",
    text: "Summon two 2/3 Skeleton Warriors.",
    onPlay: [{ kind: "summon", cardId: "skeleton_warrior", count: 2 }],
    flavor: "The grave is never truly full.",
  },
];

const CARD_INDEX: Record<string, CardDef> = Object.fromEntries(
  CARD_DEFS.map((c) => [c.id, c]),
);

export function getCardDef(id: string): CardDef {
  const def = CARD_INDEX[id];
  if (!def) throw new Error(`Unknown card definition: ${id}`);
  return def;
}

/**
 * A simple starter deck (30 cards) drawn from the neutral + class pool.
 * Both players use this for milestone 1; deckbuilding comes later.
 */
export function starterDeck(): string[] {
  const list: Array<[string, number]> = [
    ["fallen_imp", 2],
    ["wirt_companion", 2],
    ["firebolt", 2],
    ["treasure_goblin", 2],
    ["skeleton_warrior", 2],
    ["healing_potion", 1],
    ["battle_cry", 2],
    ["hell_hound", 2],
    ["carver_brute", 2],
    ["skeletal_mage", 2],
    ["frost_nova", 2],
    ["raise_dead", 1],
    ["blood_clan_warrior", 2],
    ["ancient_guardian", 2],
    ["fireball", 2],
    ["andariel", 1],
    ["the_butcher", 1],
    ["diablo", 1],
  ];
  const deck: string[] = [];
  for (const [id, count] of list) {
    for (let i = 0; i < count; i++) deck.push(id);
  }
  return deck;
}
