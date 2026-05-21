import { WebSocketServer, WebSocket } from "ws";
import type { PlayerId } from "../src/engine";
import type { ClientMessage, ServerMessage } from "../src/net/protocol";
import { DEFAULT_PORT } from "../src/net/protocol";
import { Match, type Seat } from "./match";

const PORT = Number(process.env.PORT) || DEFAULT_PORT;

interface ClientCtx {
  socket: WebSocket;
  queued?: Omit<Seat, "send">;
  match?: Match;
  seat?: PlayerId;
}

const contexts = new Map<WebSocket, ClientCtx>();
/** At most one player sits in the matchmaking queue at a time. */
let waiting: ClientCtx | null = null;

function send(socket: WebSocket, msg: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function startMatch(a: ClientCtx, b: ClientCtx): void {
  const seatA: Seat = { ...a.queued!, send: (m) => send(a.socket, m) };
  const seatB: Seat = { ...b.queued!, send: (m) => send(b.socket, m) };
  const match = new Match(seatA, seatB);
  a.match = match;
  a.seat = "player";
  b.match = match;
  b.seat = "ai";
  console.log(`[match] ${seatA.name} (${seatA.className}) vs ${seatB.name} (${seatB.className})`);
}

function handle(ctx: ClientCtx, msg: ClientMessage): void {
  if (msg.t === "queue") {
    if (ctx.match) return; // already playing
    ctx.queued = { name: (msg.name || "Challenger").slice(0, 24), className: msg.className, deck: msg.deck };
    if (waiting && waiting !== ctx && waiting.socket.readyState === WebSocket.OPEN && !waiting.match) {
      const opponent = waiting;
      waiting = null;
      startMatch(opponent, ctx);
    } else {
      waiting = ctx;
      send(ctx.socket, { t: "waiting" });
    }
    return;
  }

  if (msg.t === "leave") {
    cleanup(ctx);
    return;
  }

  if (ctx.match && ctx.seat) ctx.match.handle(ctx.seat, msg);
}

function cleanup(ctx: ClientCtx): void {
  if (waiting === ctx) waiting = null;
  if (ctx.match && ctx.seat) {
    ctx.match.opponentLeft(ctx.seat);
    ctx.match = undefined;
    ctx.seat = undefined;
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (socket) => {
  const ctx: ClientCtx = { socket };
  contexts.set(socket, ctx);

  socket.on("message", (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    try {
      handle(ctx, msg);
    } catch (err) {
      console.error("[error] handling message", err);
      send(socket, { t: "error", message: "Server error processing your action." });
    }
  });

  socket.on("close", () => {
    cleanup(ctx);
    contexts.delete(socket);
  });
});

console.log(`Townstone server listening on ws://localhost:${PORT}`);
