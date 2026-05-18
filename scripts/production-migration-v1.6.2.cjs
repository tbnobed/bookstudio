#!/usr/bin/env node
/**
 * Production Migration v1.6.2 - SSO/OIDC Support
 * Adds sso_provider and sso_id columns to users table for Authentik SSO integration.
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration v1.6.2: SSO/OIDC support...');

    await client.query('BEGIN');

    // Add sso_provider column if it doesn't exist
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS sso_provider TEXT;
    `);
    console.log('✓ Added sso_provider column to users table');

    // Add sso_id column if it doesn't exist
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS sso_id TEXT;
    `);
    console.log('✓ Added sso_id column to users table');

    // Add unique index on (sso_provider, sso_id) for fast lookups
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_sso_provider_id_idx
      ON users (sso_provider, sso_id)
      WHERE sso_provider IS NOT NULL AND sso_id IS NOT NULL;
    `);
    console.log('✓ Added unique index on (sso_provider, sso_id)');

    await client.query('COMMIT');
    console.log('✅ Migration v1.6.2 completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration v1.6.2 failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
