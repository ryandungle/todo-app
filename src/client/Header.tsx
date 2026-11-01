import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

type Props = {
  title: string;
  onOpenMenu: () => void;
  children?: ReactNode;
};

export function Header({ title, onOpenMenu, children }: Props) {
  const [now, setNow] = useState(() => new Date());
  const busy = useIsFetching() + useIsMutating() > 0;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
  const time = now.toLocaleTimeString(undefined, { hour12: true });

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-white px-4 py-3 sm:px-7">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMenu}
          className="rounded-lg border border-line p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
          aria-label="Open menu"
        >
          <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
        <div className="eyebrow font-semibold text-brand-600">TaskFlow</div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{title}</h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              busy ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            <span className={`size-1.5 rounded-full ${busy ? "bg-amber-500" : "bg-emerald-500"}`} />
            {busy ? "Syncing" : "Synced"}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {date} · <span className="font-mono text-brand-600">{time}</span>
        </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">{children}</div>
    </header>
  );
}
