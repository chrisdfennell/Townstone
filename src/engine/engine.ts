import type {
  CardDef,
  CharacterRef,
  Effect,
  GameState,
  HeroPower,
  Keyword,
  Minion,
  PlayerId,
  PlayerState,
  TargetFilter,
  TargetSelector,
} from "./types";
import { collectibleCards, getCardDef } from "./cards";
import { heroPowerFor } from "./heroes";
import { nextInt, shuffle } from "./rng";
import type { DiscoverPool, SecretKind, SecretTrigger } from "./types";

export const RULES = {
  startingHealth: 30,
  maxMana: 10,
  maxHandSize: 10,
  maxBoardSize: 7,
  maxSecrets: 5,
  startingHandFirst: 3,
  startingHandSecond: 4,
} as const;

export const COIN_CARD_ID = "the_coin";

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
    hero: {
      health: RULES.startingHealth,
      maxHealth: RULES.startingHealth,
      armor: 0,
      className,
      power: heroPowerFor(className),
      powerUsedThisTurn: false,
    },
    mana: 0,
    maxMana: 0,
    hand: [],
    deck: [],
    board: [],
    secrets: [],
    fatigue: 0,
    mulliganed: false,
  };
}

export interface NewGameOptions {
  seed?: number;
  first?: PlayerId;
  playerDeck: string[];
  aiDeck: string[];
  playerClass?: PlayerState["hero"]["className"];
  aiClass?: PlayerState["hero"]["className"];
  /** Optional Hero Power overrides (used by campaign bosses). */
  playerPower?: HeroPower;
  aiPower?: HeroPower;
}

/** Creates a game in the mulligan phase. Call `beginPlay` once both sides have
 *  submitted their mulligan via `mulligan`. */
export function createGame(opts: NewGameOptions): GameState {
  const first = opts.first ?? "player";
  const state: GameState = {
    players: {
      player: emptyPlayer("player", opts.playerClass ?? "barbarian"),
      ai: emptyPlayer("ai", opts.aiClass ?? "necromancer"),
    },
    current: first,
    first,
    turn: 0,
    phase: "mulligan",
    winner: null,
    log: [],
    pendingChoice: null,
    nextInstanceId: 1,
    rngState: opts.seed ?? Math.floor(Math.random() * 2 ** 31),
  };

  if (opts.playerPower) state.players.player.hero.power = opts.playerPower;
  if (opts.aiPower) state.players.ai.hero.power = opts.aiPower;

  loadDeck(state, "player", opts.playerDeck);
  loadDeck(state, "ai", opts.aiDeck);

  const second = opponentOf(first);
  draw(state, first, RULES.startingHandFirst);
  draw(state, second, RULES.startingHandSecond);
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
// Mulligan
// ---------------------------------------------------------------------------

/** Replaces the chosen opening-hand cards: set them aside, draw that many, then
 *  shuffle the replaced cards back into the deck. */
export function mulligan(state: GameState, playerId: PlayerId, replaceIds: string[]): GameState {
  if (state.phase !== "mulligan") return state;
  const next = clone(state);
  const p = next.players[playerId];
  if (p.mulliganed) return state;

  const replaced = [];
  for (const id of replaceIds) {
    const idx = p.hand.findIndex((c) => c.instanceId === id);
    if (idx >= 0) replaced.push(p.hand.splice(idx, 1)[0]);
  }
  for (let i = 0; i < replaced.length; i++) {
    const card = p.deck.shift();
    if (card) p.hand.push(card);
  }
  p.deck.push(...replaced);
  const s = shuffle(p.deck, next.rngState);
  p.deck = s.items;
  next.rngState = s.state;
  p.mulliganed = true;
  return next;
}

/** Transitions out of the mulligan: gives The Coin to the second player and
 *  starts the first turn. Both players must have mulliganed first. */
export function beginPlay(state: GameState): GameState {
  if (state.phase !== "mulligan") return state;
  if (!state.players.player.mulliganed || !state.players.ai.mulliganed) return state;
  const next = clone(state);
  const second = opponentOf(next.first);
  next.players[second].hand.push({ instanceId: mintId(next), defId: COIN_CARD_ID });
  log(next, `The battle begins. ${next.first === "player" ? "You go" : "The enemy goes"} first.`);
  next.phase = "playing";
  next.current = next.first;
  beginTurn(next, next.first);
  return next;
}

// ---------------------------------------------------------------------------
// Turn structure
// ---------------------------------------------------------------------------

function beginTurn(state: GameState, playerId: PlayerId): void {
  const p = state.players[playerId];
  state.turn += 1;
  p.maxMana = Math.min(RULES.maxMana, p.maxMana + 1);
  p.mana = p.maxMana;
  p.hero.powerUsedThisTurn = false;
  for (const m of p.board) {
    m.summonedThisTurn = false;
    m.attacksThisTurn = 0;
  }
  draw(state, playerId, 1);
}

export function endTurn(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== "playing" || state.current !== playerId || state.pendingChoice) return state;
  const next = clone(state);
  // Thaw the ending player's frozen minions — they were locked for this turn.
  for (const m of next.players[playerId].board) m.frozen = false;
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
// Spell Damage
// ---------------------------------------------------------------------------

function spellPower(state: GameState, controller: PlayerId): number {
  return state.players[controller].board.reduce((sum, m) => sum + m.spellDamage, 0);
}

// ---------------------------------------------------------------------------
// Playing cards
// ---------------------------------------------------------------------------

export interface PlayOptions {
  position?: number;
  target?: CharacterRef;
}

export function canPlayCard(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  if (state.phase !== "playing" || state.current !== playerId || state.pendingChoice) return false;
  const p = state.players[playerId];
  const card = p.hand.find((c) => c.instanceId === instanceId);
  if (!card) return false;
  const def = getCardDef(card.defId);
  if (def.cost > p.mana) return false;
  if (def.type === "minion" && p.board.length >= RULES.maxBoardSize) return false;
  if (def.secret) {
    if (p.secrets.length >= RULES.maxSecrets) return false;
    if (p.secrets.some((s) => s.defId === def.id)) return false; // no duplicate Secrets
  }
  if (def.type === "spell" && def.requiresTarget && validTargets(state, playerId, def.targetFilter).length === 0) {
    return false;
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
  const enemy = opponentOf(playerId);

  if (def.secret) {
    p.secrets.push(card);
    log(next, `${who(playerId)} casts a Secret.`);
    return next;
  }

  if (def.type === "minion") {
    const minion = createMinion(next, def);
    const pos = clampPosition(opts.position, p.board.length);
    p.board.splice(pos, 0, minion);
    log(next, `${who(playerId)} plays ${def.name}.`);
    if (def.onPlay) resolveEffects(next, def.onPlay, playerId, { target: opts.target, isSpell: false });
    // Opponent's Secrets may react to a minion entering play.
    fireSecrets(next, enemy, "onMinionPlayed", { minionId: minion.instanceId });
  } else {
    log(next, `${who(playerId)} casts ${def.name}.`);
    // A Secret may counter the spell before it resolves.
    const negated = fireSecrets(next, enemy, "onSpellCast", {});
    if (!negated && def.onPlay) resolveEffects(next, def.onPlay, playerId, { target: opts.target, isSpell: true });
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
    spellDamage: def.spellDamage ?? 0,
    divineShield: (def.keywords ?? []).includes("divineShield"),
    frozen: false,
    summonedThisTurn: true,
    attacksThisTurn: 0,
    onDeath: def.onDeath ? def.onDeath.map((e) => ({ ...e })) : undefined,
  };
}

function clampPosition(pos: number | undefined, len: number): number {
  if (pos == null) return len;
  return Math.max(0, Math.min(pos, len));
}

// ---------------------------------------------------------------------------
// Hero Powers
// ---------------------------------------------------------------------------

export function canUseHeroPower(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== "playing" || state.current !== playerId || state.pendingChoice) return false;
  const p = state.players[playerId];
  if (p.hero.powerUsedThisTurn) return false;
  if (p.hero.power.cost > p.mana) return false;
  const power = p.hero.power;
  if (power.requiresTarget && validTargets(state, playerId, power.targetFilter).length === 0) return false;
  return true;
}

export function useHeroPower(
  state: GameState,
  playerId: PlayerId,
  opts: { target?: CharacterRef } = {},
): GameState {
  if (!canUseHeroPower(state, playerId)) return state;
  const next = clone(state);
  const p = next.players[playerId];
  const power: HeroPower = p.hero.power;
  p.mana -= power.cost;
  p.hero.powerUsedThisTurn = true;
  log(next, `${who(playerId)} uses ${power.name}.`);
  resolveEffects(next, power.effects, playerId, { target: opts.target, isSpell: false });
  cleanupDeaths(next);
  checkWin(next);
  return next;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

interface EffectContext {
  target?: CharacterRef;
  isSpell: boolean;
}

function resolveEffects(state: GameState, effects: Effect[], controller: PlayerId, ctx: EffectContext): void {
  for (const effect of effects) resolveEffect(state, effect, controller, ctx);
}

function resolveEffect(state: GameState, effect: Effect, controller: PlayerId, ctx: EffectContext): void {
  switch (effect.kind) {
    case "draw":
      draw(state, controller, effect.amount);
      break;
    case "discover": {
      const options = discoverOptions(state, controller, effect.pool);
      if (options.length > 0) state.pendingChoice = { player: controller, options };
      break;
    }
    case "mana":
      state.players[controller].mana += effect.amount;
      break;
    case "manaCrystal":
      state.players[controller].maxMana = Math.min(RULES.maxMana, state.players[controller].maxMana + effect.amount);
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
      const bonus = ctx.isSpell ? spellPower(state, controller) : 0;
      for (const ref of resolveSelector(state, effect.selector, controller, ctx.target)) {
        applyDamage(state, ref, effect.amount + bonus);
      }
      break;
    }
    case "heal": {
      for (const ref of resolveSelector(state, effect.selector, controller, ctx.target)) {
        applyHeal(state, ref, effect.amount);
      }
      break;
    }
    case "armor": {
      for (const ref of resolveSelector(state, effect.selector, controller, ctx.target)) {
        if (ref.kind === "hero") state.players[ref.player].hero.armor += effect.amount;
      }
      break;
    }
    case "freeze": {
      for (const ref of resolveSelector(state, effect.selector, controller, ctx.target)) {
        if (ref.kind !== "minion") continue;
        const m = findMinion(state, ref.instanceId);
        if (m) m.frozen = true;
      }
      break;
    }
    case "addKeyword": {
      for (const ref of resolveSelector(state, effect.selector, controller, ctx.target)) {
        if (ref.kind !== "minion") continue;
        const m = findMinion(state, ref.instanceId);
        if (!m) continue;
        if (!m.keywords.includes(effect.keyword)) m.keywords.push(effect.keyword);
        if (effect.keyword === "divineShield") m.divineShield = true;
      }
      break;
    }
    case "destroy": {
      for (const ref of resolveSelector(state, effect.selector, controller, ctx.target)) {
        if (ref.kind !== "minion") continue;
        const m = findMinion(state, ref.instanceId);
        if (m) m.health = 0; // bypasses Divine Shield, like Hearthstone "destroy"
      }
      break;
    }
    case "buff": {
      for (const ref of resolveSelector(state, effect.selector, controller, ctx.target)) {
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
// Discover
// ---------------------------------------------------------------------------

function discoverOptions(state: GameState, controller: PlayerId, pool: DiscoverPool): string[] {
  const cls = state.players[controller].hero.className;
  let cards = collectibleCards().filter((c) => c.className === cls || c.className === "neutral");
  if (pool === "minion") cards = cards.filter((c) => c.type === "minion");
  if (pool === "spell") cards = cards.filter((c) => c.type === "spell");

  const chosen: string[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (chosen.length < 3 && used.size < cards.length && guard < 200) {
    const r = nextInt(state.rngState, cards.length);
    state.rngState = r.state;
    if (!used.has(r.value)) {
      used.add(r.value);
      chosen.push(cards[r.value].id);
    }
    guard++;
  }
  return chosen;
}

/** Resolves an open Discover by adding the chosen card to the player's hand. */
export function chooseDiscover(state: GameState, playerId: PlayerId, index: number): GameState {
  if (!state.pendingChoice || state.pendingChoice.player !== playerId) return state;
  const next = clone(state);
  const options = next.pendingChoice!.options;
  const id = options[index] ?? options[0];
  next.pendingChoice = null;
  if (id) {
    const p = next.players[playerId];
    if (p.hand.length < RULES.maxHandSize) {
      p.hand.push({ instanceId: mintId(next), defId: id });
      log(next, `${who(playerId)} discovered ${getCardDef(id).name}.`);
    } else {
      log(next, `${who(playerId)}'s hand is full — the discovered card is lost.`);
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

interface SecretContext {
  /** The minion that just entered play (onMinionPlayed). */
  minionId?: string;
  /** The attacking minion (onHeroAttacked). */
  attackerId?: string;
}

/** Fires the owner's Secrets matching `trigger`. Returns true if a spell was negated. */
function fireSecrets(state: GameState, owner: PlayerId, trigger: SecretTrigger, ctx: SecretContext): boolean {
  const secrets = state.players[owner].secrets;
  let negated = false;
  for (let i = 0; i < secrets.length; ) {
    const def = getCardDef(secrets[i].defId);
    if (def.secret && def.secret.trigger === trigger) {
      secrets.splice(i, 1);
      log(state, `${who(owner)}'s Secret — ${def.name} — triggers!`);
      if (resolveSecret(state, owner, def.secret.kind, ctx)) negated = true;
    } else {
      i++;
    }
  }
  return negated;
}

function resolveSecret(state: GameState, owner: PlayerId, kind: SecretKind, ctx: SecretContext): boolean {
  switch (kind) {
    case "counterspell":
      return true; // signal: negate the cast
    case "iceBarrier":
      state.players[owner].hero.armor += 8;
      return false;
    case "vaporize": {
      if (ctx.attackerId) {
        const m = findMinion(state, ctx.attackerId);
        if (m) m.health = 0;
      }
      return false;
    }
    case "mirrorEntity": {
      if (ctx.minionId) {
        const m = findMinion(state, ctx.minionId);
        const board = state.players[owner].board;
        if (m && board.length < RULES.maxBoardSize) board.push(createMinion(state, getCardDef(m.defId)));
      }
      return false;
    }
    case "repentance": {
      if (ctx.minionId) {
        const m = findMinion(state, ctx.minionId);
        if (m) m.health = Math.min(m.health, 1);
      }
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

function maxAttacks(m: Minion): number {
  return m.keywords.includes("windfury") ? 2 : 1;
}

export function canAttack(state: GameState, playerId: PlayerId, attackerId: string): boolean {
  if (state.phase !== "playing" || state.current !== playerId || state.pendingChoice) return false;
  const m = state.players[playerId].board.find((x) => x.instanceId === attackerId);
  if (!m) return false;
  if (m.attack <= 0) return false;
  if (m.frozen) return false;
  if (m.attacksThisTurn >= maxAttacks(m)) return false;
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
  const isLegal = legal.some((t) => sameRef(t, target));
  if (!isLegal) return state;

  const next = clone(state);
  const attacker = next.players[playerId].board.find((x) => x.instanceId === attackerId)!;
  // The attack is declared now, so it counts as used even if a Secret stops it.
  attacker.attacksThisTurn += 1;

  if (target.kind === "hero") {
    // Defender's Secrets react before damage (e.g. Ice Barrier, Vaporize).
    fireSecrets(next, target.player, "onHeroAttacked", { attackerId: attacker.instanceId });
    cleanupDeaths(next);
    const stillAlive = next.players[playerId].board.find((x) => x.instanceId === attackerId);
    if (!stillAlive || stillAlive.health <= 0) {
      checkWin(next);
      return next; // attacker was destroyed/removed by a Secret
    }
    log(next, `${attacker.name} strikes ${who(target.player)}'s hero for ${attacker.attack}.`);
    const dealt = applyDamage(next, target, attacker.attack);
    applyLifesteal(next, attacker, playerId, dealt);
  } else {
    const defender = findMinion(next, target.instanceId);
    if (!defender) return state;
    log(next, `${attacker.name} (${attacker.attack}/${attacker.health}) attacks ${defender.name} (${defender.attack}/${defender.health}).`);
    const attackerPower = attacker.attack;
    const defenderPower = defender.attack;
    const dealtToDefender = applyDamage(next, target, attackerPower);
    const dealtToAttacker = applyDamage(next, { kind: "minion", instanceId: attacker.instanceId }, defenderPower);
    applyLifesteal(next, attacker, playerId, dealtToDefender);
    applyPoison(next, attacker, target, dealtToDefender);
    const defenderOwner = opponentOf(playerId);
    applyLifesteal(next, defender, defenderOwner, dealtToAttacker);
    applyPoison(next, defender, { kind: "minion", instanceId: attacker.instanceId }, dealtToAttacker);
  }

  cleanupDeaths(next);
  checkWin(next);
  return next;
}

function applyLifesteal(state: GameState, source: Minion, owner: PlayerId, dealt: number): void {
  if (dealt > 0 && source.keywords.includes("lifesteal")) {
    applyHeal(state, { kind: "hero", player: owner }, dealt);
  }
}

function applyPoison(state: GameState, source: Minion, target: CharacterRef, dealt: number): void {
  if (dealt > 0 && source.keywords.includes("poisonous") && target.kind === "minion") {
    const m = findMinion(state, target.instanceId);
    if (m) m.health = 0;
  }
}

// ---------------------------------------------------------------------------
// Damage / heal / deaths
// ---------------------------------------------------------------------------

/** Applies damage and returns the amount actually dealt (0 if a shield ate it). */
function applyDamage(state: GameState, ref: CharacterRef, amount: number): number {
  if (amount <= 0) return 0;
  if (ref.kind === "hero") {
    damageHero(state, ref.player, amount);
    return amount;
  }
  const m = findMinion(state, ref.instanceId);
  if (!m) return 0;
  if (m.divineShield) {
    m.divineShield = false;
    log(state, `${m.name}'s Divine Shield absorbs the blow.`);
    return 0;
  }
  m.health -= amount;
  return amount;
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
            resolveEffects(state, m.onDeath, playerId, { isSpell: false });
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

export function sameRef(a: CharacterRef, b: CharacterRef): boolean {
  if (a.kind === "hero" && b.kind === "hero") return a.player === b.player;
  if (a.kind === "minion" && b.kind === "minion") return a.instanceId === b.instanceId;
  return false;
}

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

/** Valid targets for a "chosen" effect, honoring its target filter. */
export function validTargets(state: GameState, playerId: PlayerId, filter: TargetFilter = "any"): CharacterRef[] {
  const enemy = opponentOf(playerId);
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
