#!/bin/bash
# Enhanced database initialization script with better error handling and container verification
set -e

echo "========================================"
echo "BookStud.io Database Initialization"
echo "========================================"

# Global timeout settings
MAX_RETRIES=5
SLEEP_TIME=5
TOTAL_WAIT_TIME=60

# Function to log messages with timestamp
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to display error and exit
error_exit() {
  log "ERROR: $1"
  log "$2"
  exit 1
}

# Function to check if a container is running
check_container() {
  local container_name="$1"
  local retry_count=0
  
  log "Verifying container '$container_name' status..."
  
  while [ $retry_count -lt $MAX_RETRIES ]; do
    if docker ps | grep -q "$container_name"; then
      log "Container '$container_name' is running."
      return 0
    else
      retry_count=$((retry_count + 1))
      log "Container '$container_name' is not running. Retry $retry_count/$MAX_RETRIES..."
      
      # Check if it exists but is not running
      if docker ps -a | grep -q "$container_name"; then
        log "Container '$container_name' exists but is not running. Attempting to start it..."
        docker start "$container_name" || log "Failed to start container '$container_name'"
      fi
      
      sleep $SLEEP_TIME
    fi
  done
  
  error_exit "Container '$container_name' is not running after $MAX_RETRIES attempts." \
             "Run 'docker-compose up -d' to start all containers."
}

# Function to verify database connection
check_database() {
  local retry_count=0
  local db_username="${1:-postgres}"
  local db_name="${2:-bookstuio}"
  
  log "Verifying database connection to '$db_name' with user '$db_username'..."
  
  while [ $retry_count -lt $MAX_RETRIES ]; do
    local db_ready
    db_ready=$(docker exec bookstuio-db pg_isready -U "$db_username" -d "$db_name" 2>/dev/null || echo "not_ready")
    
    if [[ "$db_ready" != *"not_ready"* ]]; then
      log "Database is ready and accepting connections."
      
      # Extra verification - try a simple query
      if docker exec bookstuio-db psql -U "$db_username" -d "$db_name" -c "SELECT 1" >/dev/null 2>&1; then
        log "Database connection verified with a test query."
        return 0
      else
        log "Database is accepting connections but test query failed."
      fi
    fi
    
    retry_count=$((retry_count + 1))
    log "Database not ready. Retry $retry_count/$MAX_RETRIES..."
    sleep $SLEEP_TIME
  done
  
  error_exit "Database is not responding after $MAX_RETRIES attempts." \
             "Check database logs with: docker-compose logs bookstuio-db"
}

# Function to run a command in the app container with retries
run_in_app_container() {
  local command="$1"
  local description="$2"
  local retry_count=0
  
  log "Running: $description..."
  
  while [ $retry_count -lt $MAX_RETRIES ]; do
    if docker exec bookstuio-app $command; then
      log "Successfully completed: $description"
      return 0
    else
      retry_count=$((retry_count + 1))
      log "Failed: $description. Retry $retry_count/$MAX_RETRIES..."
      sleep $SLEEP_TIME
    fi
  done
  
  error_exit "Failed to complete: $description after $MAX_RETRIES attempts." \
             "Check application logs with: docker-compose logs bookstuio-app"
}

# Main execution flow

# Step 1: Verify containers are running
check_container "bookstuio-db"
check_container "bookstuio-app"

# Step 2: Verify database connection
check_database "postgres" "bookstuio"

log "All prerequisites verified. Proceeding with database initialization..."

# Step 3: Create schema tables using Drizzle
run_in_app_container "npm run db:push" "Creating database schema"

# Step 4: Prepare ES module compatibility for database initialization
log "Preparing ES module compatibility for database initialization..."
run_in_app_container "mkdir -p /app/scripts/db-es 2>/dev/null || true" "Creating db-es directory"
run_in_app_container "sh -c 'for file in /app/scripts/db.js /app/scripts/migrate-db.js /app/scripts/init-db.js; do if [ -f \$file ]; then chmod +x \$file; else echo \"File \$file not found, will be created if needed\"; fi; done'" "Setting up permissions for existing script files"

# Step 5: Create a specialized ES-compatible database connection file
run_in_app_container "sh -c '[ -f /app/scripts/db-es.js ] && echo \"db-es.js file already exists, skipping creation\" || (cat > /app/scripts/db-es.js << \"EOL\"
#!/usr/bin/env node
// This file is a specialized version for use with ES modules in scripts
import { Pool } from \"pg\";
import { drizzle } from \"drizzle-orm/node-postgres\";
import * as schema from \"../shared/schema.js\";

if (!process.env.DATABASE_URL) {
  throw new Error(
    \"DATABASE_URL must be set. Did you forget to provision a database?\",
  );
}

// PostgreSQL connection for initialization scripts
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
EOL
chmod +x /app/scripts/db-es.js)'" "Creating ES module database connection file"

# Step 6: Update initialization scripts to use the new database connection
run_in_app_container "sh -c 'if [ -f /app/scripts/migrate-db.js ] && [ -f /app/scripts/init-db.js ]; then sed -i \"s|import { db } from \\\"./db.js\\\";|import { db } from \\\"./db-es.js\\\";|g\" /app/scripts/migrate-db.js /app/scripts/init-db.js; else echo \"Migration scripts not found, skipping import updates\"; fi'" "Updating database imports in scripts"

# Step 7: Run migrations for notification groups with ES module compatibility
run_in_app_container "sh -c 'if [ -f /app/scripts/migrate-db.js ]; then node --experimental-specifier-resolution=node scripts/migrate-db.js; else echo \"Migration script not found, skipping migrations\"; fi'" "Running notification group migrations"

# Step 8: Seed initial data with ES module compatibility
run_in_app_container "sh -c 'if [ -f /app/scripts/init-db.js ]; then node --experimental-specifier-resolution=node scripts/init-db.js; else echo \"Initialization script not found, skipping data seeding\"; fi'" "Seeding initial data"

log "========================================"
log "Database initialization complete!"
log "BookStud.io is now accessible at http://localhost:3000"
log "========================================"