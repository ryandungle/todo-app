import { useState, type FormEvent, type KeyboardEvent } from "react";
import { listNameSchema, todoTitleSchema, type Actor, type List, type Todo } from "../shared/schemas";
import { ConfirmDialog } from "./ConfirmDialog";
import { isPendingTodo, useTodos } from "./hooks";
import { listColor } from "./listColor";
import { chevron, Menu } from "./Menu";
import { DuplicateNote, matchTodos, SuggestionList } from "./Suggestions";
import type { Filter } from "./types";

const filterLabel: Record<Filter, string> = {
  all: "All statuses",
  active: "Active",
  completed: "Completed",
};
import { useListRoom, type RoomStatus } from "./useListRoom";

const roomBadge: Record<RoomStatus, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-emerald-50 text-emerald-700" },
  connecting: { label: "Connecting", cls: "bg-amber-50 text-amber-700" },
  offline: { label: "Reconnecting", cls: "bg-red-50 text-red-700" },
};

type Props = {
  list: List;
  me: Actor;
  onShare: () => void;
  onRename: (name: string) => void;
  onDelete: () => Promise<unknown>;
  onLeave: () => Promise<unknown>;
};

export function TaskTable({ list, me, onShare, onRename, onDelete, onLeave }: Props) {
  const isOwner = list.role === "owner";
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(list.name);
  const [confirm, setConfirm] = useState<"delete" | "leave" | null>(null);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [formError, setFormError] = useState<string | null>(null);

  const [inputFocused, setInputFocused] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const { todos, isPending, error, counts, actions } = useTodos(list.id, me);
  // Attribution only matters when more than one person can touch the list.
  const shared = list.memberCount > 1;
  const roomStatus = useListRoom(list.id);

  // Duplicate guard: surface existing items that look like what's being typed.
  const { similar, exactActive, exactDone } = matchTodos(todos, title);
  const showSuggestions = inputFocused && similar.length > 0;

  const jumpTo = (todo: Todo) => {
    setTitle("");
    setFilter("all");
    setHighlightId(todo.id);
    setTimeout(() => setHighlightId((id) => (id === todo.id ? null : id)), 2000);
    requestAnimationFrame(() =>
      document.getElementById(`todo-${todo.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  };

  const reopen = (todo: Todo) => {
    actions.toggle(todo);
    jumpTo(todo);
  };

  const commitRename = () => {
    const parsed = listNameSchema.safeParse(nameDraft);
    if (parsed.success && parsed.data !== list.name) onRename(parsed.data);
    else setNameDraft(list.name);
    setRenaming(false);
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (exactActive) {
      jumpTo(exactActive);
      return;
    }
    const parsed = todoTitleSchema.safeParse(title);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid title");
      return;
    }
    setFormError(null);
    setTitle("");
    actions.create(parsed.data);
  };

  const visible = todos
    .filter((t) => (filter === "all" ? true : filter === "active" ? !t.completed : t.completed))
    // Active items first (newest on top); completed items below (most recently completed on top).
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.completed) return (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt);
      return b.createdAt - a.createdAt;
    });

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${listColor(list.id).dot}`} />
            {renaming ? (
              <input
                autoFocus
                value={nameDraft}
                maxLength={60}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") {
                    setNameDraft(list.name);
                    setRenaming(false);
                  }
                }}
                className="-mx-1 rounded-md border border-brand-500 px-1 font-semibold outline-none ring-2 ring-brand-500/20"
                aria-label="List name"
              />
            ) : (
              <h3 className="font-semibold">{list.name}</h3>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${roomBadge[roomStatus].cls}`}>
              {roomBadge[roomStatus].label}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            {list.memberCount > 1 ? `${list.memberCount} members` : "just you"} · {counts.all}{" "}
            task{counts.all === 1 ? "" : "s"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Menu
            items={(["all", "active", "completed"] as const).map((f) => ({
              label: `${filterLabel[f]} (${counts[f]})`,
              selected: filter === f,
              onSelect: () => setFilter(f),
            }))}
          >
            {(props) => (
              <button
                {...props}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm hover:border-slate-300 focus:border-brand-500 focus:outline-none aria-expanded:border-brand-500 aria-expanded:ring-2 aria-expanded:ring-brand-500/20"
                aria-label="Filter by status"
              >
                {filterLabel[filter]}
                <span className="font-mono text-xs text-slate-400">{counts[filter]}</span>
                {chevron}
              </button>
            )}
          </Menu>
          <button
            onClick={actions.clearCompleted}
            disabled={counts.completed === 0}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear completed
          </button>
          <button
            onClick={onShare}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/5 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-500/10"
          >
            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {isOwner ? "Share" : "Members"}
          </button>
          <Menu
            align="right"
            items={[
              ...(isOwner
                ? [
                    {
                      label: "Rename list",
                      icon: <PencilIcon />,
                      onSelect: () => {
                        setNameDraft(list.name);
                        setRenaming(true);
                      },
                    },
                  ]
                : []),
              { label: isOwner ? "Share & members" : "Members", icon: <UsersIcon />, onSelect: onShare },
              ...(isOwner
                ? [{ label: "Delete list", icon: <TrashIcon />, danger: true, separator: true, onSelect: () => setConfirm("delete") }]
                : [
                    { label: "Leave list", icon: <LeaveIcon />, danger: true, separator: true, onSelect: () => setConfirm("leave") },
                    { label: "Delete list (owner only)", icon: <TrashIcon />, disabled: true, onSelect: () => {} },
                  ]),
            ]}
          >
            {(props) => (
              <button
                {...props}
                className="rounded-lg border border-line bg-white p-2 text-slate-500 hover:border-slate-300 hover:text-slate-800 aria-expanded:border-brand-500 aria-expanded:ring-2 aria-expanded:ring-brand-500/20"
                aria-label="List options"
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
            )}
          </Menu>
        </div>
      </div>

      {confirm === "delete" && (
        <ConfirmDialog
          title={`Delete “${list.name}”?`}
          confirmLabel="Delete list"
          onConfirm={onDelete}
          onCancel={() => setConfirm(null)}
        >
          This permanently removes the list and all {counts.all} task{counts.all === 1 ? "" : "s"} in it
          {list.memberCount > 1 ? ` for all ${list.memberCount} members` : ""}. This can't be undone.
        </ConfirmDialog>
      )}
      {confirm === "leave" && (
        <ConfirmDialog
          title={`Leave “${list.name}”?`}
          confirmLabel="Leave list"
          onConfirm={onLeave}
          onCancel={() => setConfirm(null)}
        >
          You'll lose access to this list. The owner can invite you again later.
        </ConfirmDialog>
      )}

      <form className="border-y border-line bg-slate-50/60 px-5 py-3" onSubmit={handleAdd}>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              placeholder={`Add a task to ${list.name}…`}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setInputFocused(true);
                if (formError) setFormError(null);
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => e.key === "Escape" && (e.target as HTMLInputElement).blur()}
              maxLength={200}
              aria-invalid={formError ? true : undefined}
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-2 aria-invalid:border-red-400 ${
                exactActive
                  ? "border-amber-400 focus:border-amber-400 focus:ring-amber-400/20"
                  : "border-line focus:border-brand-500 focus:ring-brand-500/20"
              }`}
            />

            {showSuggestions && <SuggestionList items={similar} onPick={(t) => (t.completed ? reopen(t) : jumpTo(t))} />}
          </div>
          <button
            type="submit"
            disabled={!title.trim()}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              exactActive
                ? "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "bg-brand-600 text-white hover:bg-brand-500"
            }`}
          >
            {exactActive ? "Show" : "Add"}
          </button>
        </div>

        <DuplicateNote exactActive={exactActive} exactDone={exactDone} onReopen={reopen} />
      </form>

      {(formError || error) && (
        <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700">
          {formError ?? error?.message}
        </p>
      )}

      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left font-mono text-[10px] tracking-wider text-slate-500 uppercase">
              <th className="w-10 px-5 py-2.5 font-medium">#</th>
              <th className="w-10 px-2 py-2.5 font-medium" aria-label="Done" />
              <th className="px-3 py-2.5 font-medium">Task</th>
              <th className="w-32 px-3 py-2.5 font-medium">Status</th>
              <th className="hidden w-28 px-3 py-2.5 font-medium sm:table-cell">Added</th>
              <th className="w-14 px-3 py-2.5 font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isPending ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  {todos.length === 0 ? "No tasks yet. Add one above." : "No tasks match."}
                </td>
              </tr>
            ) : (
              visible.map((todo, i) => (
                <TaskRow
                  key={todo.id}
                  index={i + 1}
                  todo={todo}
                  shared={shared}
                  meId={me.id}
                  highlighted={todo.id === highlightId}
                  onToggle={() => actions.toggle(todo)}
                  onRename={(t) => actions.rename(todo, t)}
                  onDelete={() => actions.remove(todo)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-full bg-slate-200 font-mono text-[9px] font-semibold text-slate-600 uppercase">
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

export function actorLabel(actor: Actor | null, meId: string) {
  if (!actor) return null;
  return actor.id === meId ? "you" : actor.name;
}

export function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TaskRow({
  index,
  todo,
  shared,
  meId,
  highlighted,
  onToggle,
  onRename,
  onDelete,
}: {
  index: number;
  todo: Todo;
  shared: boolean;
  meId: string;
  highlighted: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const pending = isPendingTodo(todo);
  const creator = shared ? actorLabel(todo.createdBy, meId) : null;
  const completer = shared && todo.completed ? actorLabel(todo.completedBy, meId) : null;

  const commit = () => {
    const parsed = todoTitleSchema.safeParse(draft);
    if (parsed.success && parsed.data !== todo.title) onRename(parsed.data);
    else setDraft(todo.title);
    setEditing(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setDraft(todo.title);
      setEditing(false);
    }
  };

  const added = new Date(todo.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <tr
      id={`todo-${todo.id}`}
      className={`group transition-colors duration-700 ${pending ? "opacity-50" : ""} ${highlighted ? "bg-amber-50" : ""}`}
      aria-busy={pending || undefined}
    >
      <td className="px-5 py-3 font-mono text-xs text-slate-400">{index}</td>
      <td className="px-2 py-3">
        <input
          type="checkbox"
          checked={todo.completed}
          disabled={pending}
          onChange={onToggle}
          aria-label={`Mark "${todo.title}" as ${todo.completed ? "active" : "completed"}`}
          className="size-4 cursor-pointer accent-brand-600"
        />
      </td>
      <td className="px-3 py-3">
        {editing ? (
          <input
            className="w-full rounded-md border border-brand-500 px-2 py-1 text-sm outline-none ring-2 ring-brand-500/20"
            autoFocus
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKey}
          />
        ) : (
          <div>
            <span
              className={`wrap-anywhere ${todo.completed ? "text-slate-400 line-through" : "text-slate-800"}`}
              onDoubleClick={() => !pending && setEditing(true)}
              title="Double-click to edit"
            >
              {todo.title}
            </span>
            {creator && (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                <Avatar name={todo.createdBy!.name} />
                added by {creator}
              </div>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${
            pending
              ? "bg-slate-100 text-slate-500"
              : todo.completed
                ? "bg-amber-50 text-amber-700"
                : "bg-brand-500/10 text-brand-600"
          }`}
        >
          {pending ? "Saving" : todo.completed ? "Done" : "Active"}
        </span>
        {completer && (
          <div className="mt-1 flex items-center gap-1.5 text-xs whitespace-nowrap text-slate-400">
            <Avatar name={todo.completedBy!.name} />
            by {completer}
            {todo.completedAt && <span className="text-slate-300">· {relativeTime(todo.completedAt)}</span>}
          </div>
        )}
      </td>
      <td className="hidden px-3 py-3 font-mono text-xs text-slate-400 sm:table-cell">{added}</td>
      <td className="px-3 py-3 text-right">
        <Menu
          align="right"
          items={[
            {
              label: todo.completed ? "Mark as active" : "Mark as done",
              icon: <CheckCircleIcon />,
              onSelect: onToggle,
            },
            { label: "Edit", icon: <PencilIcon />, onSelect: () => setEditing(true) },
            { label: "Delete", icon: <TrashIcon />, danger: true, separator: true, onSelect: onDelete },
          ]}
        >
          {(props) => (
            <button
              {...props}
              disabled={pending}
              className="rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:border-line hover:bg-white hover:text-slate-700 focus-visible:border-line aria-expanded:border-line aria-expanded:bg-white aria-expanded:text-slate-700 disabled:opacity-40"
              aria-label={`Actions for "${todo.title}"`}
            >
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          )}
        </Menu>
      </td>
    </tr>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function LeaveIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
