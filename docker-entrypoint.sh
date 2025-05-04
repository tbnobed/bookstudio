#!/bin/bash
# Enhanced docker entrypoint script with better error handling and reporting
set -e

# Function to handle errors
handle_error() {
  echo "========================================================="
  echo "ERROR during container startup at step: $1"
  echo "========================================================="
  
  if [ -n "$DATABASE_URL" ]; then
    echo "Testing database connection..."
    if pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-bookstuio}" -h "${PGHOST:-db}"; then
      echo "Database connection is working."
    else
      echo "Database connection failed. Check database configuration."
    fi
  else
    echo "DATABASE_URL is not set. Make sure environment variables are properly configured."
  fi
  
  echo "Error details: $2"
  exit 1
}

# Set up trap to catch errors
trap 'handle_error "$BASH_COMMAND" "$?"' ERR

echo "========================================================="
echo "BookStud.io Container Startup"
echo "========================================================="

echo "Environment: ${NODE_ENV:-development}"
echo "Application port: ${PORT:-3000}"

# Verify required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "WARNING: DATABASE_URL is not set. Using default connection parameters."
fi

# Wait for PostgreSQL to start with a timeout
echo "Waiting for PostgreSQL to start..."
timeout_seconds=30
start_time=$(date +%s)

while true; do
  if ./wait-for-postgres.sh db 5432 -t 1 > /dev/null 2>&1; then
    echo "PostgreSQL is up and running at db:5432"
    break
  fi
  
  current_time=$(date +%s)
  elapsed_time=$((current_time - start_time))
  
  if [ $elapsed_time -gt $timeout_seconds ]; then
    echo "ERROR: Timed out waiting for PostgreSQL after ${timeout_seconds} seconds"
    exit 1
  fi
  
  echo "Still waiting for PostgreSQL... (${elapsed_time}s elapsed)"
  sleep 2
done

# Verify database is accessible with a real query
echo "Verifying database access..."
if ! psql -h db -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-bookstuio}" -c "SELECT 1" > /dev/null 2>&1; then
  echo "ERROR: Unable to execute query on database. Check credentials and configuration."
  exit 1
fi

# Continue with application setup
echo "Database connection confirmed. Starting application setup..."

# Run database setup if INITIALIZE_DB is set (or if this is a development environment)
if [ "${INITIALIZE_DB:-true}" = "true" ] || [ "${NODE_ENV:-development}" = "development" ]; then
  # Run initialization script to create tables
  echo "Initializing database schema and tables..."
  npm run db:push || handle_error "Database schema creation" $?
  
  # Run migration for notification groups
  echo "Setting up notification groups..."
  node scripts/migrate-db.js || handle_error "Notification group migration" $?
  
  # Seed initial data
  echo "Seeding initial data..."
  node scripts/init-db.js || handle_error "Data seeding" $?
  
  echo "Database initialization complete!"
else
  echo "Skipping database initialization (INITIALIZE_DB is not set to 'true')"
fi

# Check SendGrid configuration
if [ -n "$SENDGRID_API_KEY" ]; then
  echo "SendGrid API key detected. Email service will be enabled."
else
  echo "WARNING: SENDGRID_API_KEY is not set. Email notifications will not work."
fi

# Finally, start the application
echo "========================================================="
echo "Starting the BookStud.io application..."
echo "========================================================="
exec node dist/index.js