# Working agreements for this project

- After any change is implemented and verified (typecheck + local browser/API test passing), deploy to production with `pnpm run deploy` and report the live URL and version ID.
- `pnpm run deploy` runs typecheck → remote D1 migrations → build → `wrangler deploy`, in that order. Do not bypass it.
- New D1 migrations go in `migrations/NNNN_name.sql`; apply locally with `pnpm run db:migrate:local` before testing.
- Local and production use separate D1 databases, Durable Objects and secrets. Nothing local affects prod.
- Cloudflare auth: use the OAuth login (`wrangler login`). If a shell still has stale `CF_API_TOKEN` / `CLOUDFLARE_API_TOKEN` vars, `unset` them first.
