/**
 * This script updates the DatabaseStorage class in server/storage.ts 
 * to handle the new database schema
 */

// First, modify getAllBookings
const getAllBookingsFix = `  async getAllBookings(): Promise<Booking[]> {
    try {
      // Modified select to exclude pcr_room_id if it doesn't exist
      const allBookings = await db.query.bookings.findMany();
      allBookings.forEach(booking => {
        this.bookings.set(booking.id, booking);
      });
      return allBookings;
    } catch (error) {
      console.error("Error getting all bookings:", error);
      return Array.from(this.bookings.values());
    }
  }`;

// Then, modify getAllBookingStudioLinks
const getAllBookingStudioLinksFix = `  async getAllBookingStudioLinks(): Promise<BookingStudio[]> {
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
      
      console.log(\`Retrieved \${links.length} booking-studio links from database\`);
      return links;
    } catch (error) {
      console.error("Error getting all booking-studio links:", error);
      // Fall back to memory cache if available
      console.log("Retrieved", this.bookingStudiosCache.length, "booking-studio links from memory cache");
      return this.bookingStudiosCache;
    }
  }`;

console.log("Fix scripts generated. Apply these changes to server/storage.ts:");
console.log("\n1. Replace the getAllBookings method in the DatabaseStorage class with:");
console.log(getAllBookingsFix);
console.log("\n2. Replace the getAllBookingStudioLinks method in the DatabaseStorage class with:");
console.log(getAllBookingStudioLinksFix);