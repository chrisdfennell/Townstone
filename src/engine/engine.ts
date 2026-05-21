import type {
  CardDef,
  CharacterRef,
  Effect,
  GameState,
  Keyword,
  Minion,
  PlayerId,
  PlayerState,
  TargetSelector,
} from "./types";
import { getCardDef } from "./cards";
import { nextInt, shuffle } from "./rng";

export const RULES = {
  startingHealth: 30,
  maxMana: 10,
  maxHandSize: 10,
  maxBoardSize: 7,
  startingHandFirst: 3,
  startingHandSecond: 4,
} as const;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function opponentOf(id: PlayerId): PlayerId {
  return id === "player" ? "ai" : "player";
}

function clone(state: GameState): GameState {
  return structuredClone(state);
}

function emptyPlayer(id: PlayerId, className: PlayerState["hero"]["className"]): PlayerState {
  return {
    id,
    hero: { health: RULES.startingHealth, maxHealth: RULES.startingHealth, armor: 0, className },
    mana: 0,
    maxMana: 0,
    hand: [],
    deck: [],
    board: [],
    fatigue: 0,
  };
}

export interface NewGameOptions {
  seed?: number;
  first?: PlayerId;
  playerDeck: string[];
  aiDeck: string[];
  playerClass?: PlayerState["hero"]["className"];
  aiClass?: PlayerState["hero"]["className"];
}

export function createGame(opts: NewGameOptions): GameState {
  const first = opts.first ?? "player";
  const state: GameState = {
    players: {
      player: emptyPlayer("player", opts.playerClass ?? "neutral"),
      ai: emptyPlayer("ai", opts.aiClass ?? "necromancer"),
    },
    current: first,
    turn: 0,
    phase: "playing",
    winner: null,
    log: [],
    nextInstanceId: 1,
    rngState: opts.seed ?? Math.floor(Math.random() * 2 ** 31),
  };

  loadDeck(state, "player", opts.playerDeck);
  loadDeck(state, "ai", opts.aiDeck);

  // Opening hands.
  const second = opponentOf(first);
  draw(state, first, RULES.startingHandFirst);
  draw(state, second, RULES.startingHandSecond);

  log(state, `The battle begins. ${first === "player" ? "You go" : "The enemy goes"} first.`);
  beginTurn(state, first);
  return state;
}

function loadDeck(state: GameState, playerId: PlayerId, ids: string[]): void {
  const instances = ids.map((defId) => ({ instanceId: mintId(state), defId }));
  const shuffled = shuffle(instances, state.rngState);
  state.rngState = shuffled.state;
  state.players[playerId].deck = shuffled.items;
}

function mintId(state: GameState): string {
  return `c${state.nextInstanceId++}`;
}

function log(state: GameState, message: string): void {
  state.log.push(message);
}

// ---------------------------------------------------------------------------
// Turn structure
// ---------------------------------------------------------------------------

function beginTurn(state: GameState, playerId: PlayerId): void {
  const p = state.players[playerId];
  state.turn += 1;
  p.maxMana = Math.min(RULES.maxMana, p.maxMana + 1);
  p.mana = p.maxMana;
  for (const m of p.board) {
    m.summonedThisTurn = false;
    m.hasAttacked = false;
  }
  draw(state, playerId, 1);
}

export function endTurn(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== "playing" || state.current !== playerId) return state;
  const next = clone(state);
  const opponent = opponentOf(playerId);
  next.current = opponent;
  beginTurn(next, opponent);
  return next;
}

// ---------------------------------------------------------------------------
// Drawing & fatigue
// ---------------------------------------------------------------------------

function draw(state: GameState, playerId: PlayerId, count: number): void {
  const p = state.players[playerId];
  for (let i = 0; i < count; i++) {
    const card = p.deck.shift();
    if (!card) {
      // Fatigue: out of cards, take escalating damage.
      p.fatigue += 1;
      damageHero(state, playerId, p.fatigue);
      log(state, `${who(playerId)} is exhausted and takes ${p.fatigue} fatigue damage.`);
      continue;
    }
    if (p.hand.length >= RULES.maxHandSize) {
      log(state, `${who(playerId)}'s hand is full — ${getCardDef(card.defId).name} is burned.`);
      continue;
    }
    p.hand.push(card);
  }
}

// ---------------------------------------------------------------------------
// Playing cards
// ---------------------------------------------------------------------------

export interface PlayOptions {
  /** Board index to insert a minion at; appended if omitted. */
  position?: number;
  /** Required when the card has a "chosen" effect. */
  target?: CharacterRef;
}

export function canPlayCard(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  if (state.phase !== "playing" || state.current !== playerId) return false;
  const p = state.players[playerId];
  const card = p.hand.find((c) => c.instanceId === instanceId);
  if (!card) return false;
  const def = getCardDef(card.defId);
  if (def.cost > p.mana) return false;
  if (def.type === "minion" && p.board.length >= RULES.maxBoardSize) return false;
  if (def.requiresTarget && validTargets(state, playerId, def).length === 0) {
    // No legal targets and the effect needs one — only block if it's a spell
    // whose entire purpose is the targeted effect.
    if (def.type === "spell") return false;
  }
  return true;
}

export function playCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  opts: PlayOptions = {},
): GameState {
  if (!canPlayCard(state, playerId, instanceId)) return state;
  const next = clone(state);
  const p = next.players[playerId];
  const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
  const card = p.hand[idx];
  const def = getCardDef(card.defId);

  p.mana -= def.cost;
  p.hand.splice(idx, 1);

  if (def.type === "minion") {
    const minion = createMinion(next, def);
    const pos = clampPosition(opts.position, p.board.length);
    p.board.splice(pos, 0, minion);
    log(next, `${who(playerId)} plays ${def.name}.`);
    if (def.onPlay) resolveEffects(next, def.onPlay, playerId, opts.target);
  } else {
    log(next, `${who(playerId)} casts ${def.name}.`);
    if (def.onPlay) resolveEffects(next, def.onPlay, playerId, opts.target);
  }

  cleanupDeaths(next);
  checkWin(next);
  return next;
}

function createMinion(state: GameState, def: CardDef): Minion {
  return {
    instanceId: mintId(state),
    defId: def.id,
    name: def.name,
    attack: def.attack ?? 0,
    health: def.health ?? 1,
    maxHealth: def.health ?? 1,
    keywords: [...(def.keywords ?? [])],
    divineShield: (def.keywords ?? []).includes("divineShield"),
    summonedThisTurn: true,
    hasAttacked: false,
    onDeath: def.onDeath ? def.onDeath.map((e) => ({ ...e })) : undefined,
  };
}

function clampPosition(pos: number | undefined, len: number): number {
  if (pos == null) return len;
  return Math.max(0, Math.min(pos, len));
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

function resolveEffects(
  state: GameState,
  effects: Effect[],
  controller: PlayerId,
  chosen?: CharacterRef,
): void {
  for (const effect of effects) {
    resolveEffect(state, effect, controller, chosen);
  }
}

function resolveEffect(
  state: GameState,
  effect: Effect,
  controller: PlayerId,
  chosen?: CharacterRef,
): void {
  switch (effect.kind) {
    case "draw":
      draw(state, controller, effect.amount);
      break;
    case "summon": {
      const def = getCardDef(effect.cardId);
      const board = state.players[controller].board;
      for (let i = 0; i < effect.count; i++) {
        if (board.length >= RULES.maxBoardSize) break;
        board.push(createMinion(state, def));
      }
      break;
    }
    case "damage": {
      for (const ref of resolveSelector(state, effect.selector, controller, chosen)) {
        applyDamage(state, ref, effect.amount);
      }
      break;
    }
    case "heal": {
      for (const ref of resolveSelector(state, effect.selector, controller, chosen)) {
        applyHeal(state, ref, effect.amount);
      }
      break;
    }
    case "buff": {
      for (const ref of resolveSelector(state, effect.selector, controller, chosen)) {
        if (ref.kind !== "minion") continue;
        const m = findMinion(state, ref.instanceId);
        if (!m) continue;
        m.attack += effect.attack;
        m.maxHealth += effect.health;
        m.health += effect.health;
      }
      break;
    }
  }
}

function resolveSelector(
  state: GameState,
  selector: TargetSelector,
  controller: PlayerId,
  chosen?: CharacterRef,
): CharacterRef[] {
  const enemy = opponentOf(controller);
  switch (selector) {
    case "chosen":
      return chosen ? [chosen] : [];
    case "friendlyHero":
      return [{ kind: "hero", player: controller }];
    case "enemyHero":
      return [{ kind: "hero", player: enemy }];
    case "allFriendlyMinions":
      return state.players[controller].board.map((m) => ({ kind: "minion", instanceId: m.instanceId }));
    case "allEnemyMinions":
      return state.players[enemy].board.map((m) => ({ kind: "minion", instanceId: m.instanceId }));
    case "allMinions":
      return [...state.players.player.board, ...state.players.ai.board].map((m) => ({
        kind: "minion",
        instanceId: m.instanceId,
      }));
    case "randomEnemyMinion": {
      const board = state.players[enemy].board;
      if (board.length === 0) return [];
      const r = nextInt(state.rngState, board.length);
      state.rngState = r.state;
      return [{ kind: "minion", instanceId: board[r.value].instanceId }];
    }
    case "self":
      return [];
  }
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

export function canAttack(state: GameState, playerId: PlayerId, attackerId: string): boolean {
  if (state.phase !== "playing" || state.current !== playerId) return false;
  const m = state.players[playerId].board.find((x) => x.instanceId === attackerId);
  if (!m) return false;
  if (m.attack <= 0) return false;
  if (m.hasAttacked) return false;
  if (m.summonedThisTurn && !m.keywords.includes("charge")) return false;
  return true;
}

/** Returns the legal defenders for an attacker (respects Taunt). */
export function validAttackTargets(state: GameState, playerId: PlayerId): CharacterRef[] {
  const enemy = opponentOf(playerId);
  const board = state.players[enemy].board;
  const taunts = board.filter((m) => m.keywords.includes("taunt"));
  const minionRefs = (taunts.length > 0 ? taunts : board).map(
    (m) => ({ kind: "minion", instanceId: m.instanceId }) as CharacterRef,
  );
  if (taunts.length > 0) return minionRefs;
  return [...minionRefs, { kind: "hero", player: enemy }];
}

export function attack(
  state: GameState,
  playerId: PlayerId,
  attackerId: string,
  target: CharacterRef,
): GameState {
  if (!canAttack(state, playerId, attackerId)) return state;
  const legal = validAttackTargets(state, playerId);
  const isLegal = legal.some((t) =>
    t.kind === "hero" && target.kind === "hero"
      ? t.player === target.player
      : t.kind === "minion" && target.kind === "minion" && t.instanceId === target.instanceId,
  );
  if (!isLegal) return state;

  const next = clone(state);
  const attacker = next.players[playerId].board.find((x) => x.instanceId === attackerId)!;

  if (target.kind === "hero") {
    log(next, `${attacker.name} strikes ${who(target.player)}'s hero for ${attacker.attack}.`);
    applyDamage(next, target, attacker.attack);
  } else {
    const defender = findMinion(next, target.instanceId);
    if (!defender) return state;
    log(next, `${attacker.name} (${attacker.attack}/${attacker.health}) attacks ${defender.name} (${defender.attack}/${defender.health}).`);
    const attackerPower = attacker.attack;
    const defenderPower = defender.attack;
    applyDamage(next, target, attackerPower);
    applyDamage(next, { kind: "minion", instanceId: attacker.instanceId }, defenderPower);
  }

  attacker.hasAttacked = true;
  cleanupDeaths(next);
  checkWin(next);
  return next;
}

// ---------------------------------------------------------------------------
// Damage / heal / deaths
// ---------------------------------------------------------------------------

function applyDamage(state: GameState, ref: CharacterRef, amount: number): void {
  if (amount <= 0) return;
  if (ref.kind === "hero") {
    damageHero(state, ref.player, amount);
    return;
  }
  const m = findMinion(state, ref.instanceId);
  if (!m) return;
  if (m.divineShield) {
    m.divineShield = false;
    log(state, `${m.name}'s Divine Shield absorbs the blow.`);
    return;
  }
  m.health -= amount;
}

function damageHero(state: GameState, playerId: PlayerId, amount: number): void {
  const hero = state.players[playerId].hero;
  const absorbed = Math.min(hero.armor, amount);
  hero.armor -= absorbed;
  hero.health -= amount - absorbed;
}

function applyHeal(state: GameState, ref: CharacterRef, amount: number): void {
  if (amount <= 0) return;
  if (ref.kind === "hero") {
    const hero = state.players[ref.player].hero;
    hero.health = Math.min(hero.maxHealth, hero.health + amount);
    return;
  }
  const m = findMinion(state, ref.instanceId);
  if (!m) return;
  m.health = Math.min(m.maxHealth, m.health + amount);
}

/** Removes dead minions and fires their deathrattles until the board settles. */
function cleanupDeaths(state: GameState): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const playerId of ["player", "ai"] as PlayerId[]) {
      const board = state.players[playerId].board;
      for (let i = board.length - 1; i >= 0; i--) {
        const m = board[i];
        if (m.health <= 0) {
          board.splice(i, 1);
          log(state, `${m.name} is destroyed.`);
          if (m.onDeath) {
            resolveEffects(state, m.onDeath, playerId);
            changed = true;
          }
        }
      }
    }
  }
}

function checkWin(state: GameState): void {
  const playerDead = state.players.player.hero.health <= 0;
  const aiDead = state.players.ai.hero.health <= 0;
  if (!playerDead && !aiDead) return;
  state.phase = "gameOver";
  if (playerDead && aiDead) {
    state.winner = null;
    log(state, "Both heroes fall. The battle ends in a draw.");
  } else {
    state.winner = playerDead ? "ai" : "player";
    log(state, `${who(state.winner)} ${state.winner === "player" ? "are" : "is"} victorious!`);
  }
}

// ---------------------------------------------------------------------------
// Lookups & helpers used by UI/AI
// ---------------------------------------------------------------------------

export function findMinion(state: GameState, instanceId: string): Minion | undefined {
  return (
    state.players.player.board.find((m) => m.instanceId === instanceId) ??
    state.players.ai.board.find((m) => m.instanceId === instanceId)
  );
}

export function ownerOfMinion(state: GameState, instanceId: string): PlayerId | undefined {
  if (state.players.player.board.some((m) => m.instanceId === instanceId)) return "player";
  if (state.players.ai.board.some((m) => m.instanceId === instanceId)) return "ai";
  return undefined;
}

/** Valid targets for a card's "chosen" effect, honoring its target filter. */
export function validTargets(state: GameState, playerId: PlayerId, def: CardDef): CharacterRef[] {
  if (!def.requiresTarget) return [];
  const enemy = opponentOf(playerId);
  const filter = def.targetFilter ?? "any";
  const refs: CharacterRef[] = [];
  const add = (m: Minion) => refs.push({ kind: "minion", instanceId: m.instanceId });

  switch (filter) {
    case "any":
      state.players[playerId].board.forEach(add);
      state.players[enemy].board.forEach(add);
      refs.push({ kind: "hero", player: playerId });
      refs.push({ kind: "hero", player: enemy });
      break;
    case "anyMinion":
      state.players[playerId].board.forEach(add);
      state.players[enemy].board.forEach(add);
      break;
    case "enemyCharacter":
      state.players[enemy].board.forEach(add);
      refs.push({ kind: "hero", player: enemy });
      break;
    case "enemyMinion":
      state.players[enemy].board.forEach(add);
      break;
    case "friendlyMinion":
      state.players[playerId].board.forEach(add);
      break;
  }
  return refs;
}

function who(playerId: PlayerId): string {
  return playerId === "player" ? "You" : "The enemy";
}

export function hasKeyword(m: Minion, kw: Keyword): boolean {
  return m.keywords.includes(kw);
}
