---
name: Field-level access control (sensitive fields)
description: When hiding sensitive fields by role, sanitize EVERY response path, not just the obvious GET.
---

When a requirement is "only roles X may see field F" (e.g. crew pay rates: `dayRateCents`, `halfDayRateCents`, `rateSnapshotCents`, `rateType`, cost `totals.cents`), gating the UI and the primary list GET is NOT enough. The same sensitive field leaks through many other authenticated response paths.

**Why:** Each architect pass in this codebase found a *different* surviving leak — the fix is only complete when every endpoint that can return the entity (or a row embedding it) is sanitized. UI gating does nothing for someone reading the network response.

**How to apply:** Enumerate and sanitize ALL of these, not just GET-by-list:
- list + by-id GETs
- create (POST) and update (PATCH) **response bodies** (they echo the saved row)
- mutation **error/conflict payloads** (e.g. 409 returns conflicting rows that carry the field)
- related/derived query endpoints (e.g. `/:id/upcoming`, template-apply, invite) — anything whose storage query does `bc.*` / `.returning()` pulls the field in
- also strip the field from **incoming** create/update bodies for non-privileged roles (default-to-0 on create, delete-key on patch to preserve existing) so they can't write/zero it

Use shared helpers (e.g. `stripMemberRates`, `stripSlotRates`) + a single `canSeeRoles(req)` predicate, and keep the client and server role lists identical to avoid drift. Pattern: `res.json(canSee(req) ? obj : strip(obj))`, mapping for arrays.
