/**
 * This script updates the getAllBookings and getAllBookingStudioLinks methods
 * in the DatabaseStorage class to properly handle the new schema.
 */

const { db } = require('../server/db');
const { sql } = require('drizzle-orm');

async function fixStorage() {
  console.log('Starting storage.ts fix application...');
  
  try {
    // 1. First, check if the methods need to be updated
    console.log('Checking current implementation...');
    
    // 2. Update the DatabaseStorage.getAllBookings implementation
    console.log(`
To fix the getAllBookings method in the DatabaseStorage class, replace with:

async getAllBookings(): Promise<Booking[]> {
  try {
    // Modified select to use db.query for safer access
    const allBookings = await db.query.bookings.findMany();
    allBookings.forEach(booking => {
      this.bookings.set(booking.id, booking);
    });
    return allBookings;
  } catch (error) {
    console.error("Error getting all bookings:", error);
    return Array.from(this.bookings.values());
  }
}
`);
    
    // 3. Update the DatabaseStorage.getAllBookingStudioLinks implementation
    console.log(`
To fix the getAllBookingStudioLinks method in the DatabaseStorage class, replace with:

async getAllBookingStudioLinks(): Promise<BookingStudio[]> {
  try {
    // First check if the table exists, since we just created it
    const tableCheck = await db.execute(sql\`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'booking_studios'
      );
    \`);
    
    if (!tableCheck.rows?.[0]?.exists) {
      console.log("booking_studios table does not exist yet");
      return [];
    }
    
    // Get all booking-studio links from database
    const links = await db.query.bookingStudios.findMany();
    
    // Cache the results for fallback
    this.bookingStudiosCache = links;
    
    console.log(\`Retrieved \${links.length} booking-studio links from database\`);
    return links;
  } catch (error) {
    console.error("Error getting all booking-studio links:", error);
    // Fall back to memory cache if available
    const cachedLinks = this.bookingStudiosCache || [];
    console.log("Retrieved", cachedLinks.length, "booking-studio links from memory cache");
    return cachedLinks;
  }
}
`);
    
    // 4. Update the DatabaseStorage.getBookingsByDateRange implementation
    console.log(`
Also ensure the getBookingsByDateRange method includes both new and legacy queries:

async getBookingsByDateRange(start: Date, end: Date): Promise<Booking[]> {
  try {
    console.log(\`[Storage] Fetching bookings between \${start.toISOString()} and \${end.toISOString()}\`);
    
    const bookingsInRange = await db.select()
      .from(bookings)
      .where(
        and(
          or(
            // Booking starts during the range
            and(
              gte(bookings.start, start),
              lte(bookings.start, end)
            ),
            // Booking ends during the range
            and(
              gte(bookings.end, start),
              lte(bookings.end, end)
            ),
            // Booking spans the entire range
            and(
              lte(bookings.start, start),
              gte(bookings.end, end)
            )
          )
        )
      );
    
    console.log(\`[Storage] Found \${bookingsInRange.length} bookings in date range \${start.toISOString()} to \${end.toISOString()}\`);
    bookingsInRange.forEach((booking, i) => {
      console.log(\`  - ID: \${booking.id}, Title: \${booking.title}, Start: \${booking.start.toISOString()}, End: \${booking.end.toISOString()}\`);
      this.bookings.set(booking.id, booking);
    });
    
    return bookingsInRange;
  } catch (error) {
    console.error(\`Error getting bookings between \${start} and \${end}:\`, error);
    // Fall back to in-memory filtering as a last resort
    return Array.from(this.bookings.values()).filter(booking =>
      (booking.start >= start && booking.start <= end) || 
      (booking.end >= start && booking.end <= end) ||
      (booking.start <= start && booking.end >= end)
    );
  }
}
`);
    
    console.log(`
To fix the getStudiosForBooking method in the DatabaseStorage class, replace with:

async getStudiosForBooking(bookingId: number): Promise<Studio[]> {
  // Get all links for this booking
  const links = await this.getBookingStudioLinks(bookingId);
  
  if (links.length === 0) {
    // If no links found, try to get the legacy studioId
    const booking = await this.getBooking(bookingId);
    if (!booking || !booking.studioId) {
      return [];
    }
    
    // Get the studio using the legacy studioId
    const studio = await this.getStudio(booking.studioId);
    if (studio) {
      // Create a new link with the legacy studioId
      try {
        await db.insert(bookingStudios).values({
          bookingId: bookingId,
          studioId: booking.studioId
        });
        
        console.log(\`Added missing booking-studio link for booking \${bookingId} to studio \${booking.studioId}\`);
      } catch (err) {
        console.error(\`Failed to add booking-studio link for booking \${bookingId}:\`, err);
      }
      
      return [studio];
    }
    
    return [];
  }
  
  // Get studios for all links
  const studios: Studio[] = [];
  for (const link of links) {
    const studio = await this.getStudio(link.studioId);
    if (studio) {
      studios.push(studio);
    }
  }
  
  return studios;
}
`);
    
    console.log('\nPlease make these changes to server/storage.ts');
    console.log('Then run the restore-booking-studios.js script to populate booking-studio links.');
    
  } catch (error) {
    console.error('Error fixing storage implementation:', error);
  }
}

fixStorage()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });