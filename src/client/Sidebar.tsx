export type View = "dashboard" | "lists" | "master";

type Props = {
  view: View;
  onNavigate: (view: View) => void;
  listCount: number;
  user: { name: string; email: string };
  onSignOut: () => void;
  onOpenAccount: () => void;
  /** Mobile drawer state; ignored on large screens where the sidebar is always visible. */
  open: boolean;
  onClose: () => void;
};

const navItems: { key: View; label: string; icon: string }[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-2a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z",
  },
  {
    key: "lists",
    label: "Lists",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    key: "master",
    label: "Master List",
    icon: "M4 6h16M4 12h16M4 18h10",
  },
];

export function Sidebar({ view, onNavigate, listCount, user, onSignOut, onOpenAccount, open, onClose }: Props) {
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col overflow-y-auto bg-ink-950 text-slate-300 transition-transform duration-200 lg:static lg:w-56 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-brand-500 font-bold text-ink-950">
          T
        </div>
        <div className="leading-tight">
          <div className="font-semibold text-white">
            Task<span className="text-brand-400">Flow</span>
          </div>
          <div className="text-[11px] text-brand-300/80">Powered by Hono + React</div>
        </div>
        <button
          onClick={onClose}
          className="ml-auto rounded p-1.5 text-slate-400 hover:bg-ink-900 hover:text-white lg:hidden"
          aria-label="Close menu"
        >
          <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex flex-col gap-1 p-2.5 pt-4">
        {navItems.map((item) => {
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                onNavigate(item.key);
                onClose();
              }}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                active
                  ? "bg-ink-800 font-medium text-white ring-1 ring-white/10"
                  : "hover:bg-ink-900 hover:text-white"
              }`}
            >
              <svg
                className={`size-4 ${active ? "text-brand-400" : "text-slate-400"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d={item.icon} />
              </svg>
              <span className="flex-1">{item.label}</span>
              {item.key === "lists" && (
                <span className="font-mono text-[11px] text-slate-500">{listCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 p-3">
        <div className="flex items-center gap-1 rounded-md py-1 pr-1">
          <button
            onClick={() => {
              onOpenAccount();
              onClose();
            }}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left transition hover:bg-ink-900"
            title="Account settings"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-semibold text-brand-300">
              {initials || "?"}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">{user.name}</div>
              <div className="truncate text-[11px] text-slate-500">{user.email}</div>
            </div>
          </button>
          <button
            onClick={onSignOut}
            className="rounded p-1.5 text-slate-500 transition hover:bg-ink-900 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
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
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}
