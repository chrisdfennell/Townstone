import type { CharacterRef, GameState, Minion, PlayerId } from "./types";
import { getCardDef } from "./cards";
import {
  attack,
  canAttack,
  canPlayCard,
  canUseHeroPower,
  playCard,
  useHeroPower,
  validAttackTargets,
  validTargets,
} from "./engine";

/**
 * Townstone AI.
 *
 * Rather than a fixed greedy script, the AI *searches*: it evaluates board
 * states with a heuristic and runs a beam search over sequences of legal
 * actions for its turn, simulating each via the pure engine. This lets it find
 * multi-step lines the old greedy AI missed — buff-then-attack, setting up
 * favorable trades, and lethal across several attackers.
 *
 * Returns intermediate states ("frames") for the best line so the UI can replay
 * the turn one action at a time. The caller ends the turn afterward.
 */
const WIN_SCORE = 1_000_000;

export type AiDifficulty = "easy" | "normal" | "nightmare";

interface SearchProfile {
  beamWidth: number;
  maxDepth: number;
  /** Hard cap on simulated actions per turn, to keep planning snappy. */
  budget: number;
  /** Random swing added to each evaluation so weaker AIs misjudge trades. */
  noise: number;
}

export const DIFFICULTY_PROFILES: Record<AiDifficulty, SearchProfile> = {
  // Greedy + shallow + noisy: misses combos and sequencing, very beatable.
  easy: { beamWidth: 1, maxDepth: 6, budget: 800, noise: 6 },
  // The full search introduced with the smarter AI.
  normal: { beamWidth: 8, maxDepth: 18, budget: 6000, noise: 0 },
  // Wider + deeper: squeezes out optimal lines and long lethals.
  nightmare: { beamWidth: 14, maxDepth: 24, budget: 16000, noise: 0 },
};

export function runAiTurn(start: GameState, difficulty: AiDifficulty = "normal"): GameState[] {
  const me: PlayerId = "ai";
  const profile = DIFFICULTY_PROFILES[difficulty] ?? DIFFICULTY_PROFILES.normal;

  // A win is always taken regardless of noise; noise only perturbs ordinary
  // positional judgment.
  const scoreFor = (s: GameState): number => {
    const base = evaluateState(s, me);
    if (Math.abs(base) >= WIN_SCORE) return base;
    return base + (profile.noise > 0 ? (Math.random() * 2 - 1) * profile.noise : 0);
  };

  let beam: Node[] = [{ state: start, path: [], score: scoreFor(start) }];
  let best: Node = beam[0];
  let budget = profile.budget;

  for (let depth = 0; depth < profile.maxDepth && budget > 0; depth++) {
    const children: Node[] = [];
    for (const node of beam) {
      if (node.state.phase !== "playing") continue;
      for (const action of legalActions(node.state, me)) {
        if (budget-- <= 0) break;
        const ns = applyAction(node.state, me, action);
        if (ns === node.state) continue; // illegal / no-op
        const child: Node = { state: ns, path: [...node.path, ns], score: scoreFor(ns) };
        children.push(child);
        if (child.score > best.score) best = child;
      }
      if (budget <= 0) break;
    }
    if (children.length === 0) break;
    children.sort((a, b) => b.score - a.score);
    beam = children.slice(0, profile.beamWidth);
  }

  return best.path;
}

interface Node {
  state: GameState;
  path: GameState[];
  score: number;
}

type Action =
  | { type: "play"; instanceId: string; target?: CharacterRef }
  | { type: "power"; target?: CharacterRef }
  | { type: "attack"; attackerId: string; target: CharacterRef };

function applyAction(state: GameState, me: PlayerId, action: Action): GameState {
  switch (action.type) {
    case "play":
      return playCard(state, me, action.instanceId, action.target ? { target: action.target } : {});
    case "power":
      return useHeroPower(state, me, action.target ? { target: action.target } : {});
    case "attack":
      return attack(state, me, action.attackerId, action.target);
  }
}

/**
 * Enumerates the legal actions from a state. Duplicate cards (same definition +
 * same target) are collapsed to one action so the beam isn't wasted exploring
 * identical lines.
 */
function legalActions(state: GameState, me: PlayerId): Action[] {
  const actions: Action[] = [];
  const p = state.players[me];

  const seenPlays = new Set<string>();
  for (const card of p.hand) {
    if (!canPlayCard(state, me, card.instanceId)) continue;
    const def = getCardDef(card.defId);
    if (def.requiresTarget) {
      for (const t of validTargets(state, me, def.targetFilter)) {
        const key = `${def.id}|${refKey(t)}`;
        if (seenPlays.has(key)) continue;
        seenPlays.add(key);
        actions.push({ type: "play", instanceId: card.instanceId, target: t });
      }
    } else {
      if (seenPlays.has(def.id)) continue;
      seenPlays.add(def.id);
      actions.push({ type: "play", instanceId: card.instanceId });
    }
  }

  if (canUseHeroPower(state, me)) {
    const power = p.hero.power;
    if (power.requiresTarget) {
      for (const t of validTargets(state, me, power.targetFilter)) {
        actions.push({ type: "power", target: t });
      }
    } else {
      actions.push({ type: "power" });
    }
  }

  const defenders = validAttackTargets(state, me);
  for (const m of p.board) {
    if (!canAttack(state, me, m.instanceId)) continue;
    for (const t of defenders) actions.push({ type: "attack", attackerId: m.instanceId, target: t });
  }

  return actions;
}

function refKey(ref: CharacterRef): string {
  return ref.kind === "hero" ? `hero:${ref.player}` : `minion:${ref.instanceId}`;
}

// ---------------------------------------------------------------------------
// Heuristic board evaluation
// ---------------------------------------------------------------------------

/** Higher is better for `me`. Used to rank candidate end-of-line states. */
export function evaluateState(state: GameState, me: PlayerId): number {
  const enemy: PlayerId = me === "player" ? "ai" : "player";
  if (state.phase === "gameOver") {
    if (state.winner === me) return WIN_SCORE;
    if (state.winner === enemy) return -WIN_SCORE;
    return 0;
  }

  const myHero = state.players[me].hero;
  const enemyHero = state.players[enemy].hero;

  let score = 0;
  // Effective hero health (health + armor). Pushing the enemy down matters more
  // as they get low, so weight the enemy's missing health a touch extra.
  score += (myHero.health + myHero.armor) * 1.0;
  score -= (enemyHero.health + enemyHero.armor) * 1.3;

  // Board presence dominates tempo decisions.
  for (const m of state.players[me].board) score += minionValue(m) * 2.0;
  for (const m of state.players[enemy].board) score -= minionValue(m) * 2.0;

  // Mild card-advantage term.
  score += state.players[me].hand.length * 1.0;
  score -= state.players[enemy].hand.length * 1.0;

  return score;
}

function minionValue(m: Minion): number {
  let v = m.attack + m.health;
  if (m.keywords.includes("taunt")) v += 1.5;
  if (m.keywords.includes("divineShield")) v += 2;
  if (m.keywords.includes("lifesteal")) v += m.attack * 0.5;
  if (m.keywords.includes("windfury")) v += m.attack * 0.7;
  if (m.keywords.includes("poisonous")) v += 2;
  v += m.spellDamage * 1.5;
  if (m.frozen) v -= 1; // can't attack next turn
  return v;
}

// ---------------------------------------------------------------------------
// Mulligan
// ---------------------------------------------------------------------------

/** Cards to throw back during the opening mulligan: keep the cheap curve. */
export function chooseMulligan(state: GameState, playerId: PlayerId): string[] {
  const hand = state.players[playerId].hand;
  return hand.filter((c) => getCardDef(c.defId).cost >= 4).map((c) => c.instanceId);
}

export function describeMinion(m: Minion): string {
  return `${m.name} ${m.attack}/${m.health}`;
}
