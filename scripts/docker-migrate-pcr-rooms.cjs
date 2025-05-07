/**
 * PCR rooms migration script optimized for Docker environments
 * This is a CommonJS version of the migrate-pcr-rooms.ts script
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

async function migratePcrRooms() {
  try {
    console.log("Starting PCR rooms migration...");

    // Create the PCR rooms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "pcr_rooms" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'available'
      );
    `);
    console.log("Created PCR rooms table");

    // Add the pcrRoomId column to bookings table
    await pool.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "pcr_room_id" INTEGER
      REFERENCES "pcr_rooms"("id") ON DELETE SET NULL;
    `);
    console.log("Added pcrRoomId column to bookings table");

    // Create some initial PCR rooms
    await pool.query(`
      INSERT INTO "pcr_rooms" ("name", "description", "status")
      VALUES 
        ('PCR 1', 'Main Production Control Room', 'available'),
        ('PCR 2', 'Secondary Production Control Room', 'available'),
        ('PCR 3', 'Tertiary Production Control Room', 'available')
      ON CONFLICT ("name") DO NOTHING;
    `);
    console.log("Added initial PCR rooms data");

    console.log("PCR rooms migration completed successfully!");
  } catch (error) {
    console.error("Error in PCR rooms migration:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
migratePcrRooms().catch((err) => {
  console.error("PCR rooms migration failed:", err);
  process.exit(1);
});