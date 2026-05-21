/**
 * Deterministic RNG (mulberry32). We thread the seed through GameState so a
 * game is fully replayable from its starting seed + action list — important
 * for debugging and for authoritative multiplayer later.
 */

/** Returns a float in [0, 1) and the next seed state. */
export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t >>> 0 };
}

/** Returns an integer in [0, max) and the next seed state. */
export function nextInt(state: number, max: number): { value: number; state: number } {
  const r = nextRandom(state);
  return { value: Math.floor(r.value * max), state: r.state };
}

/** Fisher-Yates shuffle returning a new array and the advanced seed state. */
export function shuffle<T>(items: T[], state: number): { items: T[]; state: number } {
  const arr = items.slice();
  let s = state;
  for (let i = arr.length - 1; i > 0; i--) {
    const r = nextInt(s, i + 1);
    s = r.state;
    const j = r.value;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { items: arr, state: s };
}
