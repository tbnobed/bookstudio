/**
 * Booking-studios junction table migration script optimized for Docker environments
 * This is a CommonJS version of the create-booking-studios-table.ts script
 */
const { Pool } = require('pg');

// Ensure we have environment variables
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable must be set");
}

// Create database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function main() {
  try {
    console.log("Creating booking_studios junction table...");
    
    // Create the booking_studios junction table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_studios (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL,
        studio_id INTEGER NOT NULL,
        UNIQUE(booking_id, studio_id)
      );
    `);
    
    console.log("Booking-studios junction table created successfully");
    console.log("Adding foreign key constraints...");
    
    // Check if constraint already exists
    const bookingConstraintExists = await pool.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'fk_booking_id' LIMIT 1;
    `);
    
    // Add booking ID foreign key constraint if it doesn't exist
    if (bookingConstraintExists.rows.length === 0) {
      await pool.query(`
        ALTER TABLE booking_studios 
        ADD CONSTRAINT fk_booking_id 
        FOREIGN KEY (booking_id) 
        REFERENCES bookings(id) 
        ON DELETE CASCADE;
      `);
      console.log("Added booking_id foreign key constraint");
    } else {
      console.log("booking_id foreign key constraint already exists");
    }
    
    // Check if studio constraint already exists
    const studioConstraintExists = await pool.query(`
      SELECT 1 FROM pg_constraint WHERE conname = 'fk_studio_id' LIMIT 1;
    `);
    
    // Add studio ID foreign key constraint if it doesn't exist
    if (studioConstraintExists.rows.length === 0) {
      await pool.query(`
        ALTER TABLE booking_studios 
        ADD CONSTRAINT fk_studio_id 
        FOREIGN KEY (studio_id) 
        REFERENCES studios(id) 
        ON DELETE CASCADE;
      `);
      console.log("Added studio_id foreign key constraint");
    } else {
      console.log("studio_id foreign key constraint already exists");
    }
    
    console.log("Foreign key constraints added successfully");
    
    // Migrate existing bookings with direct studioId to use the junction table
    console.log("Migrating existing bookings to use junction table...");
    const existingBookings = await pool.query(`
      SELECT id, studio_id FROM bookings 
      WHERE studio_id IS NOT NULL;
    `);
    
    for (const row of existingBookings.rows) {
      if (row.studio_id) {
        console.log(`Migrating booking ${row.id} with studio ${row.studio_id} to junction table`);
        try {
          await pool.query(`
            INSERT INTO booking_studios (booking_id, studio_id)
            VALUES (${row.id}, ${row.studio_id})
            ON CONFLICT (booking_id, studio_id) DO NOTHING;
          `);
        } catch (error) {
          console.error(`Error migrating booking ${row.id}:`, error);
        }
      }
    }
    
    console.log("Migration complete");
    
    // Done
    console.log("All operations completed successfully");
  } catch (error) {
    console.error("Error in database migration:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();