#!/usr/bin/env node
/**
 * BookStud.io v1.7.0 — Crew & Freelancer Booking
 * Adds 6 new tables: crew_positions, crew_members, crew_member_positions,
 * crew_templates, crew_template_slots, booking_crew.
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

  console.log('🚀 Starting BookStud.io v1.7.0 Crew Booking Migration...');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crew_positions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'other',
        description TEXT,
        color TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );
    `);
    console.log('✅ crew_positions table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crew_members (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        day_rate_cents INTEGER NOT NULL DEFAULT 0,
        half_day_rate_cents INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_crew_members_email ON crew_members(email);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_crew_members_user_id ON crew_members(user_id);`);
    console.log('✅ crew_members table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crew_member_positions (
        id SERIAL PRIMARY KEY,
        crew_member_id INTEGER NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
        position_id INTEGER NOT NULL REFERENCES crew_positions(id) ON DELETE CASCADE,
        CONSTRAINT crew_member_positions_unique UNIQUE (crew_member_id, position_id)
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cmp_member ON crew_member_positions(crew_member_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cmp_position ON crew_member_positions(position_id);`);
    console.log('✅ crew_member_positions table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crew_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        booking_type_id INTEGER,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ crew_templates table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS crew_template_slots (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES crew_templates(id) ON DELETE CASCADE,
        position_id INTEGER NOT NULL REFERENCES crew_positions(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cts_template ON crew_template_slots(template_id);`);
    console.log('✅ crew_template_slots table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_crew (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        position_id INTEGER NOT NULL REFERENCES crew_positions(id),
        crew_member_id INTEGER REFERENCES crew_members(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'unfilled',
        rate_type TEXT,
        rate_snapshot_cents INTEGER NOT NULL DEFAULT 0,
        response_token TEXT UNIQUE,
        invited_at TIMESTAMP,
        responded_at TIMESTAMP,
        decline_reason TEXT,
        notes TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bc_booking ON booking_crew(booking_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bc_crew_member ON booking_crew(crew_member_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bc_token ON booking_crew(response_token);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bc_status ON booking_crew(status);`);
    console.log('✅ booking_crew table ready');

    // Seed default positions if table is empty
    const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM crew_positions');
    if (parseInt(countRows[0].count, 10) === 0) {
      console.log('Seeding default crew positions...');
      const seeds = [
        ['Director', 'direction', 10],
        ['Associate Director', 'direction', 20],
        ['Producer', 'direction', 30],
        ['Associate Producer', 'direction', 40],
        ['Stage Manager', 'direction', 50],
        ['Production Assistant', 'direction', 60],
        ['Technical Director', 'technical', 110],
        ['Engineer in Charge', 'technical', 120],
        ['Video / Shader (CCU)', 'technical', 130],
        ['Replay / EVS Operator', 'technical', 140],
        ['Streaming / Encoder Operator', 'technical', 150],
        ['Studio Camera Operator', 'camera', 210],
        ['Robotic Camera Operator', 'camera', 220],
        ['Jib / Crane Operator', 'camera', 230],
        ['Camera Utility', 'camera', 240],
        ['A1 — Audio Engineer', 'audio', 310],
        ['A2 — Audio Assistant', 'audio', 320],
        ['Boom Operator', 'audio', 330],
        ['Lighting Director', 'lighting', 410],
        ['Gaffer', 'lighting', 420],
        ['Lighting Board Operator', 'lighting', 430],
        ['Key Grip', 'lighting', 440],
        ['Graphics Operator', 'graphics', 510],
        ['Teleprompter Operator', 'talent', 610],
        ['Hair / Makeup / Wardrobe', 'talent', 620],
      ];
      for (const [name, category, sortOrder] of seeds) {
        await pool.query(
          'INSERT INTO crew_positions (name, category, sort_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
          [name, category, sortOrder]
        );
      }
      console.log(`✅ Seeded ${seeds.length} default crew positions`);
    } else {
      console.log(`✅ ${countRows[0].count} crew positions already present — skipping seed`);
    }

    console.log('🎉 v1.7.0 Crew Booking migration completed successfully!');
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
