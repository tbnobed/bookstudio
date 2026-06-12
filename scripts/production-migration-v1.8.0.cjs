#!/usr/bin/env node
/**
 * BookStud.io v1.8.0 — Interactive Facility Map
 * Adds the facility_map_rooms table storing SVG floorplan shapes linked to
 * studios / PCR rooms. Seeds the default OBTV floorplan when the table is empty.
 * Idempotent — safe to re-run.
 */
const { Pool } = require('pg');

const DEFAULT_FACILITY_MAP = [
  ['AB', 'polygon', 0, 0, 0, 0, 0, '24,32 150,32 124,90 24,90', 18, 10],
  ['CD', 'polygon', 0, 0, 0, 0, 0, '60,128 136,128 136,100 196,100 196,232 60,232', 17, 20],
  ['Q', 'rect', 208, 124, 34, 34, 5, null, 13, 30],
  ['P', 'rect', 208, 164, 34, 34, 5, null, 13, 40],
  ['O', 'rect', 208, 204, 34, 34, 5, null, 13, 50],
  ['W', 'rect', 60, 248, 44, 44, 6, null, 14, 60],
  ['X', 'rect', 112, 248, 44, 44, 6, null, 14, 70],
  ['Y', 'rect', 164, 248, 44, 44, 6, null, 14, 80],
  ['Z', 'rect', 216, 248, 44, 44, 6, null, 14, 90],
  ['E', 'rect', 80, 308, 130, 150, 8, null, 18, 100],
  ['F', 'rect', 330, 40, 130, 92, 8, null, 18, 110],
  ['G', 'polygon', 0, 0, 0, 0, 0, '330,160 460,160 460,236 372,236 372,212 330,212', 18, 120],
  ['H', 'polygon', 0, 0, 0, 0, 0, '510,40 626,40 626,230 580,230 580,160 510,160', 18, 130],
  ['K', 'polygon', 0, 0, 0, 0, 0, '524,262 636,262 636,278 652,278 652,344 524,344', 18, 140],
  ['L', 'rect', 540, 372, 86, 86, 8, null, 16, 150],
];

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

    const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM facility_map_rooms');
    if (parseInt(countRows[0].count, 10) === 0) {
      console.log('Seeding default OBTV floorplan...');
      for (const r of DEFAULT_FACILITY_MAP) {
        await pool.query(
          `INSERT INTO facility_map_rooms
            (label, shape_type, x, y, width, height, rx, points, font_size, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          r
        );
      }
      console.log(`✅ Seeded ${DEFAULT_FACILITY_MAP.length} default rooms`);
    } else {
      console.log(`✅ ${countRows[0].count} map rooms already present — skipping seed`);
    }

    // Mark the map as seeded so an intentionally emptied layout is never
    // auto-restored at read time.
    await pool.query(
      `INSERT INTO system_settings (key, value) VALUES ('facilityMapSeeded', 'true')
       ON CONFLICT (key) DO NOTHING`,
    );
    console.log('✅ facilityMapSeeded flag set');

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
