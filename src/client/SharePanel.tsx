import { useEffect, useState, type FormEvent } from "react";
import { emailSchema, listNameSchema, type List } from "../shared/schemas";
import { useCollaborators, useMembers } from "./hooks";

type Props = {
  list: List;
  currentUserId: string;
  onClose: () => void;
  onRename: (name: string) => void;
  onDelete: () => Promise<unknown>;
  onLeave: () => Promise<unknown>;
};

export function SharePanel({ list, currentUserId, onClose, onRename, onDelete, onLeave }: Props) {
  const isOwner = list.role === "owner";
  const { members, isPending, error, isAdding, actions } = useMembers(list.id);
  const { collaborators } = useCollaborators();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [name, setName] = useState(list.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setEmailError(null);
    actions.resetError();
    try {
      await actions.add(parsed.data);
      setEmail("");
    } catch {
      // surfaced through `error`
    }
  };

  const handleSuggest = async (suggestedEmail: string) => {
    setEmailError(null);
    actions.resetError();
    try {
      await actions.add(suggestedEmail);
      setEmail("");
    } catch {
      // surfaced through `error`
    }
  };

  const query = email.trim().toLowerCase();
  const suggestions = collaborators.filter(
    (c) =>
      !members.some((m) => m.userId === c.id) &&
      (c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query)),
  );

  const commitRename = () => {
    const parsed = listNameSchema.safeParse(name);
    if (parsed.success && parsed.data !== list.name) onRename(parsed.data);
    else setName(list.name);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-6 py-4">
          <div className="eyebrow text-slate-500">{isOwner ? "Share list" : "Shared list"}</div>
          {isOwner ? (
            <input
              id="share-title"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              maxLength={60}
              className="-mx-1 mt-0.5 w-full rounded px-1 text-lg font-semibold outline-none hover:bg-slate-50 focus:bg-slate-50 focus:ring-2 focus:ring-brand-500/20"
              aria-label="List name"
            />
          ) : (
            <h2 id="share-title" className="mt-0.5 text-lg font-semibold">
              {list.name}
            </h2>
          )}
        </div>

        <div className="overflow-y-auto px-6 py-4">
          {isOwner && (
            <form onSubmit={handleAdd} className="mb-4" noValidate>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Invite by email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="friend@example.com"
                  className="flex-1 rounded-lg border border-line px-3.5 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 aria-invalid:border-red-400"
                  aria-invalid={emailError ? true : undefined}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isAdding || !email.trim()}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isAdding ? "Adding…" : "Add"}
                </button>
              </div>
              {!isPending && suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="eyebrow text-slate-500">Suggested</span>
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.email}
                      disabled={isAdding}
                      onClick={() => void handleSuggest(c.email)}
                      className="rounded-full bg-brand-500/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-brand-600 uppercase hover:bg-brand-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              {(emailError || error) && (
                <p className="mt-1.5 text-xs text-red-600">{emailError ?? error?.message}</p>
              )}
              <p className="mt-1.5 text-xs text-slate-500">
                They need a TaskFlow account with this email. Members can add, edit and tick items.
              </p>
            </form>
          )}

          <div className="eyebrow mb-2 text-slate-500">Members · {members.length}</div>
          {isPending ? (
            <p className="py-4 text-center text-sm text-slate-400">Loading…</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {members.map((m) => {
                const isMe = m.userId === currentUserId;
                const canRemove = isOwner && m.role !== "owner";
                return (
                  <li key={m.userId} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-semibold text-brand-700">
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-sm font-medium">
                        {m.name}
                        {isMe && <span className="text-slate-400"> (you)</span>}
                      </div>
                      <div className="truncate text-xs text-slate-500">{m.email}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${
                        m.role === "owner"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-brand-500/10 text-brand-600"
                      }`}
                    >
                      {m.role}
                    </span>
                    {canRemove && (
                      <button
                        onClick={() => actions.remove(m.userId)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${m.name}`}
                      >
                        <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-slate-50/60 px-6 py-3">
          {isOwner ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">Delete this list and all its items?</span>
                <button
                  onClick={() => void onDelete().then(onClose)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-red-600 hover:underline"
              >
                Delete list
              </button>
            )
          ) : (
            <button
              onClick={() => void onLeave().then(onClose)}
              className="text-sm text-red-600 hover:underline"
            >
              Leave list
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
