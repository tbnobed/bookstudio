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

async function migrateBookingColors() {
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    console.log('Checking if color column exists in bookings table...');
    
    // Check if color column exists
    const { rows } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'color'
    `);
    
    if (rows.length === 0) {
      console.log('Color column does not exist. Adding it to bookings table...');
      
      // Add color column with a default value
      await client.query(`
        ALTER TABLE bookings 
        ADD COLUMN color TEXT DEFAULT '#3B82F6'
      `);
      
      console.log('Color column added successfully with default blue color (#3B82F6)');
    } else {
      console.log('Color column already exists in bookings table.');
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Database migration completed successfully');
    
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
migrateBookingColors()
  .then(() => {
    console.log('Booking colors migration completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });