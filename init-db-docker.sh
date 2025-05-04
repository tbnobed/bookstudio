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

# Step 4: Prepare CommonJS compatibility for database initialization
log "Preparing CommonJS database compatibility for Docker environment..."
run_in_app_container "chmod +x /app/scripts/*.cjs 2>/dev/null || true" "Setting permissions for CommonJS scripts"

# Step 5: Copy pre-created CommonJS schema file if needed
run_in_app_container "bash -c \"if [ ! -f /app/shared/schema.cjs ]; then cp /app/scripts/schema.cjs /app/shared/ 2>/dev/null || echo 'Schema file not copied - this is expected on first run'; fi\"" "Setting up CommonJS schema"

# Step 7: Run migrations with CommonJS scripts (more compatible with Docker environment)
run_in_app_container "bash -c \"if [ -f /app/scripts/migrate-db.cjs ]; then node scripts/migrate-db.cjs; else echo 'CommonJS migration script not found, skipping migrations'; fi\"" "Running notification group migrations"

# Step 8: Seed initial data with CommonJS scripts
run_in_app_container "bash -c \"if [ -f /app/scripts/init-db.cjs ]; then node scripts/init-db.cjs; else echo 'CommonJS initialization script not found, skipping data seeding'; fi\"" "Seeding initial data"

log "========================================"
log "Database initialization complete!"
log "BookStud.io is now accessible at http://localhost:3000"
log "========================================"