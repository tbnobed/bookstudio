#!/bin/bash
set -e

# Flag to identify Docker environment
export IS_DOCKER=true

# Wait for PostgreSQL database to be ready
echo "Waiting for PostgreSQL to be ready..."

# Try to use wait-for-db.sh script first
if [ -f "/app/scripts/wait-for-db.sh" ]; then
  chmod +x /app/scripts/wait-for-db.sh
  if /app/scripts/wait-for-db.sh; then
    echo "PostgreSQL is ready (using wait-for-db.sh)."
  else
    echo "wait-for-db.sh failed, falling back to built-in check..."
    DB_READY=false
  fi
else
  echo "wait-for-db.sh not found, using built-in database check..."
  DB_READY=false
fi

# Fallback database connection check
if [ "$DB_READY" = "false" ]; then
  MAX_RETRIES=30
  RETRY_INTERVAL=3
  
  # Use environment variables to build connection params
  DB_HOST=${PGHOST:-db}
  DB_PORT=${PGPORT:-5432}
  DB_NAME=${PGDATABASE:-bookstuio}
  DB_USER=${PGUSER:-postgres}
  DB_PASS=${PGPASSWORD:-postgres}
  
  echo "Checking PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  
  # Retry loop for database connection
  for i in $(seq 1 $MAX_RETRIES); do
    echo "Attempt $i/$MAX_RETRIES: Checking PostgreSQL connection..."
    if PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1" >/dev/null 2>&1; then
      echo "Successfully connected to PostgreSQL!"
      DB_READY=true
      break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
      echo "Failed to connect to PostgreSQL after $MAX_RETRIES attempts"
      exit 1
    fi
    
    sleep $RETRY_INTERVAL
  done
fi

echo "PostgreSQL is ready."

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