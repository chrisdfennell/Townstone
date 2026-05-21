import type { ClientMessage, ServerMessage } from "./protocol";
import { DEFAULT_PORT } from "./protocol";

/** Resolve the game server URL: explicit env override, else same host : default port. */
export function serverUrl(): string {
  const env = (import.meta as { env?: Record<string, string> }).env?.VITE_SERVER_URL;
  if (env) return env;
  const host = typeof location !== "undefined" ? location.hostname : "localhost";
  return `ws://${host}:${DEFAULT_PORT}`;
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
