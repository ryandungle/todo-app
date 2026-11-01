import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { setPasswordSchema } from "../shared/schemas";
import { getAuth } from "./auth";
import { requireSession, type Env } from "./middleware";

export const account = new Hono<Env>()
  .use("*", requireSession)
  // Lets users who signed up via Google or magic link add a password.
  // Better Auth only exposes setPassword server-side; users who already have a
  // password must use /api/auth/change-password (which checks the current one).
  .post("/password", zValidator("json", setPasswordSchema), async (c) => {
    const { auth } = getAuth(c.env);
    const { newPassword } = c.req.valid("json");
    try {
      await auth.api.setPassword({ body: { newPassword }, headers: c.req.raw.headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to set password";
      // Better Auth throws when a credential already exists.
      return c.json({ error: message }, 400);
    }
    return c.json({ ok: true });
  });
