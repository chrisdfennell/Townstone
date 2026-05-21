import type { ClientMessage, ServerMessage } from "./protocol";
import { DEFAULT_PORT } from "./protocol";

function envServerUrl(): string | undefined {
  return (import.meta as { env?: Record<string, string> }).env?.VITE_SERVER_URL;
}

/** Resolve the game server URL: explicit env override, else same host : default port. */
export function serverUrl(): string {
  const env = envServerUrl();
  if (env) return env;
  const host = typeof location !== "undefined" ? location.hostname : "localhost";
  return `ws://${host}:${DEFAULT_PORT}`;
}

/**
 * Whether online play can plausibly connect from the current page. It can't on
 * the static GitHub Pages build (HTTPS page + no configured server => the ws://
 * connection is blocked / has nothing to reach). Used to warn before queueing.
 */
export function onlineReachable(): boolean {
  if (envServerUrl()) return true; // a real server was configured at build time
  if (typeof location === "undefined") return true;
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  // An insecure ws:// from an https page is blocked by the browser.
  return localHost || location.protocol !== "https:";
}

export interface ConnectionHandlers {
  onOpen?: () => void;
  onMessage: (msg: ServerMessage) => void;
  onClose?: () => void;
  onError?: () => void;
}

/** Thin typed wrapper over a WebSocket to the Townstone server. */
export class Connection {
  private ws: WebSocket;
  private closed = false;

  constructor(handlers: ConnectionHandlers, url = serverUrl()) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => handlers.onOpen?.();
    this.ws.onmessage = (e) => {
      try {
        handlers.onMessage(JSON.parse(e.data as string) as ServerMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    this.ws.onclose = () => {
      if (!this.closed) handlers.onClose?.();
    };
    this.ws.onerror = () => handlers.onError?.();
  }

  send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      /* already closing */
    }
  }
}
