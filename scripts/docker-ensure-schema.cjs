/**
 * This script ensures that all required tables and columns exist in the database
 * Run this during container startup to prevent schema mismatch issues
 */

const { Pool } = require('pg');
const path = require('path');

// Get the connection string from environment variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString
});

async function ensureSchema() {
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    console.log('Ensuring required tables and columns exist...');
    
    // Check and create the booking_studios junction table if it doesn't exist
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_studios'
      );
    `;
    
    const tableResult = await client.query(tableExistsQuery);
    if (!tableResult.rows[0].exists) {
      console.log('Creating booking_studios junction table...');
      await client.query(`
        CREATE TABLE booking_studios (
          id SERIAL PRIMARY KEY,
          booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          studio_id INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
          UNIQUE(booking_id, studio_id)
        );
      `);
      console.log('booking_studios junction table created successfully.');
    } else {
      console.log('booking_studios junction table already exists.');
    }
    
    // Check and create system_settings table if it doesn't exist
    const settingsExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings'
      );
    `;
    
    const settingsResult = await client.query(settingsExistsQuery);
    if (!settingsResult.rows[0].exists) {
      console.log('Creating system_settings table...');
      await client.query(`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        INSERT INTO system_settings (key, value)
        VALUES ('site_name', 'The Plex Studios');
      `);
      console.log('system_settings table created successfully.');
    } else {
      console.log('system_settings table already exists.');
    }
    
    // Check and add status column to bookings if it doesn't exist
    const statusColExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings'
        AND column_name = 'status'
      );
    `;
    
    const statusResult = await client.query(statusColExistsQuery);
    if (!statusResult.rows[0].exists) {
      console.log('Adding status column to bookings table...');
      await client.query(`
        ALTER TABLE bookings ADD COLUMN status TEXT DEFAULT 'confirmed';
      `);
      console.log('status column added to bookings table.');
    } else {
      console.log('status column already exists in bookings table.');
    }
    
    // Check and add color column to bookings if it doesn't exist
    const colorColExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings'
        AND column_name = 'color'
      );
    `;
    
    const colorResult = await client.query(colorColExistsQuery);
    if (!colorResult.rows[0].exists) {
      console.log('Adding color column to bookings table...');
      await client.query(`
        ALTER TABLE bookings ADD COLUMN color TEXT;
      `);
      console.log('color column added to bookings table.');
    } else {
      console.log('color column already exists in bookings table.');
    }
    
    // Check and add pcr_room_id column to bookings if it doesn't exist
    const pcrRoomColExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings'
        AND column_name = 'pcr_room_id'
      );
    `;
    
    const pcrRoomResult = await client.query(pcrRoomColExistsQuery);
    if (!pcrRoomResult.rows[0].exists) {
      console.log('Adding pcr_room_id column to bookings table...');
      
      // First check if pcr_rooms table exists to decide whether to add a foreign key
      const pcrRoomsTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'pcr_rooms'
        );
      `);
      
      if (pcrRoomsTableExists.rows[0].exists) {
        await client.query(`
          ALTER TABLE bookings ADD COLUMN pcr_room_id INTEGER REFERENCES pcr_rooms(id) ON DELETE SET NULL;
        `);
      } else {
        // Add column without foreign key if pcr_rooms table doesn't exist yet
        await client.query(`
          ALTER TABLE bookings ADD COLUMN pcr_room_id INTEGER;
        `);
      }
      console.log('pcr_room_id column added to bookings table.');
    } else {
      console.log('pcr_room_id column already exists in bookings table.');
    }
    
    // Check and add severity column to bookings if it doesn't exist
    const severityColExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings'
        AND column_name = 'severity'
      );
    `;
    
    const severityResult = await client.query(severityColExistsQuery);
    if (!severityResult.rows[0].exists) {
      console.log('Adding severity column to bookings table...');
      await client.query(`
        ALTER TABLE bookings ADD COLUMN severity TEXT;
      `);
      console.log('severity column added to bookings table.');
    } else {
      console.log('severity column already exists in bookings table.');
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Schema verification complete.');
    
  } catch (error) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error('Error ensuring schema:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the schema check
ensureSchema().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});