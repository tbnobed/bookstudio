#!/usr/bin/env node
/**
 * BookStud.io v1.8.3 — Centerable studio names on the facility map
 *
 * Adds optional `label_x` and `label_y` columns to `facility_map_rooms` so a
 * room's name can be positioned (centered or dragged) independently of the
 * shape geometry. NULL x/y means the label auto-centers on the shape.
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

  console.log("🚀 Starting BookStud.io v1.8.3 Label Position migration...");
  try {
    await pool.query(`ALTER TABLE facility_map_rooms ADD COLUMN IF NOT EXISTS label_x DOUBLE PRECISION`);
    await pool.query(`ALTER TABLE facility_map_rooms ADD COLUMN IF NOT EXISTS label_y DOUBLE PRECISION`);
    console.log("✅ facility_map_rooms label_x/label_y columns ready");
    console.log("🎉 v1.8.3 Label Position migration completed successfully!");
  } catch (err) {
    console.error("❌ v1.8.3 migration failed:", err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
