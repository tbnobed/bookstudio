const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  console.log('🚀 Starting BookStud.io v1.5.7 Booking-Asset Planning Migration...');

  try {
    await pool.query('BEGIN');

    // ── Verify prerequisite tables exist ─────────────────────────────────────
    const bookingsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bookings'
      );
    `);
    const assetsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'assets'
      );
    `);

    if (!bookingsCheck.rows[0].exists) {
      console.log('⚠️  bookings table not found — skipping (run consolidated migration first)');
    } else if (!assetsCheck.rows[0].exists) {
      console.log('⚠️  assets table not found — skipping (run v1.5.4 migration first)');
    } else {
      // ── booking_assets table ──────────────────────────────────────────────
      await pool.query(`
        CREATE TABLE IF NOT EXISTS booking_assets (
          id            SERIAL PRIMARY KEY,
          booking_id    INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          asset_id      INTEGER NOT NULL REFERENCES assets(id)   ON DELETE CASCADE,
          added_by      INTEGER REFERENCES users(id),
          added_at      TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (booking_id, asset_id)
        );
      `);
      console.log('✅ booking_assets table created (or already exists)');

      // ── Indexes ───────────────────────────────────────────────────────────
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_booking_assets_booking_id
        ON booking_assets(booking_id);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_booking_assets_asset_id
        ON booking_assets(asset_id);
      `);
      console.log('✅ Indexes on booking_assets created');
    }

    // ── Audit log entry ───────────────────────────────────────────────────────
    const auditExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
      );
    `);
    if (auditExists.rows[0].exists) {
      await pool.query(`
        INSERT INTO audit_logs (action, entity_type, details, user_id, timestamp)
        VALUES (
          'SYSTEM_MIGRATION',
          'assets_system',
          '{"message":"Booking-asset planning migration v1.5.7 completed. Created booking_assets table for informational gear planning per production. Checkout from Assets page with a booking selected auto-adds to the plan."}'::json,
          1,
          CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Audit log entry added');
    }

    await pool.query('COMMIT');
    console.log('🎉 Booking-Asset Planning Migration v1.5.7 completed successfully!');

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
