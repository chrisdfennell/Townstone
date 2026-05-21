import { useEffect, useRef } from "react";
import type { GameState, PlayerId } from "../engine";
import { sfx } from "../audio/sfx";

/** Snapshot of the audible facts we diff between renders. */
interface Snap {
  heroHp: Record<PlayerId, number>;
  hand: Record<PlayerId, number>;
  secrets: Record<PlayerId, number>;
  powerUsed: Record<PlayerId, boolean>;
  minionIds: Set<string>;
  attacks: number; // total attacksThisTurn across all minions
  phase: string;
  winner: PlayerId | null;
}

function snapshot(s: GameState): Snap {
  const all = [...s.players.player.board, ...s.players.ai.board];
  return {
    heroHp: { player: s.players.player.hero.health, ai: s.players.ai.hero.health },
    hand: { player: s.players.player.hand.length, ai: s.players.ai.hand.length },
    secrets: { player: s.players.player.secrets.length, ai: s.players.ai.secrets.length },
    powerUsed: { player: s.players.player.hero.powerUsedThisTurn, ai: s.players.ai.hero.powerUsedThisTurn },
    minionIds: new Set(all.map((m) => m.instanceId)),
    attacks: all.reduce((n, m) => n + m.attacksThisTurn, 0),
    phase: s.phase,
    winner: s.winner,
  };
}

/** Plays synthesized SFX in response to game-state transitions. */
export function useGameSounds(state: GameState): void {
  const prev = useRef<Snap | null>(null);

  useEffect(() => {
    const cur = snapshot(state);
    const p = prev.current;
    prev.current = cur;
    if (!p) return;

    if (cur.phase === "gameOver" && p.phase !== "gameOver") {
      if (cur.winner === "player") sfx.victory();
      else if (cur.winner === "ai") sfx.defeat();
      return; // don't pile other sounds onto the end sting
    }

    let added = 0;
    let removed = 0;
    for (const id of cur.minionIds) if (!p.minionIds.has(id)) added++;
    for (const id of p.minionIds) if (!cur.minionIds.has(id)) removed++;

    const heroDamaged =
      cur.heroHp.player < p.heroHp.player || cur.heroHp.ai < p.heroHp.ai;
    const secretAdded = cur.secrets.player > p.secrets.player || cur.secrets.ai > p.secrets.ai;
    const powerUsed =
      (cur.powerUsed.player && !p.powerUsed.player) || (cur.powerUsed.ai && !p.powerUsed.ai);
    const drew = cur.hand.player > p.hand.player;
    const attacked = cur.attacks > p.attacks;
    // A card left a hand without adding a minion or a secret => a spell resolved.
    const handDropped = cur.hand.player < p.hand.player || cur.hand.ai < p.hand.ai;
    const spellLikely = handDropped && added === 0 && !secretAdded;

    if (removed > 0) sfx.death();
    if (added > 0) sfx.summon();
    if (attacked) sfx.attack();
    if (heroDamaged) sfx.hit();
    if (secretAdded) sfx.secret();
    if (powerUsed) sfx.power();
    if (spellLikely) sfx.spell();
    else if (drew) sfx.draw();
  }, [state]);
}
