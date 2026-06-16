#!/usr/bin/env node
/**
 * BookStud.io v1.8.4 — Two-way SSO role sync
 *
 * Adds a nullable `sso_synced_role` column to `users`. It records the role last
 * derived from the user's Authentik groups, so on each SSO login we can:
 *   - apply a NEW group-derived role when the Authentik group membership changed,
 *   - but otherwise leave the in-app role untouched (manual permission edits stick).
 *
 * NULL means "no baseline recorded yet" — on the next SSO login we record the
 * current group role as the baseline WITHOUT overwriting the user's current role.
 *
 * Idempotent — safe to run multiple times.
 */
const { Pool } = require("pg");

async function migrate() {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  console.log("🚀 Starting BookStud.io v1.8.4 SSO role-sync migration...");
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_synced_role TEXT`);
    console.log("✅ users.sso_synced_role column ready");
    console.log("🎉 v1.8.4 SSO role-sync migration completed successfully!");
  } catch (err) {
    console.error("❌ v1.8.4 migration failed:", err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
