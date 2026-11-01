# TaskFlow — Todo app on Cloudflare

A todo app with a dashboard-style UI, deployed as a single Cloudflare Worker.

- **Frontend:** React 19 + Tailwind v4, served as static assets
- **API:** Hono, running in the Worker, with Zod request validation
- **Auth:** Better Auth — email + password, Google sign-in, and passwordless magic links (emails via Resend); sessions stored in D1
- **Lists & sharing:** every user gets a "Personal" list; owners can create more lists and invite other accounts by email as editors
- **Realtime:** one Durable Object per list fans out "changed" events over WebSockets; clients refetch via React Query, so D1 stays the single source of truth
- **Data:** Cloudflare D1 (SQLite) via Drizzle ORM
- **Client data layer:** TanStack React Query with optimistic updates
- **Type safety:** Zod schemas in `src/shared/` are used by both the API and the UI; the client calls the API through Hono's typed RPC client (`hc`)

## Layout

```
src/
  shared/schemas.ts    Zod schemas + types shared by server and client
  worker/index.ts      Hono entry: mounts /api/auth/* and /api/lists, exports the Durable Object
  worker/lists.ts      List, member, todo and WebSocket routes
  worker/middleware.ts requireSession / requireList(role) and notifyRoom()
  worker/room.ts       ListRoom Durable Object (WebSocket hibernation, broadcast only)
  worker/auth.ts       Better Auth instance (Drizzle + D1 adapter) + Personal list hook
  worker/schema.ts     Drizzle schema (auth tables, list, list_member, todos)
  client/              React app (App, AuthPage, Sidebar, Header, TaskBoard, Summary,
                       SharePanel, TodoItem, hooks, useListRoom, useAuth, api)
migrations/            D1 migrations
wrangler.jsonc         Worker + D1 + static assets config
```

## Local development

```sh
pnpm install
cp .dev.vars.example .dev.vars   # then set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
pnpm run db:migrate:local        # creates the tables in a local D1
pnpm run dev                     # http://localhost:5173 (Vite + Workers runtime)
```

## Sign-in methods

| Method | Config | Notes |
| --- | --- | --- |
| Email + password | none | always on |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Button appears only when both are set. Redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`. Same-email accounts are linked automatically. |
| Magic link | `RESEND_API_KEY`, optional `MAIL_FROM` | In development without a key, the link is printed to the dev-server log. In production the option is hidden until a key is set. |

**Account recovery & verification**

- "Forgot password?" on the sign-in page emails a reset link (1 h, single use) that opens `/reset-password`.
- Sign-up sends a verification email (optional to click, but recommended — see below). Clicking it verifies and signs the user in.
- Signed-in users can open **Account** (click your name in the sidebar) to set a password (Google / magic-link accounts have none), change it, or resend verification.
- ⚠️ Better Auth security rule: signing in with a magic link on an account whose email is **unverified** deletes that account's password (prevents pre-registration hijacks). Verified accounts are unaffected. Affected users recover via "Forgot password?" or Account → Set a password.

**Bot protection:** Cloudflare Turnstile (`TURNSTILE_SITE_KEY` var + `TURNSTILE_SECRET_KEY` secret) guards account creation, magic-link and password-reset requests via Better Auth's `captcha` plugin. The widget is "managed" — invisible for most visitors, a checkbox only when a challenge is needed. Locally, the official test keys in `.dev.vars` always pass.

`GET /api/config` reports which optional methods are enabled (and the Turnstile site key); the auth page reads it.

## Deploy

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create todo-db        # copy the database_id into wrangler.jsonc
pnpm exec wrangler secret put BETTER_AUTH_SECRET   # paste output of: openssl rand -base64 32
# optional
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put MAIL_FROM            # e.g. "TaskFlow <login@yourdomain.com>"
pnpm run deploy                                    # typecheck → migrate → build → deploy
```

`BETTER_AUTH_URL` and `ENVIRONMENT` are plain vars in `wrangler.jsonc`; update `BETTER_AUTH_URL` if you add a custom domain.

## API

All `/api/lists` routes require a signed-in session (401) and list membership (404 if not a member). Owner-only routes return 403 for editors. Auth endpoints live under `/api/auth/*` (see Better Auth docs).

| Method | Path                                   | Who    | Body                       |
| ------ | -------------------------------------- | ------ | -------------------------- |
| GET    | `/api/lists`                           | any    | —                          |
| POST   | `/api/lists`                           | any    | `{ name }`                 |
| PATCH  | `/api/lists/:listId`                   | owner  | `{ name }`                 |
| DELETE | `/api/lists/:listId`                   | owner  | —                          |
| GET    | `/api/lists/:listId/members`           | member | —                          |
| POST   | `/api/lists/:listId/members`           | owner  | `{ email }`                |
| DELETE | `/api/lists/:listId/members/:userId`   | owner, or self to leave | —         |
| GET    | `/api/lists/:listId/todos`             | member | —                          |
| POST   | `/api/lists/:listId/todos`             | member | `{ title }`                |
| PATCH  | `/api/lists/:listId/todos/:todoId`     | member | `{ title?, completed? }`   |
| DELETE | `/api/lists/:listId/todos/:todoId`     | member | —                          |
| DELETE | `/api/lists/:listId/todos`             | member | — (clears completed)       |
| GET    | `/api/lists/:listId/ws`                | member | WebSocket upgrade          |

WebSocket messages are `{ type: "todos" | "members" | "list", listId }` — a hint to refetch, never data.
