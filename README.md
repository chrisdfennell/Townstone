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
npm run dev        # http://localhost:5173
npm test           # run engine tests
npm run build      # production build into dist/
```

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
    useGame.ts     # React hook bridging the engine to UI interactions
  components/       # HandCard, MinionView, HeroView
  App.tsx          # board layout + interaction wiring
  index.css        # gothic Diablo theme
```

## Design notes

The engine is deliberately decoupled from React. `GameState` is plain JSON-able
data and every action (`playCard`, `attack`, `endTurn`) is a pure function
`(state, ...args) => newState`. The RNG seed is threaded through the state, so a
game is fully reproducible from `seed + action list`.

## Roadmap

- [ ] More cards, keywords (Deathrattle chains, Spell Damage, Lifesteal, Freeze)
- [ ] Hero powers + Diablo class identities (Barbarian, Sorceress, Necromancer…)
- [ ] Mulligan / opening-hand selection + "The Coin"
- [ ] Deckbuilder and collection
- [ ] Smarter AI (lookahead / scoring of full turns)
- [ ] **Multiplayer**: move the engine behind an authoritative Node + WebSocket
      server. Because the engine is already pure and serializable, the same
      module runs on the server; clients send actions and receive new states.
- [ ] Art, animations, sound
```
