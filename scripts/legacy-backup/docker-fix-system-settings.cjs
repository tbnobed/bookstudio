const { Pool } = require('pg');

async function fixSystemSettings() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'bookstudio',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres'
  });

  try {
    console.log('Fixing system_settings table structure...');

    // Check if system_settings table exists
    const tableExistsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings'
      );
    `);

    if (!tableExistsResult.rows[0].exists) {
      console.log('Creating system_settings table...');
      await pool.query(`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✓ Created system_settings table');
    }

    // Check if id column exists
    const idExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings' 
        AND column_name = 'id'
      );
    `);

    if (!idExists.rows[0].exists) {
      console.log('Adding id column to system_settings...');
      await pool.query('ALTER TABLE system_settings ADD COLUMN id SERIAL PRIMARY KEY;');
      console.log('✓ Added id column');
    }

    // Check if description column exists
    const descExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings' 
        AND column_name = 'description'
      );
    `);

    if (!descExists.rows[0].exists) {
      console.log('Adding description column to system_settings...');
      await pool.query('ALTER TABLE system_settings ADD COLUMN description TEXT;');
      console.log('✓ Added description column');
    }

    // Ensure default site name exists
    await pool.query(`
      INSERT INTO system_settings (key, value, description) 
      VALUES ('siteName', 'The Plex Studios', 'The name of the facility displayed throughout the application')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('System settings table structure fixed successfully');

  } catch (error) {
    console.error('Error fixing system_settings table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixSystemSettings();