import { db } from '../server/db';
import { notificationGroups } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function migrateDb() {
  console.log('Creating notification_groups table...');
  
  try {
    // Create the notification_groups table
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
    
    console.log('notification_groups table created successfully!');
    
    // Run init-db script to populate default notification groups
    console.log('Running initialization script to create default notification groups...');
    await import('./init-db');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateDb()
  .then(() => {
    console.log('Database migration completed successfully');
    setTimeout(() => process.exit(0), 1000); // Exit after init-db has a chance to complete
  })
  .catch(error => {
    console.error('Error during migration:', error);
    process.exit(1);
  });