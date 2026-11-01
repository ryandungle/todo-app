import { listColor } from "./listColor";

export function ListTag({ listId, name, className }: { listId: string; name: string; className?: string }) {
  const { tag, dot } = listColor(listId);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none ${tag} ${className ?? ""}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="max-w-[10rem] truncate">{name}</span>
    </span>
  );
}
