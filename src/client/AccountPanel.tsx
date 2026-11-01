import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { changePasswordFormSchema, newPasswordFormSchema } from "../shared/schemas";
import { api } from "./api";
import { authClient } from "./auth-client";
import { ErrorBox, Field, inputClass, issuesToErrors, primaryButton, SuccessBox } from "./ui";
import type { AuthUser } from "./useAuth";

type Props = { user: AuthUser & { emailVerified: boolean }; onClose: () => void };
type Errors = Partial<Record<"currentPassword" | "newPassword" | "confirm", string>>;

const providerLabel: Record<string, string> = {
  credential: "Email & password",
  google: "Google",
};

export function AccountPanel({ user, onClose }: Props) {
  const queryClient = useQueryClient();
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw new Error(error.message ?? "Failed to load sign-in methods");
      return data;
    },
  });
  const hasPassword = accounts.data?.some((a) => a.providerId === "credential") ?? false;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const savePassword = useMutation({
    mutationFn: async () => {
      if (hasPassword) {
        const { error } = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        });
        if (error) throw new Error(error.message ?? "Failed to change password");
      } else {
        await api.account.setPassword(newPassword);
      }
    },
    onSuccess: () => {
      setSuccess(hasPassword ? "Password changed." : "Password set. You can now sign in with it.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const resendVerification = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.sendVerificationEmail({ email: user.email, callbackURL: "/" });
      if (error) throw new Error(error.message ?? "Failed to send verification email");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    savePassword.reset();
    const parsed = hasPassword
      ? changePasswordFormSchema.safeParse({ currentPassword, newPassword, confirm })
      : newPasswordFormSchema.safeParse({ newPassword, confirm });
    if (!parsed.success) {
      setErrors(issuesToErrors<keyof Errors>(parsed.error.issues));
      return;
    }
    setErrors({});
    savePassword.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-title"
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line px-6 py-4">
          <div className="eyebrow text-slate-500">Account</div>
          <h2 id="account-title" className="mt-0.5 text-lg font-semibold">
            {user.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>{user.email}</span>
            {user.emailVerified ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                Verified
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                Unverified
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-5">
          {!user.emailVerified && (
            <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-sm text-amber-900">
              <p>
                Verify your email to protect your password. Signing in with a magic link on an
                unverified account removes its password.
              </p>
              <button
                type="button"
                onClick={() => resendVerification.mutate()}
                disabled={resendVerification.isPending || resendVerification.isSuccess}
                className="mt-2 text-sm font-medium text-amber-800 underline disabled:opacity-60"
              >
                {resendVerification.isSuccess
                  ? "Verification email sent"
                  : resendVerification.isPending
                    ? "Sending…"
                    : "Send verification email"}
              </button>
              {resendVerification.error && (
                <p className="mt-1 text-xs text-red-600">{resendVerification.error.message}</p>
              )}
            </div>
          )}

          <section>
            <div className="eyebrow mb-2 text-slate-500">Sign-in methods</div>
            {accounts.isPending ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : accounts.error ? (
              <ErrorBox>{accounts.error.message}</ErrorBox>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line text-sm">
                {accounts.data.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2">
                    <span>{providerLabel[a.providerId] ?? a.providerId}</span>
                    <span className="font-mono text-[10px] tracking-wider text-emerald-700 uppercase">Linked</span>
                  </li>
                ))}
                <li className="flex items-center justify-between px-3 py-2">
                  <span>Magic link</span>
                  <span className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">Always available</span>
                </li>
              </ul>
            )}
          </section>

          <section>
            <div className="eyebrow mb-2 text-slate-500">{hasPassword ? "Change password" : "Set a password"}</div>
            {!hasPassword && !accounts.isPending && (
              <p className="mb-3 text-sm text-slate-600">
                Your account has no password yet. Add one to sign in without a link.
              </p>
            )}
            <form className="space-y-3" onSubmit={handleSubmit} noValidate>
              {hasPassword && (
                <Field label="Current password" error={errors.currentPassword}>
                  <input
                    className={inputClass}
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    aria-invalid={errors.currentPassword ? true : undefined}
                  />
                </Field>
              )}
              <Field label="New password" error={errors.newPassword}>
                <input
                  className={inputClass}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  aria-invalid={errors.newPassword ? true : undefined}
                />
              </Field>
              <Field label="Confirm new password" error={errors.confirm}>
                <input
                  className={inputClass}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={errors.confirm ? true : undefined}
                />
              </Field>
              {savePassword.error && <ErrorBox>{savePassword.error.message}</ErrorBox>}
              {success && <SuccessBox>{success}</SuccessBox>}
              <button type="submit" disabled={savePassword.isPending || accounts.isPending} className={primaryButton}>
                {savePassword.isPending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
              </button>
            </form>
          </section>
        </div>

        <div className="flex justify-end border-t border-line bg-slate-50/60 px-6 py-3">
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
