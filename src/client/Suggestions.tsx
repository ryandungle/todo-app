import type { ReactNode } from "react";
import type { Todo } from "../shared/schemas";

/** Duplicate guard: existing items that look like what's being typed. */
export function matchTodos<T extends Todo>(todos: T[], title: string) {
  const typed = title.trim().toLowerCase();
  const similar = typed.length >= 2 ? todos.filter((t) => t.title.toLowerCase().includes(typed)).slice(0, 6) : [];
  const exactActive = typed ? todos.find((t) => !t.completed && t.title.trim().toLowerCase() === typed) : undefined;
  const exactDone = typed ? todos.find((t) => t.completed && t.title.trim().toLowerCase() === typed) : undefined;
  return { similar, exactActive, exactDone };
}

export function SuggestionList<T extends Todo>({
  items,
  onPick,
  renderMeta,
  heading = "Already on this list",
}: {
  items: T[];
  onPick: (todo: T) => void;
  /** Optional extra content after the title (e.g. a list tag in the master view). */
  renderMeta?: (todo: T) => ReactNode;
  heading?: string;
}) {
  return (
    <ul
      role="listbox"
      className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg"
    >
      <li className="eyebrow px-3 py-1.5 text-slate-400">{heading}</li>
      {items.map((t) => (
        <li key={t.id} role="option" aria-selected={false}>
          <button
            type="button"
            // onMouseDown so it fires before the input's blur hides the list
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(t);
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
          >
            <span className={`size-1.5 shrink-0 rounded-full ${t.completed ? "bg-amber-400" : "bg-brand-500"}`} />
            <span className={`min-w-0 flex-1 truncate ${t.completed ? "text-slate-400 line-through" : "text-slate-800"}`}>
              {t.title}
            </span>
            {renderMeta?.(t)}
            <span className="shrink-0 text-xs text-slate-400">
              {t.completed ? "Done · click to re-open" : "Active · click to view"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DuplicateNote<T extends Todo>({
  exactActive,
  exactDone,
  onReopen,
  className = "mt-2",
  where = () => "this list",
}: {
  exactActive?: T;
  exactDone?: T;
  onReopen: (todo: T) => void;
  className?: string;
  /** Where the active duplicate lives; defaults to "this list". */
  where?: (todo: T) => string;
}) {
  if (exactActive) {
    return (
      <p className={`${className} text-xs text-amber-700`}>“{exactActive.title}” is already on {where(exactActive)} and still active.</p>
    );
  }
  if (exactDone) {
    return (
      <p className={`${className} text-xs text-slate-500`}>
        “{exactDone.title}” was already completed —{" "}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onReopen(exactDone);
          }}
          className="font-medium text-brand-600 hover:underline"
        >
          re-open it
        </button>{" "}
        or add it again.
      </p>
    );
  }
  return null;
}
