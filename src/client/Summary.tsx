import type { Todo } from "../shared/schemas";
import type { RoomStatus } from "./useListRoom";

type Props = {
  todos: Todo[];
  /** Small caps line above the headline, e.g. "Groceries · 2 members". */
  eyebrow: string;
  /** Subject of the headline sentence, e.g. "Groceries" or "You". */
  subject: string;
  roomStatus: RoomStatus;
};

const roomBadge: Record<RoomStatus, { label: string; dot: string }> = {
  live: { label: "LIVE", dot: "bg-brand-400" },
  connecting: { label: "CONNECTING", dot: "bg-amber-400 animate-pulse" },
  offline: { label: "RECONNECTING", dot: "bg-red-400 animate-pulse" },
};

const DAY = 86_400_000;

function lastSevenDays(todos: Todo[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const dayStart = start.getTime() - (6 - i) * DAY;
    const inDay = todos.filter((t) => t.createdAt >= dayStart && t.createdAt < dayStart + DAY);
    return {
      label: new Date(dayStart).toLocaleDateString(undefined, { weekday: "short" }),
      active: inDay.filter((t) => !t.completed).length,
      completed: inDay.filter((t) => t.completed).length,
    };
  });
}

export function Summary({ todos, eyebrow, subject, roomStatus }: Props) {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const remaining = total - completed;
  const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const addedToday = todos.filter((t) => t.createdAt >= todayStart).length;

  const days = lastSevenDays(todos);
  const max = Math.max(1, ...days.map((d) => d.active + d.completed));

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="eyebrow text-slate-500">Overview</span>
        <h2 className="text-xl font-semibold">Executive summary</h2>
        <div className="h-px flex-1 bg-line" />
      </div>

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-ink-950 via-ink-900 to-ink-800 p-5 text-white sm:p-7 shadow-lg">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-500/20 blur-3xl" />

        <div className="flex items-start justify-between">
          <div className="eyebrow text-brand-300">{eyebrow}</div>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 font-mono text-[10px] tracking-widest text-slate-300"
            title="Realtime connection status"
          >
            <span className={`size-1.5 rounded-full ${roomBadge[roomStatus].dot}`} />
            {roomBadge[roomStatus].label}
          </span>
        </div>

        <p className="mt-3 max-w-2xl text-2xl leading-snug font-semibold sm:text-3xl">
          <span className="text-slate-300">{subject} {subject === "You" ? "have" : "has"} </span>
          <span className="text-white">{total}</span>
          <span className="text-slate-300"> task{total === 1 ? "" : "s"}, and </span>
          <span className="text-accent-400">{rate}%</span>
          <span className="text-slate-300"> of them are already done.</span>
        </p>

        <div className="mt-8">
          <div className="flex h-32 items-end gap-1.5 sm:gap-3">
            {days.map((d) => {
              const totalDay = d.active + d.completed;
              return (
                <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-28 w-full items-end justify-center gap-1">
                    <div
                      className="w-3 rounded-t-sm bg-brand-500 transition-all"
                      style={{ height: `${(d.active / max) * 100}%`, minHeight: d.active ? 4 : 2 }}
                      title={`${d.active} active`}
                    />
                    <div
                      className="w-3 rounded-t-sm bg-accent-500 transition-all"
                      style={{
                        height: `${(d.completed / max) * 100}%`,
                        minHeight: d.completed ? 4 : 2,
                      }}
                      title={`${d.completed} completed`}
                    />
                  </div>
                  <span className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                    {d.label}
                    {totalDay > 0 && <span className="text-slate-500"> · {totalDay}</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-5 text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-brand-500" /> Active
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-accent-500" /> Completed
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t sm:gap-8 border-white/10 pt-6">
          <div>
            <div className="eyebrow text-slate-400">Tasks remaining</div>
            <div className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{remaining}</div>
            <div className="mt-1 text-sm text-slate-400">
              {remaining === 0 ? "Inbox zero — nice work" : "Waiting on you"}
            </div>
          </div>
          <div>
            <div className="eyebrow text-slate-400">Added today</div>
            <div className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{addedToday}</div>
            <div className="mt-1 text-sm text-slate-400">New since midnight</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {[
          { label: "Total tasks", value: total },
          { label: "Active", value: remaining },
          { label: "Completed", value: completed },
          { label: "Completion rate", value: `${rate}%` },
        ].map((stat) => (
          <div key={stat.label} className="bg-white px-5 py-5">
            <div className="text-sm text-slate-500">{stat.label}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight">{stat.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
