import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { emailTemplates, sendEmail } from "./email";
import type { ListRoom } from "./room";
import * as schema from "./schema";

export type Bindings = {
  DB: D1Database;
  LIST_ROOM: DurableObjectNamespace<ListRoom>;
  ENVIRONMENT: "development" | "production";
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

/** Auth endpoints (relative to /api/auth) that must carry a valid Turnstile token: account creation + anything that sends email to an arbitrary address. */
const CAPTCHA_ENDPOINTS = ["/sign-up/email", "/sign-in/magic-link", "/request-password-reset"];

export function createDb(env: Bindings) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof createDb>;

export async function createPersonalList(db: Db, userId: string) {
  const now = Date.now();
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(schema.list).values({ id, name: "Personal", ownerId: userId, createdAt: now }),
    db.insert(schema.listMember).values({ listId: id, userId, role: "owner", createdAt: now }),
  ]);
  return id;
}

/** Which optional sign-in methods are configured. Exposed to the client via /api/config. */
export function authCapabilities(env: Bindings) {
  const turnstile = Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
  const email = env.ENVIRONMENT !== "production" || Boolean(env.RESEND_API_KEY);
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    magicLink: email,
    passwordReset: email,
    // Site key is public; the client needs it to render the widget.
    turnstileSiteKey: turnstile ? env.TURNSTILE_SITE_KEY! : null,
  };
}

export function createAuth(env: Bindings, db: Db) {
  const caps = authCapabilities(env);

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(env, emailTemplates.resetPassword(user.email, url));
      },
    },
    emailVerification: {
      // Verified emails are what keep a password account safe from being overridden by a
      // later magic-link sign-in (Better Auth strips passwords on *unverified* accounts).
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        // Verification is optional, so never let a mail failure break sign-up.
        await sendEmail(env, emailTemplates.verifyEmail(user.email, url)).catch((err) =>
          console.error("[verify-email] send failed", err),
        );
      },
    },
    socialProviders: caps.google
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID!,
            clientSecret: env.GOOGLE_CLIENT_SECRET!,
            prompt: "select_account",
          },
        }
      : {},
    plugins: [
      ...(caps.turnstileSiteKey
        ? [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: env.TURNSTILE_SECRET_KEY!,
              endpoints: CAPTCHA_ENDPOINTS,
            }),
          ]
        : []),
      magicLink({
        expiresIn: 60 * 15,
        sendMagicLink: async ({ email, url }) => {
          await sendEmail(env, emailTemplates.magicLink(email, url));
        },
      }),
    ],
    session: {
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    databaseHooks: {
      user: {
        create: {
          // Magic-link sign-ups have no name; derive one from the email so the UI never shows a blank.
          before: async (user) => ({
            data: { ...user, name: user.name?.trim() || user.email.split("@")[0] },
          }),
          after: async (user) => {
            await createPersonalList(db, user.id);
          },
        },
      },
    },
    advanced: {
      database: { validateSchema: false },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];

let cached: { db: D1Database; auth: Auth; drizzle: Db } | undefined;

export function getAuth(env: Bindings) {
  if (cached?.db !== env.DB) {
    const drizzleDb = createDb(env);
    cached = { db: env.DB, drizzle: drizzleDb, auth: createAuth(env, drizzleDb) };
  }
  return cached;
}
