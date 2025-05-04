#!/bin/bash
# Enhanced simple entrypoint script for Docker with better error handling and verification
set -e

# Function to handle errors
handle_error() {
  echo "========================================"
  echo "ERROR during application startup: $1"
  echo "========================================"
  
  # Test database connection
  if [ -n "$DATABASE_URL" ]; then
    echo "Testing database connection..."
    if PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h ${PGHOST:-db} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-bookstuio} -c '\q' 2>/dev/null; then
      echo "Database connection is working."
    else
      echo "FAILED: Could not connect to database."
      echo "Check database configuration and ensure database container is running."
    fi
  else
    echo "DATABASE_URL is not set. Check environment variables."
  fi
  
  exit 1
}

# Set up trap to catch errors
trap 'handle_error "$BASH_COMMAND"' ERR

echo "========================================"
echo "BookStud.io Application Startup"
echo "========================================"

# Check if we're in the correct directory
if [ ! -f "dist/index.js" ]; then
  echo "Error: Cannot find dist/index.js. Are we in the correct directory?"
  echo "Current directory: $(pwd)"
  echo "Directory contents: $(ls -la dist/)"
  exit 1
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

# Check if we have a DATABASE_URL environment variable
if [ -z "$DATABASE_URL" ]; then
  echo "WARNING: DATABASE_URL is not set. Make sure database connection details are provided."
  echo "Continuing with default connection parameters..."
fi

# Check if we have a SENDGRID_API_KEY environment variable
if [ -z "$SENDGRID_API_KEY" ]; then
  echo "WARNING: SENDGRID_API_KEY is not set. Email notifications will not work."
fi

# Show info about environment
echo "Environment: ${NODE_ENV:-development}"
echo "Application port: ${PORT:-3000}"
if [ -n "$SENDGRID_API_KEY" ]; then
  echo "SendGrid email service initialized"
fi

# Start the application
echo "========================================"
echo "Starting the BookStud.io application..."
echo "========================================"
exec node dist/index.js