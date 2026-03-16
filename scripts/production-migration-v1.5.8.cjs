#!/usr/bin/env node
/**
 * BookStud.io v1.5.8 - Kit Asset Migration
 * Adds is_kit (boolean) and parent_asset_id (integer FK) columns to the assets table,
 * enabling grouping of serialized components into a single Kit asset.
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'db',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'bookstudio',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting BookStud.io v1.5.8 Kit Asset Migration...');

    // Add is_kit column
    const isKitExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'is_kit'
      );
    `);
    if (!isKitExists.rows[0].exists) {
      await client.query(`ALTER TABLE assets ADD COLUMN is_kit BOOLEAN NOT NULL DEFAULT FALSE;`);
      console.log('✅ is_kit column added to assets table');
    } else {
      console.log('ℹ️  is_kit column already exists');
    }

    // Add parent_asset_id column
    const parentExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'parent_asset_id'
      );
    `);
    if (!parentExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE assets ADD COLUMN parent_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL;
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_assets_parent_asset_id ON assets(parent_asset_id);
      `);
      console.log('✅ parent_asset_id column added to assets table');
    } else {
      console.log('ℹ️  parent_asset_id column already exists');
    }

    // Audit log
    try {
      await client.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, entity_title, details)
        VALUES (1, 'migration', 'system', 0, 'Migration v1.5.8', '{"version":"1.5.8","description":"Kit asset support"}')
        ON CONFLICT DO NOTHING;
      `);
    } catch (_) {}

    console.log('🎉 Kit Asset Migration v1.5.8 completed successfully!');
  } catch (error) {
    console.error('❌ Migration v1.5.8 failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
