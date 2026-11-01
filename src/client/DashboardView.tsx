import { useCallback, useEffect, useState } from "react";
import type { List } from "../shared/schemas";
import { useOverview } from "./hooks";
import { Summary } from "./Summary";
import { useListRoom, type RoomStatus } from "./useListRoom";

type Props = { lists: List[] };

/** Renders nothing; keeps a room subscription open and reports its status upward. */
export function RoomSubscriber({
  listId,
  onStatus,
}: {
  listId: string;
  onStatus: (listId: string, status: RoomStatus) => void;
}) {
  const status = useListRoom(listId);
  useEffect(() => onStatus(listId, status), [listId, status, onStatus]);
  return null;
}

export function DashboardView({ lists }: Props) {
  const { todos, error } = useOverview();
  const [statuses, setStatuses] = useState<Record<string, RoomStatus>>({});

  const handleStatus = useCallback((listId: string, status: RoomStatus) => {
    setStatuses((prev) => (prev[listId] === status ? prev : { ...prev, [listId]: status }));
  }, []);

  const values = Object.values(statuses);
  const roomStatus: RoomStatus =
    values.length === 0
      ? "connecting"
      : values.every((s) => s === "live")
        ? "live"
        : values.some((s) => s === "offline")
          ? "offline"
          : "connecting";

  const sharedCount = lists.filter((l) => l.memberCount > 1).length;
  const eyebrow = `${lists.length} list${lists.length === 1 ? "" : "s"} · ${
    sharedCount === 0 ? "none shared" : `${sharedCount} shared`
  }`;

  return (
    <section>
      {lists.map((l) => (
        <RoomSubscriber key={l.id} listId={l.id} onStatus={handleStatus} />
      ))}

      {error && (
        <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <Summary todos={todos} eyebrow={eyebrow} subject="You" roomStatus={roomStatus} />
    </section>
  );
}
