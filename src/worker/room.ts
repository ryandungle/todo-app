import { DurableObject } from "cloudflare:workers";
import type { RoomEvent } from "../shared/schemas";

/**
 * One instance per list. Holds the WebSockets of everyone currently viewing
 * that list and fans out "something changed" events. It never stores todos;
 * D1 remains the source of truth and clients refetch when poked.
 */
export class ListRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  broadcast(event: RoomEvent): void {
    const payload = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Socket is already closing; hibernation API will clean it up.
      }
    }
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (message === "ping") ws.send("pong");
  }

  webSocketClose(ws: WebSocket): void {
    // The peer may have closed with a reserved code (e.g. 1006 on network drop)
    // which we are not allowed to echo back; always acknowledge with 1000.
    try {
      ws.close(1000, "closed");
    } catch {
      // Already closed.
    }
  }

  webSocketError(ws: WebSocket): void {
    try {
      ws.close(1011, "error");
    } catch {
      // Already closed.
    }
  }
}
