/**
 * This script fixes database schema issues on Replit
 * It addresses:
 * 1. Missing booking_studios table
 * 2. Missing pcr_room_id column in bookings
 * 3. Missing status column in bookings
 * 4. Missing system_settings table
 */

import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  // Create a PostgreSQL client
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Connect to the database
    const client = await pool.connect();
    console.log('Connected to database. Starting schema fixes...');

    try {
      // Start a transaction
      await client.query('BEGIN');

      // Check if booking_studios table exists
      const bookingStudiosCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'booking_studios'
        );
      `);

      if (!bookingStudiosCheck.rows[0].exists) {
        console.log('Creating booking_studios table...');
        
        await client.query(`
          CREATE TABLE booking_studios (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER NOT NULL,
            studio_id INTEGER NOT NULL
          );
        `);
        
        console.log('booking_studios table created successfully');
      } else {
        console.log('booking_studios table already exists');
      }

      // Check if pcr_room_id column exists in bookings table
      const pcrRoomIdCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'bookings'
          AND column_name = 'pcr_room_id'
        );
      `);

      if (!pcrRoomIdCheck.rows[0].exists) {
        console.log('Adding pcr_room_id column to bookings table...');
        
        await client.query(`
          ALTER TABLE bookings 
          ADD COLUMN pcr_room_id INTEGER;
        `);
        
        console.log('pcr_room_id column added successfully');
      } else {
        console.log('pcr_room_id column already exists');
      }

      // Check if status column exists in bookings table
      const statusCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'bookings'
          AND column_name = 'status'
        );
      `);

      if (!statusCheck.rows[0].exists) {
        console.log('Adding status column to bookings table...');
        
        await client.query(`
          ALTER TABLE bookings 
          ADD COLUMN status TEXT DEFAULT 'confirmed';
        `);
        
        console.log('status column added successfully');
      } else {
        console.log('status column already exists');
      }

      // Check if color column exists in bookings table
      const colorCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'bookings'
          AND column_name = 'color'
        );
      `);

      if (!colorCheck.rows[0].exists) {
        console.log('Adding color column to bookings table...');
        
        await client.query(`
          ALTER TABLE bookings 
          ADD COLUMN color TEXT;
        `);
        
        console.log('color column added successfully');
      } else {
        console.log('color column already exists');
      }

      // Check if system_settings table exists
      const systemSettingsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'system_settings'
        );
      `);

      if (!systemSettingsCheck.rows[0].exists) {
        console.log('Creating system_settings table...');
        
        await client.query(`
          CREATE TABLE system_settings (
            id SERIAL PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
        `);
        
        // Insert default site name setting
        await client.query(`
          INSERT INTO system_settings (key, value)
          VALUES ('siteName', 'The Plex Studios');
        `);
        
        console.log('system_settings table created successfully with default site name');
      } else {
        console.log('system_settings table already exists');
      }

      // Check if pcr_rooms table exists
      const pcrRoomsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'pcr_rooms'
        );
      `);

      if (!pcrRoomsCheck.rows[0].exists) {
        console.log('Creating pcr_rooms table...');
        
        await client.query(`
          CREATE TABLE pcr_rooms (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'available'
          );
        `);
        
        // Insert sample PCR rooms
        await client.query(`
          INSERT INTO pcr_rooms (name, description) VALUES 
          ('PCR 1', 'Main Production Control Room'),
          ('PCR 2', 'Secondary Production Control Room'),
          ('PCR 3', 'Tertiary Production Control Room');
        `);
        
        console.log('pcr_rooms table created successfully with sample data');
      } else {
        console.log('pcr_rooms table already exists');
      }
            
      // Commit the transaction
      await client.query('COMMIT');
      console.log('All schema fixes applied successfully!');
      
    } catch (err) {
      // Rollback in case of error
      await client.query('ROLLBACK');
      console.error('Error fixing schema:', err);
      throw err;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    // End the pool
    await pool.end();
  }
}

// Run the main function
main().catch(console.error);