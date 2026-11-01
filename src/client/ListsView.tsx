import { useState } from "react";
import type { Actor, List } from "../shared/schemas";
import { ConfirmDialog } from "./ConfirmDialog";
import { useOverview } from "./hooks";
import { ListCards } from "./ListCards";
import { TaskTable } from "./TaskTable";

type Props = {
  lists: List[];
  me: Actor;
  selected: List | null;
  onSelect: (id: string) => void;
  onShare: () => void;
  onRename: (list: List, name: string) => void;
  onDelete: (list: List) => Promise<unknown>;
  onLeave: (list: List) => Promise<unknown>;
};

export function ListsView({ lists, me, selected, onSelect, onShare, onRename, onDelete, onLeave }: Props) {
  const { todos } = useOverview();
  const [removing, setRemoving] = useState<List | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="eyebrow text-slate-500">Records</span>
        <h2 className="text-xl font-semibold">My lists</h2>
        <div className="h-px flex-1 bg-line" />
      </div>

      {lists.length === 0 ? (
        <p className="py-20 text-center text-sm text-slate-400">
          No lists yet. Use “New list” above to create one.
        </p>
      ) : (
        <>
          <ListCards
            lists={lists}
            todos={todos}
            selectedId={selected?.id ?? null}
            onSelect={onSelect}
            onRemove={setRemoving}
          />
          {selected && (
            <TaskTable
              key={selected.id}
              list={selected}
              me={me}
              onShare={onShare}
              onRename={(name) => onRename(selected, name)}
              onDelete={() => onDelete(selected)}
              onLeave={() => onLeave(selected)}
            />
          )}
        </>
      )}

      {removing &&
        (removing.role === "owner" ? (
          <ConfirmDialog
            title={`Delete “${removing.name}”?`}
            confirmLabel="Delete list"
            onConfirm={() => onDelete(removing).then(() => setRemoving(null))}
            onCancel={() => setRemoving(null)}
          >
            {(() => {
              const count = todos.filter((t) => t.listId === removing.id).length;
              return `This permanently removes the list and all ${count} task${count === 1 ? "" : "s"} in it${
                removing.memberCount > 1 ? ` for all ${removing.memberCount} members` : ""
              }. This can't be undone.`;
            })()}
          </ConfirmDialog>
        ) : (
          <ConfirmDialog
            title={`Leave “${removing.name}”?`}
            confirmLabel="Leave list"
            onConfirm={() => onLeave(removing).then(() => setRemoving(null))}
            onCancel={() => setRemoving(null)}
          >
            You'll lose access to this list. The owner can invite you again later.
          </ConfirmDialog>
        ))}
    </div>
  );
}
