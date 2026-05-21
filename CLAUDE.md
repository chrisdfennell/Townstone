# Townstone — guidance for Claude

Diablo-themed Hearthstone-like card game. Web (TypeScript + React + Vite),
single-player vs AI now, multiplayer later.

## Commands
- `npm run dev` — dev server (http://localhost:5173)
- `npm test` — Vitest engine tests
- `npm run build` — typecheck + production build

## Architecture (important)
- **`src/engine/` is pure and framework-free.** No React imports, no DOM. Every
  action is `(GameState, ...args) => GameState` and returns the SAME reference
  when the action is illegal (callers rely on `next === state` to detect this).
- `GameState` must stay fully serializable (plain data only) so it can run on an
  authoritative server for multiplayer. Don't put functions/class instances in it.
- RNG is seeded and threaded through `state.rngState`. Never call `Math.random()`
  inside the engine — use the helpers in `rng.ts` so games stay reproducible.
- Cards are data-driven via the `Effect[]` system in `types.ts`/`cards.ts`. Add
  new mechanics as new `Effect` kinds + handling in `resolveEffect`, not ad-hoc.
- UI talks to the engine only through `src/game/useGame.ts`.
- The AI (`ai.ts`) is search-based: `evaluateState` scores a board and `runAiTurn`
  runs a beam search (width/depth/budget constants at the top) over legal action
  sequences, simulating with the pure engine. To tune AI strength, adjust
  `evaluateState` weights or the beam constants — keep `runAiTurn` returning frames.

## Conventions
- Keep new cards in `cards.ts`; reference by `id`. Add to `starterDeck()` to make
  them appear in play.
- When adding a keyword, update `Keyword` type, `createMinion`, combat/effect
  logic, and the `MinionView` badge rendering.
