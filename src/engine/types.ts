/**
 * Townstone core types.
 *
 * The engine is intentionally framework-agnostic and fully serializable:
 * GameState is plain data (no class instances, no functions), so it can be
 * sent over the wire for multiplayer and reasoned about by the AI.
 */

export type PlayerId = "player" | "ai";

export type CardType = "minion" | "spell";

/** Diablo-flavored hero classes. */
export type HeroClass =
  | "barbarian"
  | "sorceress"
  | "necromancer"
  | "demonhunter"
  | "neutral";

/** The five playable classes (everything except the neutral pool). */
export const PLAYABLE_CLASSES: Exclude<HeroClass, "neutral">[] = [
  "barbarian",
  "sorceress",
  "necromancer",
  "demonhunter",
];

/** Intrinsic keywords printed on a card. */
export type Keyword =
  | "taunt"
  | "charge"
  | "divineShield"
  | "lifesteal"
  | "poisonous"
  | "windfury";

/**
 * Where an effect's targets come from. "chosen" requires the controller to
 * pick a target when the card is played; everything else is resolved
 * automatically by the engine.
 */
export type TargetSelector =
  | "chosen"
  | "self"
  | "friendlyHero"
  | "enemyHero"
  | "allMinions"
  | "allFriendlyMinions"
  | "allEnemyMinions"
  | "randomEnemyMinion";

/** Constrains which characters a "chosen" target may be. */
export type TargetFilter =
  | "any"
  | "anyMinion"
  | "enemyCharacter"
  | "enemyMinion"
  | "friendlyMinion";

export type Effect =
  | { kind: "damage"; selector: TargetSelector; amount: number }
  | { kind: "heal"; selector: TargetSelector; amount: number }
  | { kind: "buff"; selector: TargetSelector; attack: number; health: number }
  | { kind: "armor"; selector: TargetSelector; amount: number }
  | { kind: "mana"; amount: number }
  | { kind: "freeze"; selector: TargetSelector }
  | { kind: "draw"; amount: number }
  | { kind: "summon"; cardId: string; count: number };

/** A class-specific Hero Power, usable once per turn. */
export interface HeroPower {
  id: string;
  name: string;
  cost: number;
  text: string;
  effects: Effect[];
  requiresTarget?: boolean;
  targetFilter?: TargetFilter;
}

/** Static template defining a card. Many instances can share one definition. */
export interface CardDef {
  id: string;
  name: string;
  cost: number;
  type: CardType;
  text: string;
  className: HeroClass;
  /** Diablo flavor blurb shown on hover/inspect. */
  flavor?: string;
  /** Rare/legendary cards are limited to a single copy per deck. */
  legendary?: boolean;
  /** Cards (like The Coin) that should never appear in the deckbuilder. */
  uncollectible?: boolean;

  // Minion stats
  attack?: number;
  health?: number;
  keywords?: Keyword[];
  /** "Spell Damage +N": boosts the controller's spell damage while in play. */
  spellDamage?: number;

  /** Resolved when the minion is played (battlecry) or the spell is cast. */
  onPlay?: Effect[];
  /** Resolved when the minion dies. */
  onDeath?: Effect[];

  /** True when onPlay contains a "chosen" effect and a target must be picked. */
  requiresTarget?: boolean;
  targetFilter?: TargetFilter;
}

/** A specific card in a hand or deck. */
export interface CardInstance {
  instanceId: string;
  defId: string;
}

/** A minion currently in play on the board. */
export interface Minion {
  instanceId: string;
  defId: string;
  name: string;
  attack: number;
  health: number;
  maxHealth: number;
  keywords: Keyword[];
  spellDamage: number;
  divineShield: boolean;
  frozen: boolean;
  /** Played this turn — cannot attack unless it has Charge. */
  summonedThisTurn: boolean;
  /** Attacks used this turn (Windfury allows 2). */
  attacksThisTurn: number;
  onDeath?: Effect[];
}

export interface Hero {
  health: number;
  maxHealth: number;
  armor: number;
  className: HeroClass;
  power: HeroPower;
  powerUsedThisTurn: boolean;
}

export interface PlayerState {
  id: PlayerId;
  hero: Hero;
  mana: number;
  maxMana: number;
  hand: CardInstance[];
  deck: CardInstance[];
  board: Minion[];
  fatigue: number;
  /** Whether this player has finished their opening-hand mulligan. */
  mulliganed: boolean;
}

export type GamePhase = "mulligan" | "playing" | "gameOver";

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  current: PlayerId;
  /** Whoever takes the first turn after the mulligan. */
  first: PlayerId;
  turn: number;
  phase: GamePhase;
  winner: PlayerId | null;
  log: string[];
  /** Monotonic counter used to mint unique instance ids. */
  nextInstanceId: number;
  /** Seedable RNG state for deterministic, replayable games. */
  rngState: number;
}

/** Identifies a character (a hero or a minion) as a target. */
export type CharacterRef =
  | { kind: "hero"; player: PlayerId }
  | { kind: "minion"; instanceId: string };
