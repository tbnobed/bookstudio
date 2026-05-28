---
name: No-auth token endpoints
description: Rules for public token-signed routes (invite Accept/Decline, password reset, calendar sync, etc.) — what must invalidate the token and what must never appear in the response.
---

# Rule

Any public, no-auth endpoint keyed by an opaque token must:
1. **Rotate the token on every re-issue** — never reuse the same token on a re-invite/resend. Generate a fresh one and overwrite the stored value.
2. **Clear/rotate the token on any change to the principal it identifies** — e.g. if a "crew slot" is reassigned to a different person, null the token and reset the invite/response state so the prior recipient's link is dead.
3. **Never include the token in any GET response payload** — strip it server-side. The link itself already carries it; echoing it in JSON widens exposure to logs, share-screens, and client-side history.
4. **Sanitize related fields** — for a freelancer/contact-style payload, only return what the recipient needs to make the decision (name, position, booking time, rate). Do not return internal FKs, creator IDs, or other slots.
5. **Block status-change re-entry** — once `confirmed` or `declined`, POST attempts must return a 409 with the current status, not silently overwrite.

# Why

A token reuse bug in v1.7.0 crew invites would have let a previously-invited freelancer accept/decline a booking that had been reassigned to someone else. The token was being reused across `(re)invite` calls and was not cleared on reassignment, so the original email link kept working. Classic "the link in the email still works after the slot was reassigned" class of bug.

# How to apply

When adding or reviewing any route of the shape `GET|POST /api/<feature>/respond/:token` (or `/reset-password/:token`, `/calendar/:token.ics`, etc.):
- The mutation path that produces/refreshes the token must always call `generateToken()` — no `existing || generateToken()` shortcut.
- Any update path that changes "who this token represents" (assignee, target user) must null the token and any `invited_at`/`responded_at`/`decline_reason` columns in the same write.
- The public GET handler should explicitly destructure-and-omit the token field before responding.
