/**
 * Migration script to create the booking_dates table and migrate existing bookings
 */
import { eq } from "drizzle-orm";
import { bookingDates, bookings } from "../shared/schema";
import { db, ensureConnection } from "../server/db";

async function createBookingDatesTable() {
  console.log("Starting migration: creating booking_dates table...");
  try {
    // Create the booking_dates table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS booking_dates (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        date TIMESTAMP NOT NULL
      );
    `);
    console.log("booking_dates table created successfully");

    // Migrate existing bookings by copying the start date to the booking_dates table
    const allBookings = await db.select().from(bookings);
    console.log(`Found ${allBookings.length} existing bookings to migrate`);

    // Insert a booking_date entry for each existing booking
    let migratedCount = 0;
    for (const booking of allBookings) {
      // Extract just the date part from the booking start time
      const startDate = new Date(booking.start);
      startDate.setHours(0, 0, 0, 0);
      
      // Insert into booking_dates
      await db.insert(bookingDates).values({
        bookingId: booking.id,
        date: startDate,
      });
      
      migratedCount++;
      if (migratedCount % 10 === 0) {
        console.log(`Migrated ${migratedCount}/${allBookings.length} bookings...`);
      }
    }

    console.log(`Migration complete: ${migratedCount} bookings migrated to booking_dates`);
  } catch (err) {
    console.error("Error during migration:", err);
    throw err;
  }
}

(async () => {
  try {
    await ensureConnection();
    await createBookingDatesTable();
    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
})();