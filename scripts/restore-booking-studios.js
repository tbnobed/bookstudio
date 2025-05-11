/**
 * This script restores the booking-studio links for all bookings.
 * It populates the booking_studios table using the legacy studioId field from bookings.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function restoreBookingStudioLinks() {
  const client = await pool.connect();
  try {
    console.log('Starting to restore booking-studio links...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Check if booking_studios table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_studios'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('booking_studios table does not exist. Creating it...');
      
      // Create the booking_studios table if it doesn't exist
      await client.query(`
        CREATE TABLE booking_studios (
          id SERIAL PRIMARY KEY,
          booking_id INTEGER NOT NULL,
          studio_id INTEGER NOT NULL,
          UNIQUE(booking_id, studio_id)
        );
      `);
      console.log('booking_studios table created successfully.');
    }
    
    // Get all bookings with studioId that is not null
    const bookingsResult = await client.query(`
      SELECT id, "studioId" FROM bookings 
      WHERE "studioId" IS NOT NULL
    `);
    
    console.log(`Found ${bookingsResult.rows.length} bookings with legacy studioId values.`);
    
    // Count existing links
    const existingLinks = await client.query(`
      SELECT COUNT(*) FROM booking_studios
    `);
    console.log(`Current booking_studios table has ${existingLinks.rows[0].count} entries.`);
    
    // Process each booking to create a link in booking_studios
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const booking of bookingsResult.rows) {
      try {
        // Check if link already exists
        const existingLink = await client.query(`
          SELECT id FROM booking_studios 
          WHERE booking_id = $1 AND studio_id = $2
        `, [booking.id, booking.studioId]);
        
        if (existingLink.rows.length === 0) {
          // Insert the link
          await client.query(`
            INSERT INTO booking_studios (booking_id, studio_id)
            VALUES ($1, $2)
          `, [booking.id, booking.studioId]);
          
          createdCount++;
          console.log(`Created link for booking ${booking.id} to studio ${booking.studioId}`);
        } else {
          skippedCount++;
          console.log(`Skipped existing link for booking ${booking.id} to studio ${booking.studioId}`);
        }
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error.message);
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log(`
      Restoration complete:
      - Total bookings with studioId: ${bookingsResult.rows.length}
      - New links created: ${createdCount}
      - Existing links skipped: ${skippedCount}
    `);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error restoring booking-studio links:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Execute the restoration
restoreBookingStudioLinks()
  .then(() => {
    console.log('Successfully restored booking-studio links');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to restore booking-studio links:', error);
    process.exit(1);
  });