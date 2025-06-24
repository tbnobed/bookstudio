/**
 * Database migration script optimized for Docker environments
 * This is a CommonJS version of the migrate-db.ts script
 */
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

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

// Connect and log
pool.connect()
  .then(client => {
    client.release();
    console.log('Database connection established successfully');
  })
  .catch(err => {
    console.error('Initial database connection failed:', err);
  });

// Register error handler
pool.on('error', (err) => {
  console.error('Unexpected database connection error:', err);
});

// Initialize DB (without schema which we don't need to reference)
const db = drizzle(pool);

async function migrateDb() {
  console.log('Creating database tables...');
  
  try {
    // Create users table
    console.log('Creating users table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      );
    `);
    console.log('Users table created successfully!');
    
    // Create studios table
    console.log('Creating studios table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS studios (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        location TEXT,
        status TEXT DEFAULT 'available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        attributes JSONB
      );
    `);
    console.log('Studios table created successfully!');
    
    // Create templates table with complete current schema
    console.log('Creating templates table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'production',
        duration INTEGER NOT NULL DEFAULT 120,
        start_time TEXT,
        end_time TEXT,
        studio_ids JSONB DEFAULT '[]',
        pcr_room_id INTEGER,
        status TEXT DEFAULT 'confirmed',
        color TEXT,
        notify_list JSONB DEFAULT '[]',
        created_by INTEGER NOT NULL DEFAULT 1
      );
    `);
    console.log('Templates table created successfully!');
    
    // Create bookings table
    console.log('Creating bookings table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        studio_id INTEGER REFERENCES studios(id),
        user_id INTEGER REFERENCES users(id) NOT NULL,
        start TIMESTAMP NOT NULL,
        "end" TIMESTAMP NOT NULL,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'medium',
        template_id INTEGER REFERENCES templates(id),
        notify_list JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Bookings table created successfully!');
    
    // Create notification_groups table
    console.log('Creating notification_groups table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notification_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        group_type TEXT NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT TRUE
      );
    `);
    console.log('Notification_groups table created successfully!');
    
    // Create notifications table
    console.log('Creating notifications table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        booking_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Notifications table created successfully!');

    // Create password_reset_tokens table
    console.log('Creating password_reset_tokens table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        expires TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('Password reset tokens table created successfully!');

    // Create invite_tokens table
    console.log('Creating invite_tokens table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS invite_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        email TEXT NOT NULL,
        expires TIMESTAMP NOT NULL,
        created_by INTEGER REFERENCES users(id) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used BOOLEAN DEFAULT FALSE
      );
    `);
    console.log('Invite tokens table created successfully!');
    
    console.log('All database tables created successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateDb()
  .then(() => {
    console.log('Database migration completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error during migration:', error);
    process.exit(1);
  });