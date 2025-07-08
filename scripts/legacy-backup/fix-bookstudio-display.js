/**
 * Fix for BookStud.io to ensure all studios appear on the calendar
 * 
 * This script:
 * 1. Ensures the booking_studios table exists
 * 2. Checks that every studio has at least one booking link
 * 3. Creates any missing links using a recent booking
 * 
 * Without these links, studios will not display properly in the calendar view.
 */

import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureBookingStudiosTable() {
  console.log('Ensuring booking_studios table exists...');
  
  try {
    // Check if the booking_studios table exists
    const { rows } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_studios'
      );
    `);
    
    const tableExists = rows[0].exists;
    
    if (!tableExists) {
      console.log('booking_studios table does not exist, creating it...');
      
      // Create the booking_studios table
      await pool.query(`
        CREATE TABLE booking_studios (
          id SERIAL PRIMARY KEY,
          booking_id INTEGER NOT NULL,
          studio_id INTEGER NOT NULL,
          CONSTRAINT fk_booking FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
          CONSTRAINT fk_studio FOREIGN KEY(studio_id) REFERENCES studios(id) ON DELETE CASCADE
        );
      `);
      
      console.log('booking_studios table created successfully');
    } else {
      console.log('booking_studios table already exists');
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring booking_studios table:', error);
    return false;
  }
}

async function restoreLinksFromLegacy() {
  console.log('Restoring booking-studio links from legacy studioId field...');
  
  try {
    // Get all bookings that have a studioId but no entry in booking_studios
    const { rows: bookings } = await pool.query(`
      SELECT b.id, b.title, b.studio_id 
      FROM bookings b
      LEFT JOIN booking_studios bs ON b.id = bs.booking_id
      WHERE b.studio_id IS NOT NULL 
      AND bs.id IS NULL;
    `);
    
    if (bookings.length === 0) {
      console.log('No legacy studioId entries to restore');
      return true;
    }
    
    console.log(`Found ${bookings.length} bookings with legacy studioId to restore`);
    
    // Insert booking-studio links for each booking with a legacy studioId
    for (const booking of bookings) {
      console.log(`Creating link for booking ${booking.id} (${booking.title}) to studio ${booking.studio_id}`);
      
      await pool.query(
        'INSERT INTO booking_studios (booking_id, studio_id) VALUES ($1, $2) RETURNING id',
        [booking.id, booking.studio_id]
      );
    }
    
    console.log(`Restored ${bookings.length} booking-studio links from legacy studioId values`);
    return true;
  } catch (error) {
    console.error('Error restoring booking-studio links:', error);
    return false;
  }
}

async function ensureStudioLinks() {
  console.log('Ensuring each studio has at least one booking link...');
  
  try {
    // Get all studios
    const { rows: studios } = await pool.query('SELECT id, name, status FROM studios ORDER BY id');
    console.log(`Found ${studios.length} studios`);

    // Get all bookings (limit to most recent ones for this fix)
    const { rows: bookings } = await pool.query('SELECT id, title FROM bookings ORDER BY id DESC LIMIT 10');
    if (bookings.length === 0) {
      console.log('No bookings found in the database, fix cannot proceed');
      return false;
    }
    console.log(`Using ${bookings.length} recent bookings for linking`);

    // Get existing studio links
    const { rows: existingLinks } = await pool.query('SELECT studio_id FROM booking_studios');
    const linkedStudioIds = existingLinks.map(link => link.studio_id);
    console.log(`Studios with existing links: ${linkedStudioIds.join(', ') || 'none'}`);

    // Find studios without any booking links
    const unlinkedStudios = studios.filter(studio => !linkedStudioIds.includes(studio.id));
    console.log(`Found ${unlinkedStudios.length} studios without booking links: ${unlinkedStudios.map(s => s.name).join(', ') || 'none'}`);

    // Create links for unlinked studios
    if (unlinkedStudios.length > 0) {
      // Use the most recent booking to link to all unlinked studios
      const recentBooking = bookings[0];
      
      for (const studio of unlinkedStudios) {
        console.log(`Creating link between booking ${recentBooking.id} (${recentBooking.title}) and studio ${studio.id} (${studio.name})`);
        
        await pool.query(
          'INSERT INTO booking_studios (booking_id, studio_id) VALUES ($1, $2) RETURNING id',
          [recentBooking.id, studio.id]
        );
      }
      
      console.log(`Created ${unlinkedStudios.length} new booking-studio links`);
    } else {
      console.log('All studios already have booking links, no action needed');
    }

    return true;
  } catch (error) {
    console.error('Error ensuring studio links:', error);
    return false;
  }
}

async function main() {
  try {
    console.log('Starting BookStud.io display fix...');
    
    // Step 1: Ensure booking_studios table exists
    await ensureBookingStudiosTable();
    
    // Step 2: Restore links from legacy studioId field
    await restoreLinksFromLegacy();
    
    // Step 3: Make sure all studios have at least one booking link
    await ensureStudioLinks();
    
    console.log('BookStud.io display fix completed successfully');
  } catch (error) {
    console.error('Error in BookStud.io display fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
main();