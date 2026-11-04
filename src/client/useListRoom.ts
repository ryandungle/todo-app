import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { roomEventSchema } from "../shared/schemas";
import { keys } from "./hooks";

export type RoomStatus = "connecting" | "live" | "offline";

const MIN_BACKOFF = 1_000;
const MAX_BACKOFF = 15_000;
const PING_INTERVAL = 30_000;
const INVALIDATE_DELAY = 50;

const pendingInvalidations = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Coalesces bursts of invalidations for the same query key (e.g. one per list
 * socket opening at once) into a single invalidation after a short delay.
 */
function invalidateSoon(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  delayMs = INVALIDATE_DELAY,
) {
  const id = JSON.stringify(queryKey);
  const pending = pendingInvalidations.get(id);
  if (pending) clearTimeout(pending);
  pendingInvalidations.set(
    id,
    setTimeout(() => {
      pendingInvalidations.delete(id);
      queryClient.invalidateQueries({ queryKey });
    }, delayMs),
  );
}

/**
 * Subscribes to the list's Durable Object room. Events only say *what* changed,
 * so we respond by invalidating the relevant React Query cache and refetching.
 */
export function useListRoom(listId: string): RoomStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RoomStatus>("connecting");

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let backoff = MIN_BACKOFF;
    let disposed = false;
    let hasConnected = false;

    const cleanupSocket = () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = undefined;
      ws?.close();
      ws = null;
    };

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${protocol}://${location.host}/api/lists/${listId}/ws`);

      ws.onopen = () => {
        backoff = MIN_BACKOFF;
        setStatus("live");
        // After a reconnect (or a first attempt that failed) we may have missed
        // events. A clean first open needs no catch-up: the queries just fetched.
        if (hasConnected) {
          invalidateSoon(queryClient, keys.todos(listId));
          invalidateSoon(queryClient, keys.overview);
        }
        hasConnected = true;
        pingTimer = setInterval(() => ws?.send("ping"), PING_INTERVAL);
      };

      ws.onmessage = (msg) => {
        if (msg.data === "pong") return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(msg.data));
        } catch {
          return;
        }
        const event = roomEventSchema.safeParse(parsed);
        if (!event.success) return;

        switch (event.data.type) {
          case "todos":
            invalidateSoon(queryClient, keys.todos(listId));
            invalidateSoon(queryClient, keys.overview);
            break;
          case "members":
            invalidateSoon(queryClient, keys.members(listId));
            invalidateSoon(queryClient, keys.lists);
            break;
          case "list":
            invalidateSoon(queryClient, keys.lists);
            break;
        }
      };

      ws.onclose = () => {
        hasConnected = true;
        cleanupSocket();
        if (disposed) return;
        setStatus("offline");
        reconnectTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF);
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      cleanupSocket();
    };
  }, [listId, queryClient]);

  return status;
}
