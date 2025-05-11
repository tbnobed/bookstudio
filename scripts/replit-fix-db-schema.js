/**
 * This script fixes database schema issues on Replit
 * It addresses:
 * 1. Missing booking_studios table
 * 2. Missing pcr_room_id column in bookings
 * 3. Missing status column in bookings
 * 4. Missing system_settings table
 */

import { db, pool } from '../server/db.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting database schema fix script...');
  
  try {
    // Ensure connection is successful
    await ensureConnection();
    
    // Fix each component of the database
    await ensureBookingStudiosTable();
    await ensureStudioLinks();
    await ensureStatusColumn();
    await ensurePcrRoomColumn();
    await ensureSystemSettings();
    await ensureColorColumn();
    
    console.log('Database schema fix completed successfully!');
  } catch (error) {
    console.error('Error fixing database schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function ensureConnection() {
  try {
    const result = await db.execute(sql`SELECT 1`);
    console.log('Database connection verified');
    return true;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

async function ensureBookingStudiosTable() {
  console.log('Ensuring booking_studios table exists...');
  
  try {
    // Check if booking_studios table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'booking_studios'
      )
    `);
    
    const exists = tableExists.rows[0].exists;
    
    if (!exists) {
      console.log('Creating booking_studios table...');
      await db.execute(sql`
        CREATE TABLE booking_studios (
          id SERIAL PRIMARY KEY,
          booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          studio_id INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
          UNIQUE(booking_id, studio_id)
        )
      `);
      console.log('booking_studios table created successfully');
    } else {
      console.log('booking_studios table already exists');
    }
  } catch (error) {
    console.error('Error ensuring booking_studios table:', error);
    throw error;
  }
}

async function ensureStudioLinks() {
  console.log('Ensuring all studios have booking links...');
  
  try {
    // Get all studios
    const allStudios = await db.execute(sql`SELECT id, name FROM studios`);
    
    // For each studio, check if it has any booking links
    for (const studio of allStudios.rows) {
      const studioId = studio.id;
      const studioName = studio.name;
      
      const links = await db.execute(sql`
        SELECT COUNT(*) as count FROM booking_studios 
        WHERE studio_id = ${studioId}
      `);
      
      const linkCount = parseInt(links.rows[0].count);
      
      if (linkCount === 0) {
        console.log(`Studio ${studioName} (ID: ${studioId}) has no booking links - creating link...`);
        
        // Find most recent booking
        const recentBookings = await db.execute(sql`
          SELECT id FROM bookings ORDER BY created_at DESC LIMIT 1
        `);
        
        if (recentBookings.rows.length > 0) {
          const bookingId = recentBookings.rows[0].id;
          
          // Create link between studio and this booking
          await db.execute(sql`
            INSERT INTO booking_studios (booking_id, studio_id)
            VALUES (${bookingId}, ${studioId})
            ON CONFLICT (booking_id, studio_id) DO NOTHING
          `);
          
          console.log(`Created link between Studio ${studioName} and Booking ID ${bookingId}`);
        } else {
          console.log('No bookings found to create links with');
        }
      } else {
        console.log(`Studio ${studioName} (ID: ${studioId}) already has ${linkCount} booking links`);
      }
    }
  } catch (error) {
    console.error('Error ensuring studio links:', error);
    throw error;
  }
}

async function ensureStatusColumn() {
  console.log('Ensuring status column exists in bookings table...');
  
  try {
    // Check if status column exists
    const columnExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'status'
      )
    `);
    
    const exists = columnExists.rows[0].exists;
    
    if (!exists) {
      console.log('Adding status column to bookings table...');
      await db.execute(sql`
        ALTER TABLE bookings
        ADD COLUMN status VARCHAR(50) DEFAULT 'confirmed'
      `);
      console.log('Status column added successfully');
    } else {
      console.log('Status column already exists');
    }
  } catch (error) {
    console.error('Error ensuring status column:', error);
    throw error;
  }
}

async function ensurePcrRoomColumn() {
  console.log('Ensuring pcr_room_id column exists in bookings table...');
  
  try {
    // Check if pcr_room_id column exists
    const columnExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'pcr_room_id'
      )
    `);
    
    const exists = columnExists.rows[0].exists;
    
    if (!exists) {
      console.log('Adding pcr_room_id column to bookings table...');
      await db.execute(sql`
        ALTER TABLE bookings
        ADD COLUMN pcr_room_id INTEGER REFERENCES pcr_rooms(id) ON DELETE SET NULL
      `);
      console.log('pcr_room_id column added successfully');
    } else {
      console.log('pcr_room_id column already exists');
    }
  } catch (error) {
    console.error('Error ensuring pcr_room_id column:', error);
    throw error;
  }
}

async function ensureSystemSettings() {
  console.log('Ensuring system_settings table exists and has necessary data...');
  
  try {
    // Check if system_settings table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'system_settings'
      )
    `);
    
    const exists = tableExists.rows[0].exists;
    
    if (!exists) {
      console.log('Creating system_settings table...');
      await db.execute(sql`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(100) UNIQUE NOT NULL,
          value TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('system_settings table created successfully');
    } else {
      console.log('system_settings table already exists');
    }
    
    // Ensure site name setting exists
    const siteName = await db.execute(sql`
      SELECT COUNT(*) as count FROM system_settings WHERE key = 'siteName'
    `);
    
    if (parseInt(siteName.rows[0].count) === 0) {
      await db.execute(sql`
        INSERT INTO system_settings (key, value)
        VALUES ('siteName', 'The Plex Studios')
      `);
      console.log('Added siteName setting');
    } else {
      console.log('siteName setting already exists');
    }
  } catch (error) {
    console.error('Error ensuring system_settings:', error);
    throw error;
  }
}

async function ensureColorColumn() {
  console.log('Ensuring color column exists in bookings table...');
  
  try {
    // Check if color column exists
    const columnExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'color'
      )
    `);
    
    const exists = columnExists.rows[0].exists;
    
    if (!exists) {
      console.log('Adding color column to bookings table...');
      await db.execute(sql`
        ALTER TABLE bookings
        ADD COLUMN color VARCHAR(50)
      `);
      console.log('Color column added successfully');
    } else {
      console.log('Color column already exists');
    }
  } catch (error) {
    console.error('Error ensuring color column:', error);
    throw error;
  }
}

// Run the script
main().catch(console.error);