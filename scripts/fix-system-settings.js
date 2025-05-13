/**
 * Fix for system_settings table missing description column
 * 
 * This script:
 * 1. Checks if system_settings table exists
 * 2. Checks if description column exists
 * 3. Adds the column if missing
 * 4. Ensures the siteName setting exists
 */

const { Pool } = require('pg');

async function fixSystemSettings() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres'
  });

  try {
    console.log('Starting system_settings table fix...');

    // Check if system_settings table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('Creating system_settings table from scratch...');
      await pool.query(`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('system_settings table created successfully');
    } else {
      console.log('system_settings table exists, checking for description column...');
      
      // Check if description column exists
      const columnExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'description'
        );
      `);

      if (!columnExists.rows[0].exists) {
        console.log('Adding description column to system_settings table...');
        await pool.query(`
          ALTER TABLE system_settings ADD COLUMN description TEXT;
        `);
        console.log('description column added successfully');
      } else {
        console.log('description column already exists');
      }
    }

    // Check if siteName setting exists
    const siteNameExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM system_settings 
        WHERE key = 'siteName'
      );
    `);

    if (!siteNameExists.rows[0].exists) {
      console.log('Adding siteName setting to system_settings table...');
      await pool.query(`
        INSERT INTO system_settings (key, value, description)
        VALUES ('siteName', 'The Plex Studios', 'The name of the facility displayed throughout the application');
      `);
      console.log('siteName setting added successfully');
    } else {
      console.log('siteName setting already exists');
    }

    console.log('System settings fix completed successfully');
  } catch (error) {
    console.error('Error fixing system_settings table:', error);
  } finally {
    await pool.end();
  }
}

fixSystemSettings().then(() => {
  console.log('Script execution completed');
});