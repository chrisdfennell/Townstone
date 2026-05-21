import { classDeck } from "../engine";
import type { HeroClass, HeroPower } from "../engine";

/**
 * The Diablo boss gauntlet. Each boss has a themed deck (drawn from a class's
 * pool) and a unique Hero Power. Beating a boss unlocks its reward legendary.
 * Bosses must be beaten in order.
 */
export interface Boss {
  id: string;
  name: string;
  title: string;
  flavor: string;
  glyph: string;
  /** Class whose card pool the boss's deck is built from. */
  deckClass: HeroClass;
  power: HeroPower;
  /** Card id unlocked by defeating this boss. */
  rewardCardId: string;
}

export const BOSSES: Boss[] = [
  {
    id: "butcher",
    name: "The Butcher",
    title: "Fresh Meat",
    flavor: "\"Ahhh… fresh meat!\" Its cleaver has tasted a thousand heroes.",
    glyph: "🪓",
    deckClass: "barbarian",
    power: {
      id: "boss_cleave",
      name: "Cleave",
      cost: 2,
      text: "Deal 1 damage to all enemy minions.",
      effects: [{ kind: "damage", selector: "allEnemyMinions", amount: 1 }],
    },
    rewardCardId: "gluttony",
  },
  {
    id: "andariel",
    name: "Andariel",
    title: "Maiden of Anguish",
    flavor: "The first of the Lesser Evils you will face. Her poison lingers.",
    glyph: "🕷",
    deckClass: "necromancer",
    power: {
      id: "boss_infection",
      name: "Infection",
      cost: 2,
      text: "Summon a 1/1 Poisonous Maggot.",
      effects: [{ kind: "summon", cardId: "maggot", count: 1 }],
    },
    rewardCardId: "vile_mother",
  },
  {
    id: "duriel",
    name: "Duriel",
    title: "Lord of Pain",
    flavor: "He waits in the dark beneath Tal Rasha's tomb, and he does not tire.",
    glyph: "🪲",
    deckClass: "neutral",
    power: {
      id: "boss_carapace",
      name: "Carapace",
      cost: 2,
      text: "Gain 3 Armor.",
      effects: [{ kind: "armor", selector: "friendlyHero", amount: 3 }],
    },
    rewardCardId: "bone_colossus",
  },
  {
    id: "mephisto",
    name: "Mephisto",
    title: "Lord of Hatred",
    flavor: "Eldest of the Prime Evils. His hatred burns across the planes.",
    glyph: "🔥",
    deckClass: "sorceress",
    power: {
      id: "boss_hatred",
      name: "Hatred",
      cost: 2,
      text: "Deal 2 damage to the enemy hero.",
      effects: [{ kind: "damage", selector: "enemyHero", amount: 2 }],
    },
    rewardCardId: "mephisto",
  },
  {
    id: "diablo",
    name: "Diablo",
    title: "Lord of Terror",
    flavor: "The Prime Evil himself. Not even death can save you from him.",
    glyph: "👹",
    deckClass: "demonhunter",
    power: {
      id: "boss_terror",
      name: "Terror",
      cost: 2,
      text: "Deal 1 damage to all enemies.",
      effects: [
        { kind: "damage", selector: "allEnemyMinions", amount: 1 },
        { kind: "damage", selector: "enemyHero", amount: 1 },
      ],
    },
    rewardCardId: "prime_diablo",
  },
];

/** Map a reward card id to the boss name that drops it (for deckbuilder hints). */
export const REWARD_SOURCE: Record<string, string> = Object.fromEntries(
  BOSSES.map((b) => [b.rewardCardId, b.name]),
);

export function bossDeck(boss: Boss): string[] {
  return classDeck(boss.deckClass);
}

/** Index of the next boss to fight (first not yet beaten), or BOSSES.length if done. */
export function nextBossIndex(beaten: Set<string>): number {
  const i = BOSSES.findIndex((b) => !beaten.has(b.id));
  return i === -1 ? BOSSES.length : i;
}
