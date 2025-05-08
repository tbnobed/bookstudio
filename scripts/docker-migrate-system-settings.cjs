/**
 * Migration script to create the system_settings table
 * This script ensures the system_settings table exists for site name and other global settings
 */

// No need for dotenv in Docker environment as variables are provided directly
const { Pool } = require('pg');

// Connection configuration for database
const config = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'bookstudio',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};

// Main migration function
async function migrateSystemSettings() {
  const pool = new Pool(config);

  try {
    console.log('Running system settings table migration...');

    // Check if system_settings table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'system_settings'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Creating system_settings table...');
      
      // Create system_settings table
      await pool.query(`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      // Insert default site name
      await pool.query(`
        INSERT INTO system_settings (key, value, description)
        VALUES ('siteName', 'The Plex Studios', 'The name of the facility displayed throughout the application');
      `);
      
      console.log('System settings table created successfully');
    } else {
      console.log('System settings table already exists');
      
      // Check if siteName exists
      const siteNameCheck = await pool.query(`
        SELECT * FROM system_settings WHERE key = 'siteName';
      `);
      
      if (siteNameCheck.rows.length === 0) {
        console.log('Adding default site name setting...');
        await pool.query(`
          INSERT INTO system_settings (key, value, description)
          VALUES ('siteName', 'The Plex Studios', 'The name of the facility displayed throughout the application');
        `);
        console.log('Default site name added');
      }
    }

    console.log('System settings migration completed successfully');
  } catch (error) {
    console.error('Error in system settings migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateSystemSettings().catch(err => {
  console.error('Unhandled error in system settings migration:', err);
  process.exit(1);
});