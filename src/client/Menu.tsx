import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  /** Renders in red for destructive actions. */
  danger?: boolean;
  /** Shows a check mark; used for single-choice menus like filters. */
  selected?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  separator?: boolean;
};

type Props = {
  items: MenuItem[];
  /** Which edge of the trigger the popover aligns to. */
  align?: "left" | "right";
  /** Receives the trigger props to spread onto a button. */
  children: (props: {
    ref: (el: HTMLButtonElement | null) => void;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    "aria-controls": string;
  }) => ReactNode;
};

/**
 * Lightweight dropdown menu: popover under a trigger, keyboard navigation
 * (Arrow keys, Home/End, Enter, Escape) and click-outside dismissal.
 */
export function Menu({ items, align = "left", children }: Props) {
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const enabled = items.filter((i) => !i.disabled);

  // Open upward when there isn't room below the trigger.
  useEffect(() => {
    if (!open || !triggerRef.current || !listRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const needed = listRef.current.offsetHeight + 12;
    setFlipUp(window.innerHeight - trigger.bottom < needed && trigger.top > needed);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!listRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const focusItem = (index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    if (!buttons || buttons.length === 0) return;
    const i = ((index % buttons.length) + buttons.length) % buttons.length;
    buttons[i].focus();
  };

  const openAndFocus = (index: number) => {
    setOpen(true);
    requestAnimationFrame(() => focusItem(index));
  };

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAndFocus(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAndFocus(enabled.length - 1);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(current + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(current - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(buttons.length - 1);
        break;
      case "Escape":
      case "Tab":
        e.preventDefault();
        close();
        break;
    }
  };

  return (
    <div className="relative inline-block">
      {children({
        ref: (el) => (triggerRef.current = el),
        onClick: () => (open ? close(false) : setOpen(true)),
        onKeyDown: onTriggerKeyDown,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": id,
      })}

      {open && (
        <div
          ref={listRef}
          id={id}
          role="menu"
          onKeyDown={onListKeyDown}
          className={`absolute z-30 min-w-44 rounded-xl border border-line bg-white p-1.5 shadow-xl shadow-slate-900/10 ${
            flipUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${align === "right" ? "right-0" : "left-0"}`}
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.separator && <div className="my-1 h-px bg-line" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger
                    ? "text-red-600 hover:bg-red-50 focus-visible:bg-red-50"
                    : "text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100"
                }`}
              >
                {item.icon && <span className="size-4 shrink-0 text-slate-500">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.selected && (
                  <svg className="size-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const chevron = (
  <svg className="size-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);
