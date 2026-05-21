import type { CardDef, CharacterRef, Effect, GameState, HeroPower, Minion, PlayerId } from "./types";
import { getCardDef } from "./cards";
import {
  attack,
  canAttack,
  canPlayCard,
  canUseHeroPower,
  findMinion,
  playCard,
  useHeroPower,
  validAttackTargets,
  validTargets,
} from "./engine";

/**
 * A simple greedy "tempo" AI.
 *
 * Strategy: spend as much mana as possible each turn on the highest-impact
 * plays (including its Hero Power), then attack — taking favorable trades when
 * available and otherwise pushing damage at the enemy hero. Deliberately
 * beatable but not silly.
 *
 * Returns intermediate states ("frames") so the UI can replay the AI's turn
 * one action at a time. The caller ends the turn after the frames are shown.
 */
export function runAiTurn(start: GameState): GameState[] {
  const frames: GameState[] = [];
  let state = start;

  // --- Play phase: best affordable play, including the Hero Power. ---
  for (let guard = 0; guard < 40; guard++) {
    const next = makeBestPlay(state);
    if (!next || next === state) break;
    state = next;
    frames.push(state);
    if (state.phase === "gameOver") return frames;
  }

  // --- Attack phase: resolve one attack at a time. ---
  for (let guard = 0; guard < 40; guard++) {
    const move = bestAttack(state);
    if (!move) break;
    const next = attack(state, "ai", move.attackerId, move.target);
    if (next === state) break;
    state = next;
    frames.push(state);
    if (state.phase === "gameOver") return frames;
  }

  return frames;
}

/** Picks the best card-or-hero-power play and executes it, or returns null. */
function makeBestPlay(state: GameState): GameState | null {
  const ai = state.players.ai;

  const cardOptions = ai.hand
    .filter((c) => canPlayCard(state, "ai", c.instanceId))
    .map((c) => ({ card: c, def: getCardDef(c.defId) }))
    .filter(({ def }) => isWorthPlaying(state, def.onPlay, def.requiresTarget, def.targetFilter));

  // Best card by tempo (most mana spent), tie-break toward minions.
  cardOptions.sort((a, b) => {
    if (b.def.cost !== a.def.cost) return b.def.cost - a.def.cost;
    return (b.def.type === "minion" ? 1 : 0) - (a.def.type === "minion" ? 1 : 0);
  });
  const bestCard = cardOptions[0];

  // Consider the Hero Power if nothing better to do with the mana.
  const power = ai.hero.power;
  const canPower = canUseHeroPower(state, "ai") && isWorthPlaying(state, power.effects, power.requiresTarget, power.targetFilter);

  // Prefer playing cards; use the power when no card is affordable or the power
  // is clearly strong (cheap and impactful) and we'd otherwise waste mana.
  if (bestCard) {
    const target = bestCard.def.requiresTarget
      ? chooseTarget(state, bestCard.def.onPlay, bestCard.def.targetFilter) ?? undefined
      : undefined;
    return playCard(state, "ai", bestCard.card.instanceId, target ? { target } : {});
  }
  if (canPower) {
    const target = power.requiresTarget ? chooseTargetForPower(state, power) ?? undefined : undefined;
    if (power.requiresTarget && !target) return null;
    return useHeroPower(state, "ai", target ? { target } : {});
  }
  return null;
}

/** Avoid playing reactive effects that would be wasted (e.g. heal at full HP). */
function isWorthPlaying(
  state: GameState,
  effects: Effect[] | undefined,
  requiresTarget: boolean | undefined,
  filter: CardDef["targetFilter"],
): boolean {
  if (!requiresTarget) return true;
  if (effects?.some((e) => e.kind === "heal" || e.kind === "buff")) {
    return chooseTarget(state, effects, filter) != null;
  }
  return validTargets(state, "ai", filter).length > 0;
}

function chooseTargetForPower(state: GameState, power: HeroPower): CharacterRef | null {
  return chooseTarget(state, power.effects, power.targetFilter);
}

function chooseTarget(
  state: GameState,
  effects: Effect[] | undefined,
  filter: CardDef["targetFilter"],
): CharacterRef | null {
  const targets = validTargets(state, "ai", filter);
  if (targets.length === 0) return null;

  const damage = effects?.find((e) => e.kind === "damage");
  if (damage && damage.kind === "damage") {
    const enemyMinions = state.players.player.board;
    const killable = enemyMinions
      .filter((m) => m.health <= damage.amount && !m.divineShield)
      .sort((a, b) => b.attack - a.attack)[0];
    if (killable) return { kind: "minion", instanceId: killable.instanceId };
    // If the spell can hit face, push damage; otherwise hit the biggest threat.
    const faceOk = targets.some((t) => t.kind === "hero" && t.player === "player");
    if (faceOk) return { kind: "hero", player: "player" };
    const biggest = [...enemyMinions].sort((a, b) => b.attack - a.attack)[0];
    return biggest ? { kind: "minion", instanceId: biggest.instanceId } : targets[0];
  }

  const heal = effects?.find((e) => e.kind === "heal");
  if (heal && heal.kind === "heal") {
    const candidates: Array<{ ref: CharacterRef; missing: number }> = [];
    const aiHero = state.players.ai.hero;
    if (aiHero.health < aiHero.maxHealth) {
      candidates.push({ ref: { kind: "hero", player: "ai" }, missing: aiHero.maxHealth - aiHero.health });
    }
    for (const m of state.players.ai.board) {
      if (m.health < m.maxHealth) {
        candidates.push({ ref: { kind: "minion", instanceId: m.instanceId }, missing: m.maxHealth - m.health });
      }
    }
    candidates.sort((a, b) => b.missing - a.missing);
    return candidates[0]?.ref ?? null;
  }

  const buff = effects?.find((e) => e.kind === "buff");
  if (buff) {
    // Buff our strongest friendly minion (it'll attack hardest).
    const best = [...state.players.ai.board].sort((a, b) => b.attack + b.health - (a.attack + a.health))[0];
    return best ? { kind: "minion", instanceId: best.instanceId } : null;
  }

  return targets[0];
}

interface AttackMove {
  attackerId: string;
  target: CharacterRef;
}

function bestAttack(state: GameState): AttackMove | null {
  const ai = state.players.ai;
  const ready = ai.board.filter((m) => canAttack(state, "ai", m.instanceId));
  if (ready.length === 0) return null;

  ready.sort((a, b) => b.attack - a.attack);
  const attacker = ready[0];
  const legal = validAttackTargets(state, "ai");
  const minionTargets = legal.filter((t) => t.kind === "minion");
  const heroTarget = legal.find((t) => t.kind === "hero");

  // Lethal: swing face if it kills.
  if (heroTarget && heroTarget.kind === "hero" && state.players.player.hero.health <= attacker.attack) {
    return { attackerId: attacker.instanceId, target: heroTarget };
  }

  let best: { target: CharacterRef; score: number } | null = null;
  for (const t of minionTargets) {
    if (t.kind !== "minion") continue;
    const enemy = findMinion(state, t.instanceId);
    if (!enemy) continue;
    const kills = attacker.keywords.includes("poisonous")
      ? !enemy.divineShield
      : !enemy.divineShield && attacker.attack >= enemy.health;
    const survives = attacker.health > enemy.attack;
    let score = 0;
    if (kills && survives) score = 100 + enemy.attack + enemy.health;
    else if (kills) score = 40 + enemy.attack;
    else score = enemy.attack;
    if (!best || score > best.score) best = { target: t, score };
  }

  const taunted = minionTargets.length > 0 && !heroTarget;
  if (taunted && best) return { attackerId: attacker.instanceId, target: best.target };
  if (best && best.score >= 100) return { attackerId: attacker.instanceId, target: best.target };
  if (heroTarget) return { attackerId: attacker.instanceId, target: heroTarget };
  if (best) return { attackerId: attacker.instanceId, target: best.target };
  return null;
}

/** Cards to throw back during the opening mulligan: keep the cheap curve. */
export function chooseMulligan(state: GameState, playerId: PlayerId): string[] {
  const hand = state.players[playerId].hand;
  return hand.filter((c) => getCardDef(c.defId).cost >= 4).map((c) => c.instanceId);
}

export function describeMinion(m: Minion): string {
  return `${m.name} ${m.attack}/${m.health}`;
}
