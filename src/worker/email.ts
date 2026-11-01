import type { Bindings } from "./auth";

type Email = {
  to: string;
  subject: string;
  eyebrow: string;
  heading: string;
  intro: string;
  buttonLabel: string;
  url: string;
};

const DEFAULT_FROM = "TaskFlow <onboarding@resend.dev>";

export const emailTemplates = {
  magicLink: (to: string, url: string): Email => ({
    to,
    url,
    subject: "Your TaskFlow sign-in link",
    eyebrow: "Sign in",
    heading: "Your sign-in link is ready",
    intro: "Click the button below to sign in to TaskFlow. This link expires in 15 minutes and can only be used once.",
    buttonLabel: "Sign in to TaskFlow",
  }),
  resetPassword: (to: string, url: string): Email => ({
    to,
    url,
    subject: "Reset your TaskFlow password",
    eyebrow: "Password reset",
    heading: "Choose a new password",
    intro: "We received a request to reset the password for this account. Click below to pick a new one. The link expires in 1 hour.",
    buttonLabel: "Reset password",
  }),
  verifyEmail: (to: string, url: string): Email => ({
    to,
    url,
    subject: "Verify your TaskFlow email",
    eyebrow: "Verify email",
    heading: "Confirm it's really you",
    intro: "Verifying your email keeps your account secure and lets you recover it if you ever forget your password.",
    buttonLabel: "Verify email",
  }),
};

/**
 * Sends a transactional email through Resend. Without an API key in development
 * the link is logged instead so flows can be exercised locally.
 */
export async function sendEmail(env: Bindings, email: Email) {
  const dev = env.ENVIRONMENT !== "production";

  // In development the link is always logged so flows can be tested without a mailbox.
  if (dev) console.log(`\n[email:${email.eyebrow}] for ${email.to}:\n${email.url}\n`);

  if (!env.RESEND_API_KEY) {
    if (!dev) throw new Error("Email is not configured (RESEND_API_KEY missing)");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM ?? DEFAULT_FROM,
      to: [email.to],
      subject: email.subject,
      text: `${email.heading}\n\n${email.intro}\n\n${email.url}\n\nIf you didn't request this, you can ignore this email.`,
      html: renderHtml(email),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[email] Resend error", res.status, body);
    // Dev addresses like example.com are rejected by Resend; the logged link is enough locally.
    if (!dev) throw new Error("Failed to send email");
  }
}

function renderHtml({ eyebrow, heading, intro, buttonLabel, url }: Email) {
  return `
<!doctype html>
<html>
  <body style="margin:0;background:#f4f6f5;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e8e6;border-radius:12px;overflow:hidden">
          <tr><td style="background:#06201b;padding:20px 28px;color:#ffffff;font-weight:600;font-size:16px">
            Task<span style="color:#2dd4bf">Flow</span>
          </td></tr>
          <tr><td style="padding:28px">
            <p style="margin:0 0 8px;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#64748b">${eyebrow}</p>
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${heading}</h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569">${intro}</p>
            <a href="${url}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${buttonLabel}</a>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8">If the button doesn't work, copy this URL into your browser:<br><a href="${url}" style="color:#0d9488;word-break:break-all">${url}</a></p>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">If you didn't request this, you can safely ignore this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
