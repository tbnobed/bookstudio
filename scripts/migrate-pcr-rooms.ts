// Support both Docker and local development environments
let db, pool;
try {
  // Try Docker path first (absolute path)
  const dockerDb = require('/app/server/db');
  db = dockerDb.db;
  pool = dockerDb.pool;
  console.log('Using Docker database connection');
} catch (error) {
  // Fall back to local development path (relative path)
  const localDb = require('../server/db');
  db = localDb.db;
  pool = localDb.pool;
  console.log('Using local development database connection');
}
import { sql } from "drizzle-orm";

/**
 * Apply the PCR room schema changes to the database
 */
async function migratePcrRooms() {
  try {
    console.log("Starting PCR rooms migration...");

    // Create the PCR rooms table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "pcr_rooms" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'available'
      );
    `);
    console.log("Created PCR rooms table");

    // Add the pcrRoomId column to bookings table
    await db.execute(sql`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "pcr_room_id" INTEGER
      REFERENCES "pcr_rooms"("id") ON DELETE SET NULL;
    `);
    console.log("Added pcrRoomId column to bookings table");

    // Create some initial PCR rooms
    await db.execute(sql`
      INSERT INTO "pcr_rooms" ("name", "description", "status")
      VALUES 
        ('PCR 1', 'Main Production Control Room', 'available'),
        ('PCR 2', 'Secondary Production Control Room', 'available'),
        ('PCR 3', 'Tertiary Production Control Room', 'available')
      ON CONFLICT ("name") DO NOTHING;
    `);
    console.log("Added initial PCR rooms data");
    
    // Reset the sequence to the correct value based on existing data
    // This ensures PCR room IDs will increment correctly
    await db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('pcr_rooms', 'id'), 
        (SELECT COALESCE(MAX(id), 0) + 1 FROM pcr_rooms), 
        false
      );
    `);
    console.log("Reset PCR rooms sequence to correct value");

    console.log("PCR rooms migration completed successfully!");
  } catch (error) {
    console.error("Error in PCR rooms migration:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

migratePcrRooms().catch((err) => {
  console.error("PCR rooms migration failed:", err);
  process.exit(1);
});