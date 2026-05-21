import type { Keyword } from "../engine";

/** Plain-language explanations of keywords, shown in tooltips and the Help panel. */
export const KEYWORD_GLOSSARY: Record<Keyword, string> = {
  taunt: "Enemies must attack minions with Taunt before anything else.",
  charge: "Can attack the same turn it is played.",
  divineShield: "Ignores the first instance of damage it would take.",
  lifesteal: "Damage this deals also heals your hero.",
  poisonous: "Any minion damaged by this is destroyed.",
  windfury: "Can attack twice each turn.",
};

export const KEYWORD_LABEL: Record<Keyword, string> = {
  taunt: "Taunt",
  charge: "Charge",
  divineShield: "Divine Shield",
  lifesteal: "Lifesteal",
  poisonous: "Poisonous",
  windfury: "Windfury",
};

/** Short how-to-play bullets for the Help panel. */
export const HOW_TO_PLAY: string[] = [
  "Each turn you gain a Mana Crystal (up to 10). Spend mana to play cards from your hand.",
  "Click a card to play it. Targeted spells then ask you to click a target.",
  "Click your minion (glowing gold), then click an enemy to attack. Minions can't attack the turn they're summoned unless they have Charge.",
  "Your Hero Power (the round button by your hero) costs 2 mana and can be used once per turn.",
  "Discover lets you pick 1 of 3 offered cards to add to your hand.",
  "Secrets are spells that hide face-down (gold runes by your hero) and trigger automatically on your opponent's turn.",
  "Reduce the enemy hero from 30 Health to 0 to win. Armor absorbs damage before Health.",
];
