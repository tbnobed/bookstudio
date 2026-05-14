#!/usr/bin/env node
/**
 * BookStud.io v1.6.1 - iCal Calendar Sync Migration
 * Adds calendar_token (text, unique) column to the users table,
 * enabling per-user iCal subscription feed URLs.
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
    console.log('🚀 Starting BookStud.io v1.6.1 iCal Calendar Sync Migration...');

    // Add calendar_token column to users table
    const tokenExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'calendar_token'
      );
    `);
    if (!tokenExists.rows[0].exists) {
      await client.query(`ALTER TABLE users ADD COLUMN calendar_token TEXT;`);
      console.log('✅ Added calendar_token column to users table');
    } else {
      console.log('ℹ️  calendar_token column already exists, skipping');
    }

    // Add unique index on calendar_token (sparse — only non-null values)
    const indexExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'users' AND indexname = 'users_calendar_token_unique'
      );
    `);
    if (!indexExists.rows[0].exists) {
      await client.query(`
        CREATE UNIQUE INDEX users_calendar_token_unique
        ON users (calendar_token)
        WHERE calendar_token IS NOT NULL;
      `);
      console.log('✅ Created unique index on users.calendar_token');
    } else {
      console.log('ℹ️  Unique index already exists, skipping');
    }

    console.log('🎉 Migration v1.6.1 completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
