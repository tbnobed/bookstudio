import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
// Use relative import as fallback if path alias doesn't work
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection parameters with better timeouts for Docker environments
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased for Docker networking
});

// Log successful connection
pool.connect()
  .then(client => {
    client.release();
    console.log('Database connection established successfully');
  })
  .catch(err => {
    console.error('Initial database connection failed:', err);
    // Don't exit the process - let the application continue to retry
  });

// Register error handler for unexpected disconnections
pool.on('error', (err) => {
  console.error('Unexpected database connection error:', err);
  // The pool will automatically attempt to recover
});

export const db = drizzle(pool, { schema });

// Helper functions for database operations
export async function ensureConnection() {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}
