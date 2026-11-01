import { useState, type FormEvent } from "react";
import { newPasswordFormSchema } from "../shared/schemas";
import { authClient } from "./auth-client";
import { BrandPanel } from "./AuthPage";
import { ErrorBox, Field, inputClass, issuesToErrors, primaryButton } from "./ui";

type Errors = Partial<Record<"newPassword" | "confirm", string>>;

export function ResetPasswordPage() {
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const linkError = params.get("error");

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const backToSignIn = (notice?: string) => {
    location.assign(notice ? `/?notice=${notice}` : "/");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const parsed = newPasswordFormSchema.safeParse({ newPassword, confirm });
    if (!parsed.success) {
      setErrors(issuesToErrors<keyof Errors>(parsed.error.issues));
      return;
    }
    setErrors({});
    setServerError(null);
    setSubmitting(true);
    const result = await authClient.resetPassword({ newPassword: parsed.data.newPassword, token });
    setSubmitting(false);
    if (result.error) {
      setServerError(result.error.message ?? "Couldn't reset the password. The link may have expired.");
      return;
    }
    backToSignIn("password-reset");
  };

  const invalid = !token || linkError;

  return (
    <div className="flex min-h-dvh">
      <BrandPanel />
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-6 sm:py-12">
        <div className="w-full max-w-sm">
          <div className="eyebrow text-slate-500">Account recovery</div>
          <h1 className="mt-1 text-2xl font-semibold">Choose a new password</h1>

          {invalid ? (
            <div className="mt-8 space-y-4">
              <ErrorBox>This reset link is invalid or has expired. Request a new one from the sign-in page.</ErrorBox>
              <button type="button" onClick={() => backToSignIn()} className={primaryButton}>
                Back to sign in
              </button>
            </div>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
              <Field label="New password" error={errors.newPassword}>
                <input
                  className={inputClass}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  autoFocus
                  aria-invalid={errors.newPassword ? true : undefined}
                />
              </Field>
              <Field label="Confirm password" error={errors.confirm}>
                <input
                  className={inputClass}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={errors.confirm ? true : undefined}
                />
              </Field>
              {serverError && <ErrorBox>{serverError}</ErrorBox>}
              <button type="submit" disabled={submitting} className={primaryButton}>
                {submitting ? "Please wait…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
