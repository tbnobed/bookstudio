import { migrate } from 'drizzle-orm/postgres-js/migrator';
import pg from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../shared/schema.js';

// Function to run database migrations
async function migrateDb() {
  console.log('Starting database migration...');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('Connecting to the database...');
  const connectionString = process.env.DATABASE_URL;
  // For migrations, we need a direct connection with more control
  const migrationClient = pg(connectionString, { max: 1 });
  
  try {
    console.log('Creating database client for migration...');
    const db = drizzle(migrationClient, { schema });
    
    console.log('Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    
    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    // Always close the connection
    await migrationClient.end();
  }
}

// Execute migration immediately
migrateDb();