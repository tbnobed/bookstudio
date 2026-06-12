#!/usr/bin/env node
/**
 * BookStud.io v1.8.1 — Studio reference photos
 *
 * Adds the `studio_photos` table for storing reference photos of each studio
 * taken from different angles (compressed base64 JPEG data URLs). Photos are
 * managed from the facility Map view by clicking a studio-linked room.
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

  console.log("🚀 Starting BookStud.io v1.8.1 Studio Photos migration...");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS studio_photos (
        id          SERIAL PRIMARY KEY,
        studio_id   INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
        photo_data  TEXT    NOT NULL,
        caption     TEXT,
        uploaded_by INTEGER NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT now()
      )
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_studio_photos_studio ON studio_photos(studio_id)`,
    );
    console.log("✅ studio_photos table ready");
    console.log("🎉 v1.8.1 Studio Photos migration completed successfully!");
  } catch (err) {
    console.error("❌ v1.8.1 migration failed:", err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
