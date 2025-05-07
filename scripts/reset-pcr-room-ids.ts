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
 * Resets PCR room IDs to start from 1
 * This script:
 * 1. Creates a temporary table
 * 2. Copies data with new IDs
 * 3. Updates any related bookings
 * 4. Drops the original table
 * 5. Renames the new table
 * 6. Resets the sequence
 */
async function resetPcrRoomIds() {
  try {
    console.log("Starting PCR room ID reset...");

    // Check if there are any PCR rooms with bookings
    const bookingsWithPcrRooms = await db.execute(sql`
      SELECT COUNT(*) as count FROM bookings WHERE pcr_room_id IS NOT NULL
    `);
    
    const hasPcrBookings = parseInt(bookingsWithPcrRooms.rows[0].count) > 0;
    
    if (hasPcrBookings) {
      console.log("There are bookings with PCR rooms assigned. Creating mapping table...");
      
      // Create a mapping table to track old and new IDs
      await db.execute(sql`
        CREATE TEMPORARY TABLE pcr_id_map (
          old_id INTEGER PRIMARY KEY,
          new_id INTEGER NOT NULL
        )
      `);
    }

    // Get all PCR rooms ordered by name (for consistent new IDs)
    const pcrRooms = await db.execute(sql`
      SELECT id, name, description, status FROM pcr_rooms ORDER BY name
    `);
    
    console.log(`Found ${pcrRooms.rows.length} PCR rooms to process`);
    
    // Create a temporary table with the same structure
    await db.execute(sql`
      CREATE TABLE pcr_rooms_new (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'available'
      )
    `);
    
    // Insert the rooms with new sequential IDs
    for (let i = 0; i < pcrRooms.rows.length; i++) {
      const room = pcrRooms.rows[i];
      const newId = i + 1; // New ID starting from 1
      
      await db.execute(sql`
        INSERT INTO pcr_rooms_new (id, name, description, status)
        VALUES (${newId}, ${room.name}, ${room.description}, ${room.status})
      `);
      
      if (hasPcrBookings) {
        // Store the mapping for later booking updates
        await db.execute(sql`
          INSERT INTO pcr_id_map (old_id, new_id) VALUES (${room.id}, ${newId})
        `);
      }
      
      console.log(`Migrated PCR room: ${room.name} from ID ${room.id} to ID ${newId}`);
    }
    
    if (hasPcrBookings) {
      // Update bookings to use the new PCR room IDs
      await db.execute(sql`
        UPDATE bookings b
        SET pcr_room_id = m.new_id
        FROM pcr_id_map m
        WHERE b.pcr_room_id = m.old_id
      `);
      
      console.log("Updated all bookings with new PCR room IDs");
    }

    // Drop the original table and rename the new one
    await db.execute(sql`DROP TABLE pcr_rooms`);
    await db.execute(sql`ALTER TABLE pcr_rooms_new RENAME TO pcr_rooms`);
    
    // Reset the sequence to the next ID
    await db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('pcr_rooms', 'id'), 
        (SELECT COALESCE(MAX(id), 0) + 1 FROM pcr_rooms), 
        false
      )
    `);
    
    // Add foreign key constraint back
    await db.execute(sql`
      ALTER TABLE bookings 
      ADD CONSTRAINT bookings_pcr_room_id_fkey 
      FOREIGN KEY (pcr_room_id) REFERENCES pcr_rooms(id) ON DELETE SET NULL
    `);
    
    console.log("PCR room IDs have been reset successfully!");
  } catch (error) {
    console.error("Error in PCR room ID reset:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

resetPcrRoomIds().catch((err) => {
  console.error("PCR room ID reset failed:", err);
  process.exit(1);
});