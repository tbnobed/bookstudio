// Import using ES module syntax
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function migrateDb() {
  console.log('Creating database tables...');
  
  try {
    // Create users table
    console.log('Creating users table...');
    await db.execute(sql`
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
    await db.execute(sql`
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
    
    // Create templates table
    console.log('Creating templates table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        duration INTEGER NOT NULL,
        crew_required JSONB DEFAULT '[]',
        equipment JSONB DEFAULT '[]',
        created_by INTEGER NOT NULL,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Templates table created successfully!');
    
    // Create bookings table
    console.log('Creating bookings table...');
    await db.execute(sql`
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
    await db.execute(sql`
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
    await db.execute(sql`
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
    await db.execute(sql`
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
    await db.execute(sql`
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