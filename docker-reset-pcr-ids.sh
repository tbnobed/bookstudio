#!/bin/bash

# Exit on any error
set -e

echo "========================================="
echo "PCR Room ID Reset Script - Docker Version"
echo "========================================="
echo

# Check if docker and docker-compose are installed
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo "Error: This script requires both docker and docker-compose to be installed."
    exit 1
fi

echo "This script will reset all PCR room IDs to sequential numbers starting from 1."
echo "It will also update all booking references to use the new IDs."
echo "Make sure your docker containers are running before proceeding."
echo
read -p "Do you want to continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 0
fi

echo "Creating temporary script file..."
cat > reset-pcr-ids-temp.ts << 'EOF'
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
 * 2. Copies data with new IDs (preserving all PCR room information)
 * 3. Updates any related bookings to use the new PCR room IDs
 * 4. Safely drops the original table
 * 5. Renames the new table
 * 6. Resets the sequence to the next available ID
 * 
 * This script fixes the issue where PCR room IDs are much higher than they should be,
 * such as creating PCR room #6 but getting ID 70 in the database.
 */
async function resetPcrRoomIds() {
  try {
    console.log("Starting PCR room ID reset...");

    // Check if there are any PCR rooms with bookings
    const bookingsWithPcrRooms = await db.execute(sql`
      SELECT COUNT(*) as count FROM bookings WHERE pcr_room_id IS NOT NULL
    `);
    
    const hasPcrBookings = parseInt(bookingsWithPcrRooms.rows[0].count) > 0;
    
    // Log detailed information about any bookings with PCR rooms
    if (hasPcrBookings) {
      const bookingsWithPcrDetails = await db.execute(sql`
        SELECT id, title, pcr_room_id FROM bookings 
        WHERE pcr_room_id IS NOT NULL
        ORDER BY id
      `);
      
      console.log("Bookings with PCR rooms assigned:");
      for (const booking of bookingsWithPcrDetails.rows) {
        console.log(`  - Booking ID: ${booking.id}, Title: ${booking.title}, PCR Room ID: ${booking.pcr_room_id}`);
      }
    }
    
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

    // Fix - check if pcr_room_id is a foreign key
    // If so, drop the constraint before dropping the table
    const constraintExists = await db.execute(sql`
      SELECT 1 FROM pg_constraint
      WHERE conname = 'bookings_pcr_room_id_fkey'
      LIMIT 1
    `);
    
    if (constraintExists.rows.length > 0) {
      console.log("Dropping foreign key constraint temporarily...");
      await db.execute(sql`
        ALTER TABLE bookings 
        DROP CONSTRAINT bookings_pcr_room_id_fkey
      `);
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
    console.log("Re-adding foreign key constraint...");
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
EOF

echo "Running the PCR room ID reset script in the Docker container..."
docker-compose exec app node -e "require('tsx/dist/cli').main(['reset-pcr-ids-temp.ts'])"

echo "Cleaning up temporary files..."
rm -f reset-pcr-ids-temp.ts

echo
echo "========================================="
echo "PCR Room ID Reset Completed Successfully!"
echo "========================================="
echo
echo "All PCR room IDs have been reset to sequential numbers starting from 1."
echo "All booking references have been updated to use the new IDs."
echo
echo "You may need to restart your application for changes to take effect."

exit 0