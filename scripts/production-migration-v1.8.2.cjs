#!/usr/bin/env node
/**
 * BookStud.io v1.8.2 — Studio photo pins on the facility map
 *
 * Adds `x` and `y` columns to the existing `studio_photos` table so a photo can
 * be dropped as a pin at an exact spot on the facility map (SVG coordinate
 * space 0..680 x 0..470). Each pin stays tied to its studio (studio_id FK).
 * Photos with NULL x/y are legacy (non-positioned) and ignored by the map.
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

  console.log("🚀 Starting BookStud.io v1.8.2 Studio Photo Pins migration...");
  try {
    await pool.query(`ALTER TABLE studio_photos ADD COLUMN IF NOT EXISTS x DOUBLE PRECISION`);
    await pool.query(`ALTER TABLE studio_photos ADD COLUMN IF NOT EXISTS y DOUBLE PRECISION`);
    console.log("✅ studio_photos x/y pin columns ready");
    console.log("🎉 v1.8.2 Studio Photo Pins migration completed successfully!");
  } catch (err) {
    console.error("❌ v1.8.2 migration failed:", err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
