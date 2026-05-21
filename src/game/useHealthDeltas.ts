import { useEffect, useRef, useState } from "react";
import type { GameState } from "../engine";
import type { HealthDelta } from "../components/FloatingNumber";

/**
 * Diffs character health between renders to drive floating damage/heal numbers.
 * Keys: minion `instanceId`, or `hero:player` / `hero:ai` for heroes.
 */
export function useHealthDeltas(state: GameState): Map<string, HealthDelta> {
  const prev = useRef<Map<string, number> | null>(null);
  const [deltas, setDeltas] = useState<Map<string, HealthDelta>>(new Map());

  useEffect(() => {
    const cur = new Map<string, number>();
    cur.set("hero:player", state.players.player.hero.health);
    cur.set("hero:ai", state.players.ai.hero.health);
    for (const m of state.players.player.board) cur.set(m.instanceId, m.health);
    for (const m of state.players.ai.board) cur.set(m.instanceId, m.health);

    if (prev.current) {
      const next = new Map<string, HealthDelta>();
      let nonce = Date.now();
      for (const [id, val] of cur) {
        const before = prev.current.get(id);
        if (before != null && before !== val) {
          next.set(id, { delta: val - before, nonce: nonce++ });
        }
      }
      if (next.size > 0) setDeltas(next);
    }
    prev.current = cur;
  }, [state]);

  return deltas;
}
