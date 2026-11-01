import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 aria-invalid:border-red-400";

export const primaryButton =
  "w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60";

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>
  );
}

export function SuccessBox({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      {children}
    </p>
  );
}

export function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="font-medium text-brand-600 hover:underline" onClick={onClick}>
      {children}
    </button>
  );
}

/** Collects the first Zod issue message per field. */
export function issuesToErrors<K extends string>(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0] as K | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
