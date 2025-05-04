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
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        configuration JSONB
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
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        studio_id INTEGER REFERENCES studios(id),
        user_id INTEGER REFERENCES users(id),
        template_id INTEGER REFERENCES templates(id),
        status TEXT DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
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
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id),
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notification_type TEXT NOT NULL,
        related_id INTEGER,
        metadata JSONB
      );
    `);
    console.log('Notifications table created successfully!');
    
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