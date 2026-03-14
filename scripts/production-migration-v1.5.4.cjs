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

  console.log('🚀 Starting BookStud.io v1.5.4 Asset Management Migration...');

  try {
    await pool.query('BEGIN');

    // ── assets table ──────────────────────────────────────────────────────────
    const assetsExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'assets'
      );
    `);

    if (!assetsExists.rows[0].exists) {
      console.log('🔧 Creating assets table...');
      await pool.query(`
        CREATE TABLE assets (
          id                   SERIAL PRIMARY KEY,
          name                 TEXT NOT NULL,
          category             TEXT NOT NULL,
          status               TEXT NOT NULL DEFAULT 'available',
          serial_number        TEXT,
          asset_tag            TEXT,
          location             TEXT,
          description          TEXT,
          notes                TEXT,
          purchase_date        TEXT,
          last_maintenance_date TEXT,
          assigned_to          INTEGER,
          created_by           INTEGER NOT NULL,
          created_at           TIMESTAMP DEFAULT NOW(),
          updated_at           TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('✅ assets table created');
    } else {
      console.log('✅ assets table already exists — checking columns...');

      // Ensure all columns exist (safe for existing deployments)
      const cols = [
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number        TEXT`,
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_tag            TEXT`,
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS location             TEXT`,
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS description          TEXT`,
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes                TEXT`,
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date        TEXT`,
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_maintenance_date TEXT`,
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS assigned_to          INTEGER`,
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_at           TIMESTAMP DEFAULT NOW()`,
        `ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMP DEFAULT NOW()`,
      ];
      for (const col of cols) {
        await pool.query(col + ';');
      }
      console.log('✅ assets columns verified');
    }

    // ── asset_checkouts table ─────────────────────────────────────────────────
    const checkoutsExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'asset_checkouts'
      );
    `);

    if (!checkoutsExists.rows[0].exists) {
      console.log('🔧 Creating asset_checkouts table...');
      await pool.query(`
        CREATE TABLE asset_checkouts (
          id             SERIAL PRIMARY KEY,
          asset_id       INTEGER NOT NULL,
          checked_out_by INTEGER NOT NULL,
          checked_out_at TIMESTAMP DEFAULT NOW(),
          checked_in_at  TIMESTAMP,
          checked_in_by  INTEGER,
          notes          TEXT,
          purpose        TEXT
        );
      `);
      console.log('✅ asset_checkouts table created');
    } else {
      console.log('✅ asset_checkouts table already exists — checking columns...');
      await pool.query(`ALTER TABLE asset_checkouts ADD COLUMN IF NOT EXISTS notes   TEXT;`);
      await pool.query(`ALTER TABLE asset_checkouts ADD COLUMN IF NOT EXISTS purpose TEXT;`);
      console.log('✅ asset_checkouts columns verified');
    }

    // ── Foreign keys ──────────────────────────────────────────────────────────
    const fkAsset = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'asset_checkouts'
          AND constraint_name = 'asset_checkouts_asset_id_fkey'
      );
    `);
    if (!fkAsset.rows[0].exists) {
      await pool.query(`
        ALTER TABLE asset_checkouts
        ADD CONSTRAINT asset_checkouts_asset_id_fkey
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
      `);
      console.log('✅ asset_checkouts → assets foreign key added');
    }

    // ── Indexes ───────────────────────────────────────────────────────────────
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_assets_status       ON assets(status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_assets_category     ON assets(category);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_checkouts_asset_id  ON asset_checkouts(asset_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_checkouts_checked_in ON asset_checkouts(checked_in_at);`);
    console.log('✅ Performance indexes created');

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
          '{"message":"Asset management migration v1.5.4 completed. Created assets and asset_checkouts tables with indexes and foreign keys."}'::json,
          1,
          CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Audit log entry added');
    }

    await pool.query('COMMIT');
    console.log('🎉 Asset Management Migration v1.5.4 completed successfully!');

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
