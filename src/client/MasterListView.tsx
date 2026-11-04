import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { Actor, List, OverviewTodo } from "../shared/schemas";
import { RoomSubscriber } from "./DashboardView";
import { keys, useOverview, useOverviewMove, useOverviewToggle } from "./hooks";
import { DuplicateNote, matchTodos, SuggestionList } from "./Suggestions";
import { actorLabel, Avatar, filterLabel, relativeTime } from "./TaskTable";
import type { Filter } from "./types";
import { ListTag } from "./ListTag";
import { listColor } from "./listColor";
import { chevron, Menu } from "./Menu";
import { ErrorBox, inputClass, primaryButton } from "./ui";
import { api } from "./api";

const ignoreStatus = () => {};

const ListDot = ({ id }: { id: string }) => (
  <span className="flex size-4 shrink-0 items-center justify-center">
    <span className={`h-2 w-2 rounded-full ${listColor(id).dot}`} />
  </span>
);

export function MasterListView({ lists, me }: { lists: List[]; me: Actor }) {
  const queryClient = useQueryClient();
  const { todos, isPending, error } = useOverview();
  const toggle = useOverviewToggle(me);
  const move = useOverviewMove();
  const [title, setTitle] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  // Falls back to "Personal", then the first list, until the user picks one.
  const targetId =
    lists.find((l) => l.id === pickedId)?.id ??
    lists.find((l) => l.role === "owner" && l.name === "Personal")?.id ??
    lists.find((l) => l.role === "owner")?.id ??
    lists[0]?.id ??
    "";

  // Suggestions search every list; the select only picks where a new task is added.
  const { similar, exactActive, exactDone } = matchTodos(todos, title);
  const showSuggestions = inputFocused && similar.length > 0;

  const jumpTo = (todo: OverviewTodo) => {
    setTitle("");
    setFilter("all");
    setHighlightId(todo.id);
    setTimeout(() => setHighlightId((id) => (id === todo.id ? null : id)), 2000);
    requestAnimationFrame(() =>
      document.getElementById(`todo-${todo.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  };

  const reopen = (todo: OverviewTodo) => {
    toggle.mutate({ listId: todo.listId, id: todo.id, completed: false });
    jumpTo(todo);
  };

  const add = useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) => api.todos.create(listId, { title }),
    onSettled: (_data, _err, { listId }) => {
      queryClient.invalidateQueries({ queryKey: keys.overview });
      queryClient.invalidateQueries({ queryKey: keys.todos(listId) });
    },
  });

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (exactActive) {
      jumpTo(exactActive);
      return;
    }
    const trimmed = title.trim();
    if (!trimmed || !targetId) return;
    // A new task is active, so the "completed" filter would hide it. Reveal it, like jumpTo.
    if (filter === "completed") setFilter("all");
    add.mutate({ listId: targetId, title: trimmed }, { onSuccess: () => setTitle("") });
  };

  // Grouped by list (in list order); active first, then completed, newest first within each.
  const rows = lists.flatMap((l) =>
    todos
      .filter((t) => t.listId === l.id)
      .filter((t) => (filter === "all" ? true : filter === "active" ? !t.completed : t.completed))
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return b.createdAt - a.createdAt;
      }),
  );
  const counts = {
    all: todos.length,
    active: todos.filter((t) => !t.completed).length,
    completed: todos.filter((t) => t.completed).length,
  };
  const failure = error ?? add.error ?? toggle.error ?? move.error;
  const sharedListIds = new Set(lists.filter((l) => l.memberCount > 1).map((l) => l.id));

  return (
    <section className="rounded-xl border border-line bg-white">
      {lists.map((l) => (
        <RoomSubscriber key={l.id} listId={l.id} onStatus={ignoreStatus} />
      ))}

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 border-b border-line px-5 py-4">
        <div className="relative min-w-48 flex-1">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setInputFocused(true);
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(e) => e.key === "Escape" && (e.target as HTMLInputElement).blur()}
            placeholder="Add a task…"
            maxLength={200}
            aria-label="New task"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            className={`${inputClass} ${exactActive ? "border-amber-400! focus:border-amber-400! focus:ring-amber-400/20!" : ""}`}
          />
          {showSuggestions && (
            <SuggestionList
              items={similar}
              heading="Already on your lists"
              onPick={(t) => (t.completed ? reopen(t) : jumpTo(t))}
              renderMeta={(t) => (
                <ListTag listId={t.listId} name={t.listName} className="shrink-0" />
              )}
            />
          )}
        </div>
        <Menu
          items={lists.map((l) => ({
            label: l.name,
            icon: <ListDot id={l.id} />,
            selected: l.id === targetId,
            onSelect: () => {
              setPickedId(l.id);
              setHighlightId(null);
            },
          }))}
        >
          {(props) => (
            <button
              {...props}
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm hover:border-slate-300 focus:border-brand-500 focus:outline-none aria-expanded:border-brand-500 aria-expanded:ring-2 aria-expanded:ring-brand-500/20"
              aria-label="List"
            >
              {targetId && <ListDot id={targetId} />}
              <span className="max-w-40 truncate">{lists.find((l) => l.id === targetId)?.name}</span>
              {chevron}
            </button>
          )}
        </Menu>
        <button
          type="submit"
          disabled={!title.trim() || !targetId || add.isPending}
          className={`${primaryButton} w-auto! ${exactActive ? "border border-amber-300 bg-amber-50! text-amber-800! hover:bg-amber-100!" : ""}`}
        >
          {exactActive ? "Show" : "Add"}
        </button>
        <div className="ml-auto">
          <Menu
            align="right"
            items={(["all", "active", "completed"] as const).map((f) => ({
              label: `${filterLabel[f]} (${counts[f]})`,
              selected: filter === f,
              onSelect: () => setFilter(f),
            }))}
          >
            {(props) => (
              <button
                {...props}
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm hover:border-slate-300 focus:border-brand-500 focus:outline-none aria-expanded:border-brand-500 aria-expanded:ring-2 aria-expanded:ring-brand-500/20"
                aria-label="Filter by status"
              >
                {filter === "all" ? (
                  <span>
                    All<span className="hidden sm:inline"> statuses</span>
                  </span>
                ) : (
                  filterLabel[filter]
                )}
                <span className="font-mono text-xs text-slate-400">{counts[filter]}</span>
                {chevron}
              </button>
            )}
          </Menu>
        </div>
        <DuplicateNote
          exactActive={exactActive}
          exactDone={exactDone}
          onReopen={reopen}
          where={(t) => t.listName}
          className="basis-full"
        />
      </form>

      {failure && (
        <div className="border-b border-line px-5 py-3">
          <ErrorBox>{failure.message}</ErrorBox>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="hidden md:table-header-group">
          <tr className="bg-slate-50 text-left font-mono text-[10px] tracking-wider text-slate-500 uppercase">
            <th className="w-10 px-5 py-2.5 font-medium" aria-label="Done" />
            <th className="px-3 py-2.5 font-medium">Task</th>
            <th className="w-36 px-3 py-2.5 font-medium">List</th>
            <th className="w-24 px-3 py-2.5 font-medium">Status</th>
            <th className="hidden w-28 px-3 py-2.5 font-medium md:table-cell">Added</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {isPending ? (
            <tr>
              <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                {todos.length === 0 ? "No tasks yet. Add one above." : "No tasks match."}
              </td>
            </tr>
          ) : (
            rows.map((todo) => {
              const shared = sharedListIds.has(todo.listId);
              const creator = shared ? actorLabel(todo.createdBy, me.id) : null;
              const completer = shared && todo.completed ? actorLabel(todo.completedBy, me.id) : null;
              const moveMenu = (
                <Menu
                  items={lists.map((l) => ({
                    label: l.name,
                    icon: <ListDot id={l.id} />,
                    selected: l.id === todo.listId,
                    disabled: l.id === todo.listId,
                    onSelect: () =>
                      move.mutate({ fromListId: todo.listId, id: todo.id, toListId: l.id, toListName: l.name }),
                  }))}
                >
                  {(props) => (
                    <button
                      {...props}
                      type="button"
                      aria-label={`Move "${todo.title}" to another list`}
                      className="cursor-pointer rounded-md hover:brightness-95 focus-visible:outline-2 focus-visible:outline-brand-500 aria-expanded:brightness-95"
                    >
                      <ListTag listId={todo.listId} name={todo.listName} />
                    </button>
                  )}
                </Menu>
              );
              return (
              <tr
                key={todo.id}
                id={`todo-${todo.id}`}
                className={`transition-colors duration-700 ${todo.id === highlightId ? "bg-amber-50" : ""}`}
              >
                <td className="w-px px-5 py-3 align-top md:align-middle">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() =>
                      toggle.mutate({ listId: todo.listId, id: todo.id, completed: !todo.completed })
                    }
                    aria-label={`Mark "${todo.title}" as ${todo.completed ? "active" : "completed"}`}
                    className="mt-0.5 size-4 cursor-pointer accent-brand-600 md:mt-0"
                  />
                </td>
                <td className="px-3 py-3">
                  <div>
                    <span className={`wrap-anywhere ${todo.completed ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {todo.title}
                    </span>
                    {creator && (
                      <div className="mt-0.5 hidden items-center gap-1.5 text-xs text-slate-400 md:flex">
                        <Avatar name={todo.createdBy!.name} />
                        added by {creator}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-400 md:hidden">
                      {moveMenu}
                      {creator && (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={todo.createdBy!.name} />
                          {creator}
                        </span>
                      )}
                      <span>· {relativeTime(todo.createdAt)}</span>
                      {completer && <span>· done by {completer}</span>}
                    </div>
                  </div>
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  {moveMenu}
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${
                      todo.completed ? "bg-amber-50 text-amber-700" : "bg-brand-500/10 text-brand-600"
                    }`}
                  >
                    {todo.completed ? "Done" : "Active"}
                  </span>
                  {completer && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs whitespace-nowrap text-slate-400">
                      <Avatar name={todo.completedBy!.name} />
                      by {completer}
                      {todo.completedAt && <span className="text-slate-300">· {relativeTime(todo.completedAt)}</span>}
                    </div>
                  )}
                </td>
                <td className="hidden px-3 py-3 font-mono text-xs text-slate-400 md:table-cell">
                  {relativeTime(todo.createdAt)}
                </td>
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}
