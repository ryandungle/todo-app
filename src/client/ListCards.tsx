import type { List, OverviewTodo } from "../shared/schemas";
import { listColor } from "./listColor";

type Props = {
  lists: List[];
  todos: OverviewTodo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Trash button: delete (owner) or leave (editor). */
  onRemove: (list: List) => void;
};

export function ListCards({ lists, todos, selectedId, onSelect, onRemove }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {lists.map((list) => {
        const items = todos.filter((t) => t.listId === list.id);
        const done = items.filter((t) => t.completed).length;
        const rate = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
        const selected = list.id === selectedId;
        const shared = list.memberCount > 1;
        const isOwner = list.role === "owner";
        const color = listColor(list.id);

        return (
          <div key={list.id} className="group relative">
            <button
              onClick={() => onSelect(list.id)}
              aria-pressed={selected}
              className={`w-full rounded-xl border bg-white p-4 text-left transition ${
                selected ? `${color.ring} ring-1 ring-brand-600` : "border-line hover:border-slate-300"
              }`}
            >
              <div
                className={`mb-3 flex size-8 items-center justify-center rounded-lg ${
                  shared ? "bg-amber-50 text-amber-600" : "bg-brand-500/10 text-brand-600"
                }`}
              >
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  {shared ? (
                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  ) : (
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  )}
                </svg>
              </div>
              <div className="flex items-center gap-2 pr-6 text-sm text-slate-600">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.dot}`} />
                <span className="truncate" title={list.name}>
                  {list.name}
                </span>
              </div>
              <div className="mt-1 text-2xl font-bold tracking-tight">{items.length}</div>
              <div
                className={`mt-1 text-xs ${
                  items.length === 0 ? "text-slate-400" : rate === 100 ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {items.length === 0
                  ? "No tasks yet"
                  : `${rate}% done${shared ? ` · ${list.memberCount} members` : ""}`}
              </div>
            </button>

            <button
              onClick={() => onRemove(list)}
              aria-label={isOwner ? `Delete list "${list.name}"` : `Leave list "${list.name}"`}
              title={isOwner ? "Delete list" : "Leave list"}
              className="absolute top-2.5 right-2.5 rounded-md p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600 focus-visible:text-red-600 focus-visible:outline-none sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              {isOwner ? (
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              ) : (
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
