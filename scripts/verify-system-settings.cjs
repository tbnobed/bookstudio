/**
 * Script to verify and create system_settings table if needed
 * This script is run at application startup in Docker to ensure system settings are available
 */

const { Pool } = require('pg');

// Connection configuration for database
const config = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'bookstudio',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};

// Main verification function
async function verifySystemSettings() {
  const pool = new Pool(config);

  try {
    console.log('Verifying system_settings table exists...');

    // Check if system_settings table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'system_settings'
      );
    `;
    
    const result = await pool.query(tableCheckQuery);
    
    if (!result.rows[0].exists) {
      console.error('system_settings table not found. Running emergency fix...');
      
      // Create system_settings table
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      await pool.query(createTableQuery);
      
      // Insert default site name
      const insertSiteNameQuery = `
        INSERT INTO system_settings (key, value, description)
        VALUES ('siteName', 'The Plex Studios', 'The name of the facility displayed throughout the application')
        ON CONFLICT (key) DO NOTHING;
      `;
      
      await pool.query(insertSiteNameQuery);
      
      console.log('Emergency table creation complete');
    } else {
      console.log('System settings table verified successfully');
    }
  } catch (error) {
    console.error('Database verification failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifySystemSettings().catch(err => {
  console.error('Unhandled error in system settings verification:', err);
  process.exit(1);
});