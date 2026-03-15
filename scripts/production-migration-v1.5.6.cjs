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

  console.log('🚀 Starting BookStud.io v1.5.6 Decommission Migration...');

  try {
    await pool.query('BEGIN');

    // ── decommission_reason column on assets ──────────────────────────────────
    const assetsExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'assets'
      );
    `);

    if (!assetsExists.rows[0].exists) {
      console.log('⚠️  assets table not found — skipping (run v1.5.4 migration first)');
    } else {
      await pool.query(`
        ALTER TABLE assets
        ADD COLUMN IF NOT EXISTS decommission_reason TEXT;
      `);
      console.log('✅ decommission_reason column added to assets table');

      // Index for quick look-up of decommissioned assets
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_assets_decommission_reason
        ON assets(decommission_reason)
        WHERE decommission_reason IS NOT NULL;
      `);
      console.log('✅ Partial index on decommission_reason created');
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
          '{"message":"Decommission migration v1.5.6 completed. Added decommission_reason column to assets table with partial index."}'::json,
          1,
          CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Audit log entry added');
    }

    await pool.query('COMMIT');
    console.log('🎉 Decommission Migration v1.5.6 completed successfully!');

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
