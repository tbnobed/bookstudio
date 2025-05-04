#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until node -e "
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
pool.query('SELECT 1').then(() => {
  console.log('PostgreSQL is ready');
  process.exit(0);
}).catch(err => {
  console.error('PostgreSQL connection error:', err);
  process.exit(1);
});
" > /dev/null 2>&1; do
  echo "PostgreSQL is not ready yet - waiting..."
  sleep 2
done

# Run database migrations
echo "Running database migrations..."
NODE_ENV=production node scripts/migrate-db.js

# Initialize first-time data (admin user, default studios, etc.) if needed
echo "Initializing application data if needed..."
NODE_ENV=production node scripts/init-db.js

# Start the server
echo "Starting BookStud.io application server..."
exec node dist/server/index.js