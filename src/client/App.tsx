import { useCallback, useState } from "react";
import type { List } from "../shared/schemas";
import { AccountPanel } from "./AccountPanel";
import { AuthPage } from "./AuthPage";
import { DashboardView } from "./DashboardView";
import { ResetPasswordPage } from "./ResetPasswordPage";
import { Header } from "./Header";
import { useLists } from "./hooks";
import { ListsView } from "./ListsView";
import { MasterListView } from "./MasterListView";
import { SharePanel } from "./SharePanel";
import { Sidebar, type View } from "./Sidebar";
import { useAuth, type AuthUser } from "./useAuth";

const SELECTED_KEY = "taskflow:selectedList";
const VIEW_KEY = "taskflow:view";

function usePersisted<T extends string>(key: string, fallback: T | null) {
  const [value, setValue] = useState<T | null>(() => (localStorage.getItem(key) as T | null) ?? fallback);
  const set = useCallback(
    (next: T) => {
      localStorage.setItem(key, next);
      setValue(next);
    },
    [key],
  );
  return [value, set] as const;
}

export function App() {
  const auth = useAuth();

  // Password-reset links from email land here; the user is signed out at this point.
  if (location.pathname === "/reset-password") return <ResetPasswordPage />;

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (auth.status === "signed-out") return <AuthPage />;

  return <Shell user={auth.user} onSignOut={auth.signOut} />;
}

function Shell({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const { lists, isPending, error, actions } = useLists();
  const [view, setView] = usePersisted<View>(VIEW_KEY, "dashboard");
  const [selectedId, selectList] = usePersisted<string>(SELECTED_KEY, null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // A stale stored id (list deleted, left, or first visit) silently falls back to the first list.
  const selected: List | null = lists.find((l) => l.id === selectedId) ?? lists[0] ?? null;

  const openList = (id: string) => {
    selectList(id);
    setView("lists");
  };

  const handleCreate = async (name: string) => {
    const created = await actions.create(name);
    openList(created.id);
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        view={view ?? "dashboard"}
        onNavigate={setView}
        listCount={lists.length}
        user={user}
        onSignOut={onSignOut}
        onOpenAccount={() => setAccountOpen(true)}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          title={view === "lists" ? "Lists" : view === "master" ? "Master List" : "Dashboard"}
          onOpenMenu={() => setMenuOpen(true)}
        >
          {view === "lists" && (
            <NewListButton onCreate={handleCreate} />
          )}
        </Header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-7 sm:py-8">
            {error && (
              <p className="mb-6 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
                {error.message}
              </p>
            )}
            {isPending ? (
              <p className="py-20 text-center text-sm text-slate-400">Loading…</p>
            ) : view === "lists" ? (
              <ListsView
                lists={lists}
                me={{ id: user.id, name: user.name }}
                selected={selected}
                onSelect={selectList}
                onShare={() => setSharing(true)}
                onRename={actions.rename}
                onDelete={actions.remove}
                onLeave={(list) => actions.leave(list, user.id)}
              />
            ) : view === "master" ? (
              <MasterListView lists={lists} me={{ id: user.id, name: user.name }} />
            ) : (
              <DashboardView lists={lists} />
            )}
          </div>
        </main>
      </div>

      {accountOpen && <AccountPanel user={user} onClose={() => setAccountOpen(false)} />}

      {sharing && selected && (
        <SharePanel
          list={selected}
          currentUserId={user.id}
          onClose={() => setSharing(false)}
          onRename={(name) => actions.rename(selected, name)}
          onDelete={() => actions.remove(selected)}
          onLeave={() => actions.leave(selected, user.id)}
        />
      )}
    </div>
  );
}

function NewListButton({ onCreate }: { onCreate: (name: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await onCreate(trimmed);
      setName("");
      setOpen(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create list");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
      >
        <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
        New list
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="List name"
        maxLength={60}
        aria-invalid={error ? true : undefined}
        className="w-40 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500 aria-invalid:border-red-400"
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40"
      >
        Create
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg px-2 py-2 text-sm text-slate-500 hover:text-slate-900"
      >
        Cancel
      </button>
    </form>
  );
}
