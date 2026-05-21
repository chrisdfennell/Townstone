import type { CardDef, CharacterRef, GameState, Minion } from "./types";
import { getCardDef } from "./cards";
import {
  attack,
  canAttack,
  canPlayCard,
  findMinion,
  playCard,
  validAttackTargets,
  validTargets,
} from "./engine";

/**
 * A simple greedy "tempo" AI for milestone 1.
 *
 * Strategy: spend as much mana as possible each turn on the highest-impact
 * plays, then attack — taking favorable trades when available and otherwise
 * pushing damage at the enemy hero. It is deliberately beatable but not silly.
 *
 * Returns a list of intermediate states ("frames") so the UI can replay the
 * AI's turn one action at a time. The caller is responsible for ending the
 * turn after the frames are shown.
 */
export function runAiTurn(start: GameState): GameState[] {
  const frames: GameState[] = [];
  let state = start;

  // --- Play phase: keep making the best affordable play. ---
  // Bounded loop: every successful play removes a card or fills the board.
  for (let guard = 0; guard < 30; guard++) {
    const move = bestPlay(state);
    if (!move) break;
    const next = playCard(state, "ai", move.instanceId, move.target ? { target: move.target } : {});
    if (next === state) break; // play was rejected — avoid an infinite loop
    state = next;
    frames.push(state);
    if (state.phase === "gameOver") return frames;
  }

  // --- Attack phase: resolve one attacker at a time. ---
  for (let guard = 0; guard < 30; guard++) {
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

interface PlayMove {
  instanceId: string;
  target?: CharacterRef;
}

function bestPlay(state: GameState): PlayMove | null {
  const ai = state.players.ai;
  const playable = ai.hand
    .filter((c) => canPlayCard(state, "ai", c.instanceId))
    .map((c) => ({ card: c, def: getCardDef(c.defId) }))
    .filter(({ def }) => isWorthPlaying(state, def));

  if (playable.length === 0) return null;

  // Prefer spending the most mana (tempo); break ties toward minions.
  playable.sort((a, b) => {
    if (b.def.cost !== a.def.cost) return b.def.cost - a.def.cost;
    const am = a.def.type === "minion" ? 1 : 0;
    const bm = b.def.type === "minion" ? 1 : 0;
    return bm - am;
  });

  const choice = playable[0];
  const target = choice.def.requiresTarget ? chooseTarget(state, choice.def) ?? undefined : undefined;
  return { instanceId: choice.card.instanceId, target };
}

/** Avoid playing reactive cards that would be wasted (e.g. heal at full HP). */
function isWorthPlaying(state: GameState, def: CardDef): boolean {
  if (!def.requiresTarget) return true;
  const healEffect = def.onPlay?.some((e) => e.kind === "heal");
  if (healEffect) {
    return chooseTarget(state, def) != null;
  }
  return validTargets(state, "ai", def).length > 0;
}

function chooseTarget(state: GameState, def: CardDef): CharacterRef | null {
  const targets = validTargets(state, "ai", def);
  if (targets.length === 0) return null;

  const damage = def.onPlay?.find((e) => e.kind === "damage");
  if (damage && damage.kind === "damage") {
    const enemyMinions = state.players.player.board;
    // Prefer a kill on the highest-attack enemy minion the spell can finish.
    const killable = enemyMinions
      .filter((m) => m.health <= damage.amount && !m.divineShield)
      .sort((a, b) => b.attack - a.attack)[0];
    if (killable) return { kind: "minion", instanceId: killable.instanceId };
    return { kind: "hero", player: "player" };
  }

  const heal = def.onPlay?.find((e) => e.kind === "heal");
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

  // Pick our biggest attacker first so it threatens the best trade/burst.
  ready.sort((a, b) => b.attack - a.attack);
  const attacker = ready[0];
  const legal = validAttackTargets(state, "ai");

  const minionTargets = legal.filter((t) => t.kind === "minion");
  const heroTarget = legal.find((t) => t.kind === "hero");

  // Lethal check: hit face if it kills the enemy hero.
  if (heroTarget && heroTarget.kind === "hero") {
    if (state.players.player.hero.health <= attacker.attack) {
      return { attackerId: attacker.instanceId, target: heroTarget };
    }
  }

  // Among legal minion targets, find the best favorable trade.
  let best: { target: CharacterRef; score: number } | null = null;
  for (const t of minionTargets) {
    if (t.kind !== "minion") continue;
    const enemy = findMinion(state, t.instanceId);
    if (!enemy) continue;
    const kills = !enemy.divineShield && attacker.attack >= enemy.health;
    const survives = attacker.health > enemy.attack;
    let score = 0;
    if (kills && survives) score = 100 + enemy.attack + enemy.health; // clean kill
    else if (kills) score = 40 + enemy.attack; // trade down a threat
    else score = enemy.attack; // chip
    if (!best || score > best.score) best = { target: t, score };
  }

  // If there are taunts, we MUST attack a minion (legal contains only taunts).
  const taunted = minionTargets.length > 0 && !heroTarget;
  if (taunted && best) return { attackerId: attacker.instanceId, target: best.target };

  // Otherwise: take a strong trade, else go face.
  if (best && best.score >= 100) return { attackerId: attacker.instanceId, target: best.target };
  if (heroTarget) return { attackerId: attacker.instanceId, target: heroTarget };
  if (best) return { attackerId: attacker.instanceId, target: best.target };
  return null;
}

/** Exposed for tests/debugging. */
export function describeMinion(m: Minion): string {
  return `${m.name} ${m.attack}/${m.health}`;
}
