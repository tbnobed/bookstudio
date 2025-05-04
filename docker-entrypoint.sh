#!/bin/bash
set -e

echo "=== BookStud.io Application Startup ==="

# Set Docker environment flag
export IS_DOCKER=true

# Define helper functions
log_info() {
  echo "[INFO] $1"
}

log_warning() {
  echo "[WARNING] $1"
}

log_error() {
  echo "[ERROR] $1"
}

log_success() {
  echo "[SUCCESS] $1"
}

# Database connection parameters
DB_HOST=${PGHOST:-db}
DB_PORT=${PGPORT:-5432}
DB_NAME=${PGDATABASE:-bookstuio}
DB_USER=${PGUSER:-postgres}
DB_PASS=${PGPASSWORD:-postgres}

# Set DATABASE_URL if not already set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
  log_info "DATABASE_URL was not set, using constructed value: ${DATABASE_URL}"
fi

# Wait for database to be ready
wait_for_db() {
  local max_attempts=30
  local retry_interval=3
  local attempt=1
  
  log_info "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  
  while [ $attempt -le $max_attempts ]; do
    log_info "Attempt $attempt/$max_attempts: Connecting to database..."
    
    if PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1" >/dev/null 2>&1; then
      log_success "Successfully connected to PostgreSQL database!"
      return 0
    fi
    
    # Don't sleep on the last attempt
    if [ $attempt -eq $max_attempts ]; then
      log_error "Could not connect to database after $max_attempts attempts"
      return 1
    fi
    
    attempt=$((attempt+1))
    sleep $retry_interval
  done
}

# Running database migrations
run_migrations() {
  log_info "Running database schema migrations..."
  
  if npm run db:push; then
    log_success "Database schema migrations completed successfully"
    return 0
  else
    log_error "Failed to run database migrations"
    return 1
  fi
}

# Initialize database with seed data if needed
init_database() {
  log_info "Checking if database needs initialization..."
  
  # Run a simple query to check if users table has any records
  USER_COUNT=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users" 2>/dev/null || echo "0")
  
  if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" -eq "0" ]; then
    log_info "Database appears to be empty or users table doesn't exist yet. Initializing with seed data..."
    
    if node scripts/init-db.js; then
      log_success "Database initialization completed successfully"
      return 0
    else
      log_error "Failed to initialize database with seed data"
      return 1
    fi
  else
    log_info "Database already contains data (found $USER_COUNT users). Skipping initialization."
    return 0
  fi
}

# Main initialization sequence
main() {
  # Step 1: Wait for database
  if ! wait_for_db; then
    log_error "Database connection failed. Cannot proceed."
    exit 1
  fi
  
  # Step 2: Run migrations
  if ! run_migrations; then
    log_error "Database migration failed. Cannot proceed."
    exit 1
  fi
  
  # Step 3: Initialize database if needed
  if ! init_database; then
    log_warning "Database initialization failed, but continuing anyway."
    # We don't exit here as this is not necessarily fatal
  fi
  
  # Step 4: Run the main application
  log_info "Starting BookStud.io application..."
  exec "$@"
}

# Run the main function
main