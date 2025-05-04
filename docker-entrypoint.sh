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
    if PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h ${PGHOST:-db} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-bookstuio} -c '\q' 2>/dev/null; then
      echo "Database connection is working."
    else
      echo "FAILED: Could not connect to database."
      echo "Check database configuration and ensure database container is running."
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
echo "BookStud.io Application Startup"
echo "========================================================="

# Check if we're in the correct directory with the correct built files
if [ ! -f "dist/index.js" ]; then
  echo "ERROR: Cannot find dist/index.js. Are we in the correct directory?"
  echo "Current directory: $(pwd)"
  echo "Directory contents of dist/: $(ls -la dist/ 2>/dev/null || echo 'dist/ directory not found')"
  exit 1
fi

echo "Environment: ${NODE_ENV:-development}"
echo "Application port: ${PORT:-3000}"

# Verify required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "WARNING: DATABASE_URL is not set. Using default connection parameters."
fi

# Verify database connection
echo "Verifying database connection..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h ${PGHOST:-db} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-bookstuio} -c '\q' 2>/dev/null; then
    echo "Database connection verified."
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: Failed to connect to database after $MAX_RETRIES attempts."
    echo "Please check that the database container is running and accessible."
    exit 1
  fi
  
  echo "Waiting for database connection (attempt $RETRY_COUNT/$MAX_RETRIES)..."
  sleep 2
done

# Continue with application setup
echo "Database connection confirmed. Starting application setup..."

# Database initialization is now handled by the dedicated db-init container
echo "Database initialization is performed by the db-init container"
echo "Skipping database setup steps in the app container"

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