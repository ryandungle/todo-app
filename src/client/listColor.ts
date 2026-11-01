export type ListColor = { tag: string; dot: string; ring: string };

// Literal class strings so Tailwind v4 can detect them.
const palette: readonly ListColor[] = [
  { tag: "border-sky-200 bg-sky-50/60 text-sky-800", dot: "bg-sky-500", ring: "border-sky-300" },
  { tag: "border-violet-200 bg-violet-50/60 text-violet-800", dot: "bg-violet-500", ring: "border-violet-300" },
  { tag: "border-rose-200 bg-rose-50/60 text-rose-800", dot: "bg-rose-500", ring: "border-rose-300" },
  { tag: "border-amber-200 bg-amber-50/60 text-amber-800", dot: "bg-amber-500", ring: "border-amber-300" },
  { tag: "border-emerald-200 bg-emerald-50/60 text-emerald-800", dot: "bg-emerald-500", ring: "border-emerald-300" },
  { tag: "border-orange-200 bg-orange-50/60 text-orange-800", dot: "bg-orange-500", ring: "border-orange-300" },
  { tag: "border-fuchsia-200 bg-fuchsia-50/60 text-fuchsia-800", dot: "bg-fuchsia-500", ring: "border-fuchsia-300" },
  { tag: "border-cyan-200 bg-cyan-50/60 text-cyan-800", dot: "bg-cyan-500", ring: "border-cyan-300" },
  { tag: "border-lime-200 bg-lime-50/60 text-lime-800", dot: "bg-lime-500", ring: "border-lime-300" },
  { tag: "border-indigo-200 bg-indigo-50/60 text-indigo-800", dot: "bg-indigo-500", ring: "border-indigo-300" },
];

/** Deterministic color for a list, derived from its id (djb2 hash). */
export function listColor(id: string): ListColor {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) + hash + id.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length]!;
}
