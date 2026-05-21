import {
  attack,
  beginPlay,
  chooseDiscover,
  classDeck,
  collectibleCards,
  createGame,
  endTurn,
  getCardDef,
  mulligan,
  playCard,
  useHeroPower,
} from "../src/engine";
import type { GameState, HeroClass, PlayerId } from "../src/engine";
import type { ClientMessage, ServerMessage } from "../src/net/protocol";
import { refFromViewer, viewFor } from "./perspective";

export interface Seat {
  name: string;
  className: HeroClass;
  deck: string[];
  send(msg: ServerMessage): void;
}

const COLLECTIBLE_IDS = new Set(collectibleCards().map((c) => c.id));

/** Validate a client-submitted deck; fall back to the class default if cheaty. */
export function sanitizeDeck(className: HeroClass, deck: unknown): string[] {
  if (!Array.isArray(deck) || deck.length !== 30) return classDeck(className);
  const counts = new Map<string, number>();
  for (const id of deck) {
    if (typeof id !== "string" || !COLLECTIBLE_IDS.has(id)) return classDeck(className);
    const def = getCardDef(id);
    if (def.className !== "neutral" && def.className !== className) return classDeck(className);
    const n = (counts.get(id) ?? 0) + 1;
    if (n > (def.legendary ? 1 : 2)) return classDeck(className);
    counts.set(id, n);
  }
  return deck as string[];
}

/** One authoritative game between two connected players. */
export class Match {
  state: GameState;
  ended = false;
  private seats: Record<PlayerId, Seat>;

  constructor(playerSeat: Seat, aiSeat: Seat, seed?: number) {
    this.seats = { player: playerSeat, ai: aiSeat };
    this.state = createGame({
      first: "player",
      seed,
      playerClass: playerSeat.className,
      playerDeck: sanitizeDeck(playerSeat.className, playerSeat.deck),
      aiClass: aiSeat.className,
      aiDeck: sanitizeDeck(aiSeat.className, aiSeat.deck),
    });
    playerSeat.send({ t: "matched", opponentName: aiSeat.name });
    aiSeat.send({ t: "matched", opponentName: playerSeat.name });
    this.broadcast();
  }

  /** Apply a message from `seat`. The engine rejects anything illegal. */
  handle(seat: PlayerId, msg: ClientMessage): void {
    if (this.ended) return;
    switch (msg.t) {
      case "mulligan": {
        this.state = mulligan(this.state, seat, msg.replaceIds);
        if (this.state.players.player.mulliganed && this.state.players.ai.mulliganed) {
          this.state = beginPlay(this.state);
        }
        break;
      }
      case "play": {
        const target = msg.target ? refFromViewer(msg.target, seat) : undefined;
        this.state = playCard(this.state, seat, msg.instanceId, target ? { target } : {});
        break;
      }
      case "power": {
        const target = msg.target ? refFromViewer(msg.target, seat) : undefined;
        this.state = useHeroPower(this.state, seat, target ? { target } : {});
        break;
      }
      case "attack": {
        this.state = attack(this.state, seat, msg.attackerId, refFromViewer(msg.target, seat));
        break;
      }
      case "discover": {
        this.state = chooseDiscover(this.state, seat, msg.index);
        break;
      }
      case "endTurn": {
        this.state = endTurn(this.state, seat);
        break;
      }
      default:
        return;
    }
    this.broadcast();
    if (this.state.phase === "gameOver") this.ended = true;
  }

  /** Sends each seat its own redacted, correctly-oriented view of the game. */
  broadcast(): void {
    for (const seat of ["player", "ai"] as PlayerId[]) {
      this.seats[seat].send({ t: "state", state: viewFor(this.state, seat) });
    }
  }

  /** Called when one side disconnects: tell the other and close the match. */
  opponentLeft(seat: PlayerId): void {
    if (this.ended) return;
    this.ended = true;
    const other: PlayerId = seat === "player" ? "ai" : "player";
    this.seats[other].send({ t: "opponentLeft" });
  }

  seatOf(seat: PlayerId): Seat {
    return this.seats[seat];
  }
}
