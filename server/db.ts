import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection parameters with extended timeouts for improved reliability
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 60000,        // Increased from 30000
  connectionTimeoutMillis: 20000,  // Increased from 5000 to handle slower connections
  statement_timeout: 60000,        // Add statement timeout to prevent hanging queries
  query_timeout: 60000,            // Add query timeout
});

// Implement connection with retry logic
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

function connectWithRetry(retries = MAX_RETRIES): Promise<void> {
  return pool.connect()
    .then(client => {
      client.release();
      console.log('Database connection established successfully');
    })
    .catch(err => {
      console.error(`Database connection attempt failed (${MAX_RETRIES - retries + 1}/${MAX_RETRIES}):`, err);
      
      if (retries > 0) {
        console.log(`Retrying database connection in ${RETRY_DELAY_MS/1000} seconds...`);
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(connectWithRetry(retries - 1));
          }, RETRY_DELAY_MS);
        });
      } else {
        console.error('Maximum database connection retries exceeded');
        // Don't exit the process, the app will still handle API requests that don't require DB
      }
    });
}

// Start connection process with retry
connectWithRetry();

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
