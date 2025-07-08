/**
 * Migration to add color field to bookings table
 */
import { db, pool } from "../server/db";
import { bookings } from "../shared/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Starting migration: Adding color field to bookings table");
  
  try {
    // Check if the column already exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'color';
    `);
    
    if (checkResult.rowCount === 0) {
      console.log("Column 'color' doesn't exist. Adding it to the bookings table...");
      
      // Add the color column to the bookings table
      await db.execute(sql`
        ALTER TABLE bookings 
        ADD COLUMN color TEXT;
      `);
      
      console.log("Successfully added 'color' column to bookings table");
    } else {
      console.log("Column 'color' already exists in bookings table. Skipping migration.");
    }
    
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});