#!/usr/bin/env node

/**
 * Docker migration script for linked bookings functionality
 * This script ensures the linked_bookings table exists and is properly configured
 * for BookStudio v1.5.0 with Linked Copy Features
 */

const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'bookstudio',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

async function createLinkedBookingsTable() {
  console.log('=== Creating linked_bookings table for v1.5.0 ===');
  
  try {
    // Check if linked_bookings table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'linked_bookings'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creating linked_bookings table...');
      
      await pool.query(`
        CREATE TABLE linked_bookings (
          id SERIAL PRIMARY KEY,
          primary_booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          linked_booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(primary_booking_id, linked_booking_id),
          CHECK (primary_booking_id != linked_booking_id)
        );
      `);
      
      console.log('linked_bookings table created successfully');
      
      // Create indexes for better performance
      await pool.query(`
        CREATE INDEX idx_linked_bookings_primary ON linked_bookings(primary_booking_id);
      `);
      
      await pool.query(`
        CREATE INDEX idx_linked_bookings_linked ON linked_bookings(linked_booking_id);
      `);
      
      console.log('Indexes created for linked_bookings table');
      
    } else {
      console.log('linked_bookings table already exists');
      
      // Check if indexes exist and create them if missing
      const primaryIndexExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND tablename = 'linked_bookings' 
          AND indexname = 'idx_linked_bookings_primary'
        );
      `);
      
      if (!primaryIndexExists.rows[0].exists) {
        console.log('Creating missing primary booking index...');
        await pool.query(`
          CREATE INDEX idx_linked_bookings_primary ON linked_bookings(primary_booking_id);
        `);
      }
      
      const linkedIndexExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND tablename = 'linked_bookings' 
          AND indexname = 'idx_linked_bookings_linked'
        );
      `);
      
      if (!linkedIndexExists.rows[0].exists) {
        console.log('Creating missing linked booking index...');
        await pool.query(`
          CREATE INDEX idx_linked_bookings_linked ON linked_bookings(linked_booking_id);
        `);
      }
    }
    
    console.log('Linked bookings table migration completed successfully');
    
  } catch (error) {
    console.error('Error creating linked_bookings table:', error);
    throw error;
  }
}

async function ensureDatabaseConsistency() {
  console.log('=== Ensuring database consistency for linked bookings ===');
  
  try {
    // Clean up any invalid linked booking entries (in case of data corruption)
    const cleanupResult = await pool.query(`
      DELETE FROM linked_bookings 
      WHERE primary_booking_id NOT IN (SELECT id FROM bookings)
         OR linked_booking_id NOT IN (SELECT id FROM bookings);
    `);
    
    if (cleanupResult.rowCount > 0) {
      console.log(`Cleaned up ${cleanupResult.rowCount} invalid linked booking entries`);
    }
    
    // Ensure bidirectional relationships exist
    console.log('Ensuring bidirectional linked booking relationships...');
    await pool.query(`
      INSERT INTO linked_bookings (primary_booking_id, linked_booking_id)
      SELECT lb.linked_booking_id, lb.primary_booking_id
      FROM linked_bookings lb
      WHERE NOT EXISTS (
        SELECT 1 FROM linked_bookings lb2 
        WHERE lb2.primary_booking_id = lb.linked_booking_id 
        AND lb2.linked_booking_id = lb.primary_booking_id
      )
      ON CONFLICT (primary_booking_id, linked_booking_id) DO NOTHING;
    `);
    
    console.log('Database consistency check completed');
    
  } catch (error) {
    console.error('Error ensuring database consistency:', error);
    throw error;
  }
}

async function addLinkedBookingFields() {
  console.log('=== Adding linked booking fields to bookings table ===');
  
  try {
    // Check if link_group_id column exists
    const linkGroupIdExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings' 
        AND column_name = 'link_group_id'
      );
    `);
    
    if (!linkGroupIdExists.rows[0].exists) {
      console.log('Adding link_group_id column to bookings table...');
      await pool.query(`
        ALTER TABLE bookings 
        ADD COLUMN link_group_id TEXT;
      `);
      console.log('link_group_id column added successfully');
    } else {
      console.log('link_group_id column already exists');
    }
    
    // Check if is_primary_in_group column exists
    const isPrimaryExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings' 
        AND column_name = 'is_primary_in_group'
      );
    `);
    
    if (!isPrimaryExists.rows[0].exists) {
      console.log('Adding is_primary_in_group column to bookings table...');
      await pool.query(`
        ALTER TABLE bookings 
        ADD COLUMN is_primary_in_group BOOLEAN DEFAULT FALSE;
      `);
      console.log('is_primary_in_group column added successfully');
    } else {
      console.log('is_primary_in_group column already exists');
    }
    
  } catch (error) {
    console.error('Error adding linked booking fields:', error);
    throw error;
  }
}

async function main() {
  console.log('Starting linked bookings migration for BookStudio v1.5.0...');
  
  try {
    await createLinkedBookingsTable();
    await addLinkedBookingFields();
    await ensureDatabaseConsistency();
    
    console.log('=== Linked bookings migration completed successfully ===');
    console.log('BookStudio v1.5.0 linked copy features are now ready');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, createLinkedBookingsTable, addLinkedBookingFields, ensureDatabaseConsistency };