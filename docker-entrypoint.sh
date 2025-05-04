#!/bin/bash
set -e

# Flag to identify Docker environment
export IS_DOCKER=true

# Wait for PostgreSQL database to be ready
if [ -f "/app/scripts/wait-for-db.sh" ]; then
  echo "Waiting for PostgreSQL to be ready..."
  chmod +x /app/scripts/wait-for-db.sh
  /app/scripts/wait-for-db.sh
  echo "PostgreSQL is ready."
fi

# Run database migrations if needed
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npm run db:push
  echo "Database migrations completed."
fi

# Initialize database if needed
if [ "$INIT_DATABASE" = "true" ]; then
  echo "Initializing database..."
  node --experimental-specifier-resolution=node scripts/init-db.js
  echo "Database initialization completed."
fi

# Execute the command passed to the script
exec "$@"