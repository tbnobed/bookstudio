/**
 * This script ensures that each studio has at least one booking linked to it
 * in the booking_studios junction table.
 * 
 * The issue: Studios without any booking links don't display in the calendar view.
 * Solution: Add a link between each studio and at least one booking.
 */
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureStudioLinks() {
  console.log('Ensuring each studio has at least one booking link...');
  
  try {
    // Get all studios
    const { rows: studios } = await pool.query('SELECT id, name, status FROM studios');
    console.log(`Found ${studios.length} studios`);

    // Get all bookings (limit to most recent ones for this fix)
    const { rows: bookings } = await pool.query('SELECT id, title FROM bookings ORDER BY id DESC LIMIT 10');
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

    console.log('Fix completed successfully');
  } catch (error) {
    console.error('Error ensuring studio links:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
ensureStudioLinks();