import type { HeroClass, HeroPower } from "./types";

/**
 * Class identities. Each class has a signature Hero Power (2 mana, once per
 * turn) built from the same data-driven Effect system the cards use.
 */
export const HERO_POWERS: Record<HeroClass, HeroPower> = {
  barbarian: {
    id: "hp_warcry",
    name: "War Cry",
    cost: 2,
    text: "Gain 2 Armor.",
    effects: [{ kind: "armor", selector: "friendlyHero", amount: 2 }],
  },
  sorceress: {
    id: "hp_fireblast",
    name: "Fire Blast",
    cost: 2,
    text: "Deal 1 damage.",
    effects: [{ kind: "damage", selector: "chosen", amount: 1 }],
    requiresTarget: true,
    targetFilter: "any",
  },
  necromancer: {
    id: "hp_raise",
    name: "Raise Dead",
    cost: 2,
    text: "Summon a 1/1 Skeleton.",
    effects: [{ kind: "summon", cardId: "skeleton_token", count: 1 }],
  },
  demonhunter: {
    id: "hp_chaosstrike",
    name: "Chaos Strike",
    cost: 2,
    text: "Give a friendly minion +2/+1.",
    effects: [{ kind: "buff", selector: "chosen", attack: 2, health: 1 }],
    requiresTarget: true,
    targetFilter: "friendlyMinion",
  },
  // Neutral has no class identity; falls back to the Sorceress power if ever
  // used (e.g. a neutral "practice" hero).
  neutral: {
    id: "hp_fireblast",
    name: "Fire Blast",
    cost: 2,
    text: "Deal 1 damage.",
    effects: [{ kind: "damage", selector: "chosen", amount: 1 }],
    requiresTarget: true,
    targetFilter: "any",
  },
};

export const CLASS_LABEL: Record<HeroClass, string> = {
  barbarian: "Barbarian",
  sorceress: "Sorceress",
  necromancer: "Necromancer",
  demonhunter: "Demon Hunter",
  neutral: "Wanderer",
};

export function heroPowerFor(className: HeroClass): HeroPower {
  return HERO_POWERS[className];
}
