#!/bin/bash
# Enhanced docker entrypoint script with better error handling and reporting
set -e

# Ensure IS_DOCKER environment variable is set
export IS_DOCKER=true

# Function to handle errors
handle_error() {
  echo "========================================================="
  echo "ERROR during container startup at step: $1"
  echo "========================================================="
  
  if [ -n "$DATABASE_URL" ]; then
    echo "Testing database connection..."
    # First check if port is open
    if nc -z -w1 ${PGHOST:-db} ${PGPORT:-5432} > /dev/null 2>&1; then
      echo "PostgreSQL port is accessible."
      # Then check actual database connection - use SELECT 1 instead of \q to avoid issues
      if PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h ${PGHOST:-db} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-bookstuio} -c "SELECT 1" > /dev/null 2>&1; then
        echo "Database connection is working."
      else
        echo "FAILED: Could establish network connection but PostgreSQL authentication failed."
        echo "Check database credentials and database name."
      fi
    else
      echo "FAILED: Could not connect to database port."
      echo "Check network configuration and ensure database container is running."
    fi
  else
    echo "DATABASE_URL is not set. Make sure environment variables are properly configured."
  fi
  
  # Show system diagnostic information
  diagnose_system
  
  echo "Error details: $2"
  exit 1
}

# Diagnose system and application status
diagnose_system() {
  echo "=== System Diagnosis ==="
  echo "Node version: $(node -v)"
  echo "NPM version: $(npm -v)"
  echo "Environment: $NODE_ENV"
  echo "IS_DOCKER: $IS_DOCKER"
  
  echo "=== Directory Structure ==="
  echo "Contents of root directory:"
  ls -la .
  
  if [ -d "dist" ]; then
    echo "Contents of dist directory:"
    ls -la dist/
  else
    echo "Dist directory not found!"
  fi
  
  if [ -d "server" ]; then
    echo "Contents of server directory:"
    ls -la server/
  else
    echo "Server directory not found!"
  fi
  
  echo "=== Package.json Validation ==="
  if [ -f "package.json" ]; then
    echo "package.json found. Checking build script:"
    grep '"build"' package.json
  else
    echo "package.json not found!"
  fi
}

# Find a valid entry point for the server
find_server_entry() {
  # Check for built server entry points in priority order
  if [ -f "dist/index.js" ]; then
    echo "Found primary entry point: dist/index.js"
    export SERVER_ENTRY="dist/index.js"
    return 0
  elif [ -f "dist/server.js" ]; then
    echo "Found secondary entry point: dist/server.js"
    export SERVER_ENTRY="dist/server.js"
    return 0
  elif [ -f "server/index.js" ]; then
    echo "Found server source entry point: server/index.js"
    export SERVER_ENTRY="server/index.js"
    return 0
  else
    # If no JS entry points found, look for TypeScript source as last resort
    if [ -f "server/index.ts" ]; then
      echo "Found TypeScript source: server/index.ts"
      export SERVER_ENTRY="tsx server/index.ts"
      return 0
    fi
    return 1
  fi
}

# Set up trap to catch errors
trap 'handle_error "$BASH_COMMAND" "$?"' ERR

echo "========================================================="
echo "BookStud.io Application Startup"
echo "========================================================="

# Check if we're in the correct directory with the correct built files
if ! find_server_entry; then
  echo "ERROR: Cannot find server entry point files"
  echo "Current directory: $(pwd)"
  diagnose_system
  echo "Attempting to build the application..."
  
  # Try to build the application
  if [ -f "package.json" ]; then
    npm run build || {
      echo "Build failed, cannot start application"
      exit 1
    }
    
    # Check again for entry point
    if ! find_server_entry; then
      echo "ERROR: Still cannot find server entry point after build"
      exit 1
    fi
  else
    echo "ERROR: Cannot find package.json to attempt build"
    exit 1
  fi
fi

echo "Environment: ${NODE_ENV:-development}"
echo "Application port: ${PORT:-3000}"

# Verify required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "WARNING: DATABASE_URL is not set. Using default connection parameters."
fi

# Verify database connection with our helper script
echo "Verifying database connection..."

# Use the wait-for-db.sh script if it exists
if [ -f "scripts/wait-for-db.sh" ]; then
  echo "Using scripts/wait-for-db.sh to validate database connection"
  
  # Ensure it's executable
  chmod +x scripts/wait-for-db.sh
  
  # Run the script
  if ! ./scripts/wait-for-db.sh; then
    echo "ERROR: Failed to connect to database using wait-for-db.sh"
    echo "Please check that the database container is running and accessible."
    exit 1
  fi
else
  # Fallback to the original method if script is not found
  echo "Using fallback method to validate database connection (script not found)"
  
  MAX_RETRIES=15  # Increased retries for more patience
  RETRY_COUNT=0
  
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # First check if port is open
    if nc -z -w1 ${PGHOST:-db} ${PGPORT:-5432} > /dev/null 2>&1; then
      # Then try to actually connect to PostgreSQL - use SELECT 1 instead of \q
      if PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h ${PGHOST:-db} -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-bookstuio} -c "SELECT 1" > /dev/null 2>&1; then
        echo "Database connection verified."
        break
      fi
    fi
    
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
      echo "ERROR: Failed to connect to database after $MAX_RETRIES attempts."
      echo "Please check that the database container is running and accessible."
      exit 1
    fi
    
    echo "Waiting for database connection (attempt $RETRY_COUNT/$MAX_RETRIES)..."
    sleep 3  # Increased to give more time between attempts
  done
fi

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
  echo "Set SENDGRID_API_KEY in your environment or .env file for email functionality."
fi

# Wait for any additional services if needed
echo "Waiting a moment for any remaining services to be ready..."
sleep 3

# Finally, start the application
echo "========================================================="
echo "Starting the BookStud.io application..."
echo "========================================================="

# Use the SERVER_ENTRY we found earlier
if [[ "$SERVER_ENTRY" == *"tsx"* ]]; then
  echo "Running TypeScript server directly with tsx..."
  exec $SERVER_ENTRY
else
  echo "Running compiled JavaScript server..."
  exec node $SERVER_ENTRY
fi