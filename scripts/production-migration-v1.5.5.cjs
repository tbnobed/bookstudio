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

  console.log('🚀 Starting BookStud.io v1.5.5 Asset Photos Migration...');

  try {
    await pool.query('BEGIN');

    // ── asset_photos table ────────────────────────────────────────────────────
    const photosExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'asset_photos'
      );
    `);

    if (!photosExists.rows[0].exists) {
      console.log('🔧 Creating asset_photos table...');
      await pool.query(`
        CREATE TABLE asset_photos (
          id          SERIAL PRIMARY KEY,
          asset_id    INTEGER NOT NULL,
          photo_data  TEXT    NOT NULL,
          uploaded_by INTEGER NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('✅ asset_photos table created');
    } else {
      console.log('✅ asset_photos table already exists — verifying columns...');
      await pool.query(`ALTER TABLE asset_photos ADD COLUMN IF NOT EXISTS uploaded_by INTEGER NOT NULL DEFAULT 1;`);
      await pool.query(`ALTER TABLE asset_photos ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();`);
      console.log('✅ asset_photos columns verified');
    }

    // ── Foreign key: asset_photos → assets ───────────────────────────────────
    const fkExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name   = 'asset_photos'
          AND constraint_name = 'asset_photos_asset_id_fkey'
      );
    `);
    if (!fkExists.rows[0].exists) {
      // Only add FK if assets table exists (it always should after v1.5.4)
      const assetsExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'assets'
        );
      `);
      if (assetsExists.rows[0].exists) {
        await pool.query(`
          ALTER TABLE asset_photos
          ADD CONSTRAINT asset_photos_asset_id_fkey
          FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
        `);
        console.log('✅ asset_photos → assets foreign key added');
      } else {
        console.log('⚠️  assets table not found — skipping foreign key (run v1.5.4 migration first)');
      }
    } else {
      console.log('✅ Foreign key already exists');
    }

    // ── Indexes ───────────────────────────────────────────────────────────────
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_asset_photos_asset_id    ON asset_photos(asset_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_asset_photos_created_at  ON asset_photos(created_at);`);
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
          '{"message":"Asset photos migration v1.5.5 completed. Created asset_photos table with indexes and foreign key to assets."}'::json,
          1,
          CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Audit log entry added');
    }

    await pool.query('COMMIT');
    console.log('🎉 Asset Photos Migration v1.5.5 completed successfully!');

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
