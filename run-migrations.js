import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Create a connection to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    console.log('Running system_settings table migration...');
    
    const client = await pool.connect();
    
    try {
      // Check if the table exists
      const checkTableQuery = `
        SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = 'system_settings'
        );
      `;
      
      const tableExists = await client.query(checkTableQuery);
      
      if (!tableExists.rows[0].exists) {
        console.log('Creating system_settings table...');
        
        // Create the system_settings table
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS system_settings (
            id SERIAL PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `;
        
        await client.query(createTableQuery);
        console.log('system_settings table created successfully!');
        
        // Insert default site name
        const insertDefaultQuery = `
          INSERT INTO system_settings (key, value) 
          VALUES ('siteName', 'BookStud.io')
          ON CONFLICT (key) DO NOTHING;
        `;
        
        await client.query(insertDefaultQuery);
        console.log('Default site name setting added!');
      } else {
        console.log('system_settings table already exists.');
      }
    } finally {
      client.release();
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();