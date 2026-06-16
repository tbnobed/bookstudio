---
name: SSO role sync (Authentik)
description: How SSO role assignment reconciles Authentik groups with manual in-app role edits
---

# SSO role sync must be delta-based, not force-overwrite

On Authentik SSO login, do NOT blindly overwrite the user's role with the
group-derived role every login — that reverts any manual permission change made
inside the app (users not in a mapped group keep dropping to the default).

**Rule:** keep a per-user baseline of the last group-derived role
(`users.sso_synced_role`). On login, only re-apply the group role when it
*changed* since last login (group membership changed in Authentik); otherwise
leave the role alone so in-app edits persist. NULL baseline (linked-by-email /
pre-existing SSO accounts) records the baseline once WITHOUT changing the role,
so the transition login never reverts anyone.

**Why:** "make it work both ways" — group changes must propagate AND manual
in-app role edits must stick. A force-sync satisfies only the first.

**How to apply:** role-resolution lives in `server/auth.ts` SSO callback
(`resolveRole` maps groups→role; no-group default is `viewer`). Group mapping
env vars: `OIDC_ADMIN_GROUP`, `OIDC_SITE_MANAGER_GROUP`, `OIDC_ENGINEER_GROUP`.
Schema/migration changes need the triple: `shared/schema.ts`, startup
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `server/routes.ts`, and a
`scripts/production-migration-vX.cjs` registered in BOTH `docker-compose.yml`
init chain and `Dockerfile`.
