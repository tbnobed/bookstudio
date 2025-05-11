/**
 * This script restores the booking-studio links for all bookings.
 * It populates the booking_studios table using the legacy studioId field from bookings.
 */

const { db } = require('../server/db');
const { sql } = require('drizzle-orm');

async function restoreBookingStudioLinks() {
  console.log('Starting booking-studio links restoration...');
  
  try {
    // First check if the booking_studios table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_studios'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.error('booking_studios table does not exist. Please run the schema migration first.');
      return;
    }
    
    // Get all bookings with non-null studioId
    const bookingsWithStudio = await db.execute(sql`
      SELECT id, title, studio_id FROM bookings 
      WHERE studio_id IS NOT NULL
    `);
    
    console.log(`Found ${bookingsWithStudio.rows.length} bookings with studio IDs`);
    
    // Check if there are already entries in booking_studios
    const existingLinks = await db.execute(sql`
      SELECT COUNT(*) FROM booking_studios
    `);
    
    if (parseInt(existingLinks.rows[0].count) > 0) {
      console.log(`booking_studios table already has ${existingLinks.rows[0].count} entries.`);
      const clearConfirm = process.argv.includes('--clear');
      
      if (!clearConfirm) {
        console.log('Use --clear flag to clear existing links before restoring.');
        return;
      }
      
      console.log('Clearing existing booking-studio links...');
      await db.execute(sql`TRUNCATE booking_studios RESTART IDENTITY`);
    }
    
    // Insert a new booking-studio link for each booking with a studioId
    let insertedCount = 0;
    for (const booking of bookingsWithStudio.rows) {
      await db.execute(sql`
        INSERT INTO booking_studios (booking_id, studio_id)
        VALUES (${booking.id}, ${booking.studio_id})
      `);
      insertedCount++;
      console.log(`Restored link: Booking "${booking.title}" (ID: ${booking.id}) → Studio ID: ${booking.studio_id}`);
    }
    
    console.log(`Successfully restored ${insertedCount} booking-studio links!`);
    
    // Update the application storage
    console.log('Now restart the application to see the restored bookings.');
    
  } catch (error) {
    console.error('Error restoring booking-studio links:', error);
  }
}

restoreBookingStudioLinks()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });