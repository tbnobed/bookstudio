#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until node --input-type=module -e "
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
try {
  await pool.query('SELECT 1');
  console.log('PostgreSQL is ready');
  process.exit(0);
} catch (err) {
  console.error('PostgreSQL connection error:', err);
  process.exit(1);
}
" > /dev/null 2>&1; do
  echo "PostgreSQL is not ready yet - waiting..."
  sleep 2
done

# Run database migrations
echo "Running database migrations..."
NODE_ENV=production node --input-type=module scripts/migrate-db.js

# Initialize first-time data (admin user, default studios, etc.) if needed
echo "Initializing application data if needed..."
NODE_ENV=production node --input-type=module scripts/init-db.js

# Start the server
echo "Starting BookStud.io application server..."
if [ -f "dist/index.js" ]; then
  # First check if the built server exists
  exec node --input-type=module dist/index.js
elif [ -f "server/docker-index.js" ]; then
  # Fall back to the Docker-specific server entry point
  exec node --input-type=module server/docker-index.js
else
  echo "Error: No server entry point found!"
  exit 1
fi