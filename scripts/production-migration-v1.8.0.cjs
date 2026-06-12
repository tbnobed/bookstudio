#!/usr/bin/env node
/**
 * BookStud.io v1.8.0 — Interactive Facility Map
 * Adds the facility_map_rooms table storing SVG floorplan shapes linked to
 * studios / PCR rooms. No floorplan is seeded — fresh deployments start with an
 * empty map that authorized users build via the in-app editor. The
 * `facilityMapSeeded` flag is set so the app never auto-restores a default layout.
 * Idempotent — safe to re-run.
 */
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  });

  console.log('🚀 Starting BookStud.io v1.8.0 Facility Map Migration...');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS facility_map_rooms (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL DEFAULT '',
        shape_type TEXT NOT NULL DEFAULT 'rect',
        x INTEGER NOT NULL DEFAULT 0,
        y INTEGER NOT NULL DEFAULT 0,
        width INTEGER NOT NULL DEFAULT 80,
        height INTEGER NOT NULL DEFAULT 60,
        rx INTEGER NOT NULL DEFAULT 6,
        points TEXT,
        font_size INTEGER NOT NULL DEFAULT 16,
        fill TEXT,
        studio_id INTEGER REFERENCES studios(id) ON DELETE SET NULL,
        pcr_room_id INTEGER REFERENCES pcr_rooms(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_fmr_sort ON facility_map_rooms(sort_order);`);
    console.log('✅ facility_map_rooms table ready');

    // Intentionally NO default floorplan is seeded. Fresh deployments start with
    // an empty map; authorized users build the layout via the in-app editor.
    // Set the facilityMapSeeded flag so the app never auto-restores a default
    // layout at read time (see DatabaseStorage.getFacilityMapRooms).
    await pool.query(
      `INSERT INTO system_settings (key, value) VALUES ('facilityMapSeeded', 'true')
       ON CONFLICT (key) DO NOTHING`,
    );
    console.log('✅ facilityMapSeeded flag set — no default rooms seeded');

    console.log('🎉 v1.8.0 Facility Map migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
