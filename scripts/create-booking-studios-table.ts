import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Creating booking_studios junction table...");
    
    // Create the booking_studios junction table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS booking_studios (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL,
        studio_id INTEGER NOT NULL,
        UNIQUE(booking_id, studio_id)
      );
    `);
    
    console.log("Booking-studios junction table created successfully");
    console.log("Adding foreign key constraints...");
    
    // Add foreign key constraints
    await db.execute(sql`
      ALTER TABLE booking_studios 
      ADD CONSTRAINT fk_booking_id 
      FOREIGN KEY (booking_id) 
      REFERENCES bookings(id) 
      ON DELETE CASCADE;
    `);
    
    await db.execute(sql`
      ALTER TABLE booking_studios 
      ADD CONSTRAINT fk_studio_id 
      FOREIGN KEY (studio_id) 
      REFERENCES studios(id) 
      ON DELETE CASCADE;
    `);
    
    console.log("Foreign key constraints added successfully");
    
    // Migrate existing bookings with direct studioId to use the junction table
    console.log("Migrating existing bookings to use junction table...");
    const existingBookings = await db.execute(sql`
      SELECT id, studio_id FROM bookings 
      WHERE studio_id IS NOT NULL;
    `);
    
    for (const row of existingBookings.rows) {
      if (row.studio_id) {
        console.log(`Migrating booking ${row.id} with studio ${row.studio_id} to junction table`);
        try {
          await db.execute(sql`
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
  } finally {
    await pool.end();
  }
}

main();