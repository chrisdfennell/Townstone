# Townstone — guidance for Claude

Diablo-themed Hearthstone-like card game. Web (TypeScript + React + Vite),
single-player vs AI now, multiplayer later.

## Commands
- `npm run dev` — web client (http://localhost:5173)
- `npm run server` — multiplayer WebSocket server (ws://localhost:8787)
- `npm run dev:all` — both, for online play
- `npm test` — Vitest engine + server tests
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
  runs a beam search (profiles in `DIFFICULTY_PROFILES`) over legal action
  sequences, simulating with the pure engine. To tune AI strength, adjust
  `evaluateState` weights or the difficulty profiles — keep `runAiTurn` returning frames.
- Multiplayer (`server/`) reuses the SAME engine. The server keeps the canonical
  game with seats "player"/"ai"; `server/perspective.ts` rewrites each broadcast so
  the recipient is always "player" and the opponent's hand/deck are redacted to
  `"__hidden__"`. Client actions are authored in the sender's own perspective;
  `refFromViewer` maps hero refs back to canonical seats (minion ids are global).
  `useOnlineGame` mirrors the `UseGame` interface so `GameBoard` is shared between
  local and online play. Never trust client decks — `sanitizeDeck` validates them.

## Conventions
- Keep new cards in `cards.ts`; reference by `id`. Add to `starterDeck()` to make
  them appear in play.
- When adding a keyword, update `Keyword` type, `createMinion`, combat/effect
  logic, and the `MinionView` badge rendering.
