import { Hono } from "hono";
import type { AuthConfig } from "../shared/schemas";
import { account } from "./account";
import { authCapabilities, getAuth } from "./auth";
import { lists } from "./lists";
import type { Env } from "./middleware";

export { ListRoom } from "./room";

const app = new Hono<Env>().basePath("/api");

// API responses are per-user and change often; never let browsers or proxies cache them.
// WebSocket upgrade responses (101) have immutable headers and must be left alone.
app.use("*", async (c, next) => {
  await next();
  if (c.res.status === 101 || c.res.headers.has("Cache-Control")) return;
  c.res = new Response(c.res.body, c.res);
  c.res.headers.set("Cache-Control", "no-store");
});

app.all("/auth/*", (c) => getAuth(c.env).auth.handler(c.req.raw));

const api = app
  .get("/config", (c) => c.json(authCapabilities(c.env) satisfies AuthConfig))
  .route("/account", account)
  .route("/lists", lists);

export type ApiType = typeof api;

export default app;
