# Townstone

A Diablo-themed collectible card game in the spirit of Hearthstone. Play
against an AI opponent in your browser; multiplayer is on the roadmap.

## Stack

- **TypeScript** game engine — pure, serializable, framework-agnostic
- **React + Vite** for the UI
- **Vitest** for engine tests

## Getting started

```bash
npm install
npm run dev        # web client only — http://localhost:5173 (vs AI)
npm run server     # multiplayer server only — ws://localhost:8787
npm run dev:all    # both at once (for online play)
npm test           # run engine + server tests
npm run build      # production build into dist/
```

### Playing online locally

1. `npm run dev:all` (starts the web client and the WebSocket server).
2. Open **two** browser tabs at http://localhost:5173.
3. In each, pick a class/deck, choose **Play Online**, and hit **Find Match** —
   they'll be paired against each other.

> The static GitHub Pages build can't host the WebSocket server (Pages is
> static-only). To play online over the internet, run the server somewhere that
> supports WebSockets (Fly.io, Railway, Render, a VPS…) and point the client at
> it with `VITE_SERVER_URL=wss://your-server` at build time.

## How to play

- You start with 1 mana crystal; gain one more each turn (max 10).
- Click a card in your hand to play it. Targeted spells then ask you to click a
  target (highlighted in red).
- Click one of your minions (glowing gold) to select it, then click an enemy
  to attack. Minions can't attack the turn they're summoned unless they have
  **Charge**. **Taunt** minions must be dealt with first.
- Reduce the enemy hero from 30 health to 0 to win.

## Project layout

```
src/
  engine/          # Pure game logic — no React, fully serializable
    types.ts       # GameState, Minion, Card, Effect, ...
    cards.ts       # Diablo-themed card database + starter deck
    engine.ts      # turns, mana, playing cards, combat, deaths, win check
    ai.ts          # greedy "tempo" AI opponent
    rng.ts         # seedable deterministic RNG (replayable games)
    engine.test.ts # Vitest sanity tests
  game/
    useGame.ts        # React hook bridging the engine to UI (vs AI)
    useOnlineGame.ts  # same interaction surface, but networked
    useHealthDeltas.ts# floating damage/heal numbers
    deckStore.ts      # per-class deck persistence (localStorage)
  net/
    protocol.ts       # shared client<->server message types
    connection.ts     # typed WebSocket client wrapper
  components/         # GameBoard, HandCard, MinionView, HeroView, SetupScreen…
  App.tsx            # screen routing: setup -> local / online
  index.css          # gothic Diablo theme
server/
  index.ts          # WebSocket server + matchmaking queue
  match.ts          # one authoritative game between two seats
  perspective.ts    # per-seat view: orient as "player" + redact hidden info
```

## Multiplayer architecture

The server is **authoritative** and reuses the exact same pure engine the client
runs. It keeps one canonical game whose two seats are the engine's `"player"` and
`"ai"` ids. For each connected player it sends a *per-seat view* that (1) swaps
the board so the recipient is always `"player"` — so the single-player UI works
unchanged — and (2) redacts the opponent's hand and deck. Clients send **actions**
(play/attack/hero-power/end-turn/mulligan); the engine validates them, and the
new state is broadcast to both sides. Illegal actions are simply rejected by the
engine, so the server trusts nothing from clients (decks are sanitized too).

## Design notes

The engine is deliberately decoupled from React. `GameState` is plain JSON-able
data and every action (`playCard`, `attack`, `endTurn`) is a pure function
`(state, ...args) => newState`. The RNG seed is threaded through the state, so a
game is fully reproducible from `seed + action list`.

## Roadmap

- [x] More cards + keywords (Lifesteal, Poisonous, Windfury, Freeze, Spell Damage)
- [x] Hero powers + Diablo class identities — 7 classes (Barbarian, Sorceress,
      Necromancer, Demon Hunter, Rogue, Paladin, Druid)
- [x] Mulligan / opening-hand selection + "The Coin"
- [x] Deckbuilder and collection (per-class, saved to localStorage)
- [x] Juice: floating damage numbers, minion-summon + freeze animations
- [x] Smarter AI — board-evaluation heuristic + beam search over whole-turn lines
- [x] **Multiplayer** — authoritative Node + WebSocket server reusing the pure
      engine, with per-seat perspective + hidden-info redaction and matchmaking
- [ ] Multiplayer polish: reconnect, ranked matchmaking, hosting the server
- [ ] Deathrattle chains, more legendaries, secrets
- [ ] Sound + richer art
```
