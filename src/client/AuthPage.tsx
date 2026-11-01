import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { emailSchema, signInSchema, signUpSchema } from "../shared/schemas";
import { api } from "./api";
import { authClient, signIn, signUp } from "./auth-client";
import { Turnstile, type TurnstileHandle } from "./Turnstile";
import { ErrorBox, Field, inputClass, issuesToErrors, LinkButton, primaryButton, SuccessBox } from "./ui";

type Mode = "sign-in" | "sign-up" | "magic-link" | "forgot";
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

const copy: Record<Mode, { eyebrow: string; title: string; submit: string }> = {
  "sign-in": { eyebrow: "Welcome back", title: "Sign in to TaskFlow", submit: "Sign in" },
  "sign-up": { eyebrow: "Get started", title: "Create your account", submit: "Create account" },
  "magic-link": { eyebrow: "Passwordless", title: "Email me a sign-in link", submit: "Send link" },
  forgot: { eyebrow: "Account recovery", title: "Reset your password", submit: "Send reset link" },
};

/** Messages forwarded via query string by Better Auth callbacks or our own pages. */
function readFlash(): { error: string | null; notice: string | null } {
  const params = new URLSearchParams(location.search);
  const code = params.get("error");
  const notice = params.get("notice");
  if (!code && !notice) return { error: null, notice: null };
  history.replaceState(null, "", location.pathname);
  const errors: Record<string, string> = {
    INVALID_TOKEN: "That link is invalid or has already been used.",
    EXPIRED_TOKEN: "That link has expired. Request a new one below.",
    account_not_linked: "This email is already registered with a different sign-in method.",
  };
  const notices: Record<string, string> = {
    "password-reset": "Your password has been updated. Sign in with it below.",
  };
  return {
    error: code ? (errors[code] ?? "Sign-in failed. Please try again.") : null,
    notice: notice ? (notices[notice] ?? null) : null,
  };
}

export function AuthPage() {
  const flash = useRef(readFlash()).current;
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(flash.error);
  const [notice, setNotice] = useState<string | null>(flash.notice);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<{ email: string; kind: "magic-link" | "forgot" } | null>(null);

  const config = useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: Infinity, retry: 3 });
  const googleEnabled = config.data?.google ?? false;
  const magicEnabled = config.data?.magicLink ?? false;
  const resetEnabled = config.data?.passwordReset ?? false;
  const siteKey = config.data?.turnstileSiteKey ?? null;

  // Bot protection applies to account creation and anything that emails an arbitrary address.
  const captchaRequired = siteKey !== null && mode !== "sign-in";
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const captchaHeaders = () =>
    captchaToken ? { headers: { "x-captcha-response": captchaToken } } : {};

  const switchMode = (next: Mode) => {
    setMode(next);
    setFieldErrors({});
    setServerError(null);
    setNotice(null);
    setSentTo(null);
    setCaptchaToken(null);
  };

  const failWithCaptchaReset = (message: string) => {
    setServerError(message);
    turnstileRef.current?.reset(); // tokens are single-use
  };

  const handleGoogle = async () => {
    setServerError(null);
    setSubmitting(true);
    const result = await signIn.social({ provider: "google", callbackURL: "/" });
    if (result.error) {
      setServerError(result.error.message ?? "Google sign-in failed.");
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setNotice(null);

    if (captchaRequired && !captchaToken) {
      setServerError("Please complete the verification check first.");
      return;
    }

    if (mode === "magic-link" || mode === "forgot") {
      const parsed = emailSchema.safeParse(email.trim());
      if (!parsed.success) {
        setFieldErrors({ email: parsed.error.issues[0]?.message });
        return;
      }
      setFieldErrors({});
      setSubmitting(true);
      const result =
        mode === "magic-link"
          ? await authClient.signIn.magicLink({
              email: parsed.data,
              callbackURL: "/",
              errorCallbackURL: "/",
              fetchOptions: captchaHeaders(),
            })
          : await authClient.requestPasswordReset({
              email: parsed.data,
              redirectTo: "/reset-password",
              fetchOptions: captchaHeaders(),
            });
      setSubmitting(false);
      if (result.error) failWithCaptchaReset(result.error.message ?? "Couldn't send the email. Please try again.");
      else setSentTo({ email: parsed.data, kind: mode });
      return;
    }

    const parsed =
      mode === "sign-in"
        ? signInSchema.safeParse({ email, password })
        : signUpSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setFieldErrors(issuesToErrors<keyof FieldErrors>(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    const result =
      mode === "sign-in"
        ? await signIn.email(parsed.data)
        : await signUp.email({
            ...(parsed.data as { name: string; email: string; password: string }),
            fetchOptions: captchaHeaders(),
          });
    setSubmitting(false);
    if (result.error) failWithCaptchaReset(result.error.message ?? "Something went wrong. Please try again.");
  };

  const showGoogle = googleEnabled && (mode === "sign-in" || mode === "sign-up");

  return (
    <div className="flex min-h-dvh">
      <BrandPanel />

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-6 sm:py-12">
        <div className="w-full max-w-sm">
          <div className="eyebrow text-slate-500">{copy[mode].eyebrow}</div>
          <h1 className="mt-1 text-2xl font-semibold">{copy[mode].title}</h1>

          {sentTo ? (
            <SentCard
              email={sentTo.email}
              kind={sentTo.kind}
              onReset={() => {
                setSentTo(null);
                setCaptchaToken(null);
              }}
            />
          ) : (
            <>
              {showGoogle && (
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  <Divider>or</Divider>
                </div>
              )}

              <form className={`${showGoogle ? "" : "mt-8"} space-y-4`} onSubmit={handleSubmit} noValidate>
                {mode === "forgot" && (
                  <p className="text-sm text-slate-600">
                    Enter your email and we'll send you a link to choose a new password.
                  </p>
                )}
                {mode === "sign-up" && (
                  <Field label="Name" error={fieldErrors.name}>
                    <input
                      className={inputClass}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      autoComplete="name"
                      aria-invalid={fieldErrors.name ? true : undefined}
                    />
                  </Field>
                )}
                <Field label="Email" error={fieldErrors.email}>
                  <input
                    className={inputClass}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={fieldErrors.email ? true : undefined}
                  />
                </Field>
                {(mode === "sign-in" || mode === "sign-up") && (
                  <Field label="Password" error={fieldErrors.password}>
                    <input
                      className={inputClass}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "sign-up" ? "At least 8 characters" : "••••••••"}
                      autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                      aria-invalid={fieldErrors.password ? true : undefined}
                    />
                    {mode === "sign-in" && resetEnabled && (
                      <span className="mt-1.5 block text-right text-xs">
                        <LinkButton onClick={() => switchMode("forgot")}>Forgot password?</LinkButton>
                      </span>
                    )}
                  </Field>
                )}

                {captchaRequired && siteKey && (
                  <Turnstile key={mode} ref={turnstileRef} siteKey={siteKey} onToken={setCaptchaToken} />
                )}

                {notice && <SuccessBox>{notice}</SuccessBox>}
                {serverError && <ErrorBox>{serverError}</ErrorBox>}

                <button
                  type="submit"
                  disabled={submitting || (captchaRequired && !captchaToken)}
                  className={primaryButton}
                >
                  {submitting ? "Please wait…" : copy[mode].submit}
                </button>
              </form>

              {magicEnabled && mode === "sign-in" && (
                <button
                  type="button"
                  onClick={() => switchMode("magic-link")}
                  className="mt-3 w-full text-center text-sm font-medium text-brand-600 hover:underline"
                >
                  Email me a sign-in link instead
                </button>
              )}
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "sign-in" ? (
              <>
                New here? <LinkButton onClick={() => switchMode("sign-up")}>Create an account</LinkButton>
              </>
            ) : (
              <>
                {mode === "sign-up" ? "Already have an account? " : "Back to "}
                <LinkButton onClick={() => switchMode("sign-in")}>Sign in</LinkButton>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}

function SentCard({
  email,
  kind,
  onReset,
}: {
  email: string;
  kind: "magic-link" | "forgot";
  onReset: () => void;
}) {
  return (
    <div className="mt-8 rounded-xl border border-line bg-white p-6">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-600">
        <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h2 className="font-semibold">Check your email</h2>
      <p className="mt-1 text-sm text-slate-600">
        {kind === "magic-link" ? "We sent a sign-in link to " : "If an account exists for "}
        <span className="font-medium text-slate-900">{email}</span>
        {kind === "magic-link" ? ". It expires in 15 minutes." : ", we sent a password reset link. It expires in 1 hour."}
      </p>
      <button type="button" onClick={onReset} className="mt-4 text-sm font-medium text-brand-600 hover:underline">
        Use a different email
      </button>
    </div>
  );
}

export function BrandPanel() {
  return (
    <aside className="hidden w-[42%] flex-col justify-between bg-gradient-to-br from-ink-950 via-ink-900 to-ink-800 p-10 text-white lg:flex">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-brand-500 font-bold text-ink-950">
          T
        </div>
        <div className="font-semibold">
          Task<span className="text-brand-400">Flow</span>
        </div>
      </div>
      <div>
        <div className="eyebrow text-brand-300">Your tasks · Anywhere</div>
        <p className="mt-3 text-3xl leading-snug font-semibold">
          A calm place to track what matters, <span className="text-accent-400">synced</span> to every
          device.
        </p>
        <p className="mt-4 text-sm text-slate-300">Running on Cloudflare Workers with Hono, React and D1.</p>
      </div>
      <div className="font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase">
        Secured by Better Auth
      </div>
    </aside>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
      <div className="h-px flex-1 bg-line" />
      {children}
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 01-2.4 3.63v3h3.87c2.26-2.09 3.55-5.17 3.55-8.87z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0012 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 014.89 12c0-.8.14-1.57.38-2.29V6.62H1.29A12 12 0 000 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 001.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}
