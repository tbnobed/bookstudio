---
name: db:push interactive drift prompts
description: Why `npm run db:push` hangs/prompts on this repo and what to do instead
---

`npm run db:push` (drizzle-kit) on this repo stops at an interactive prompt about
pre-existing schema drift unrelated to your change (e.g. it offers to truncate
`booking_types` to add a unique constraint). Piping `echo y` is dangerous — it
could answer "truncate".

**Why:** the live DB has drifted from `shared/schema.ts` in spots, so push tries
to reconcile everything at once, not just your new table.

**How to apply:** for a brand-new isolated table, skip db:push. Either rely on the
server startup `CREATE TABLE IF NOT EXISTS` blocks in `server/routes.ts` (the app
self-heals new tables on boot), or run a direct `psql "$DATABASE_URL" -c "CREATE
TABLE ..."`. Match the production migration script + docker-compose db-init chain
for prod parity. Never blindly auto-confirm db:push prompts here.
