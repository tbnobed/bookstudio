// Script to add status column to bookings table
import { config } from 'dotenv';
import { Pool } from 'pg';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Load environment variables
config();

neonConfig.webSocketConstructor = ws;

async function addStatusColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Connecting to database...');
    
    // Check if status column already exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'status'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('Status column already exists. No changes needed.');
      return;
    }
    
    // Add status column with default value 'confirmed'
    console.log('Adding status column to bookings table...');
    await pool.query(`
      ALTER TABLE bookings 
      ADD COLUMN status TEXT DEFAULT 'confirmed' NOT NULL
    `);
    
    console.log('Status column added successfully!');
  } catch (error) {
    console.error('Error adding status column:', error);
  } finally {
    await pool.end();
  }
}

addStatusColumn().catch(console.error);