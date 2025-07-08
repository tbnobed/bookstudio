const { Pool } = require('pg');

// Check for required environment variables
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create a database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrateBookingStatus() {
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    console.log('Checking if status column exists in bookings table...');
    
    // Check if status column exists
    const { rows } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'status'
    `);
    
    if (rows.length === 0) {
      console.log('Status column does not exist. Adding it to bookings table...');
      
      // Add status column with a default value of 'confirmed'
      await client.query(`
        ALTER TABLE bookings 
        ADD COLUMN status TEXT DEFAULT 'confirmed'
      `);
      
      console.log('Status column added successfully with default value of "confirmed"');
    } else {
      console.log('Status column already exists in bookings table.');
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Database migration for booking status completed successfully');
    
  } catch (error) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    // Release the client back to the pool
    client.release();
  }
}

// Run the migration
migrateBookingStatus()
  .then(() => {
    console.log('Booking status migration completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });