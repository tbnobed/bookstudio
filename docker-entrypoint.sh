#!/bin/bash
set -e

echo "┌─────────────────────────────────────────────┐"
echo "│        BookStud.io Container Startup        │"
echo "└─────────────────────────────────────────────┘"

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

print_success_banner() {
  echo ""
  echo "┌─────────────────────────────────────────────┐"
  echo "│      BookStud.io started successfully!      │"
  echo "│                                             │"
  echo "│  Application is running at port ${PORT:-3000}   │"
  echo "└─────────────────────────────────────────────┘"
  echo ""
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

# Verify environment variables
log_info "Verifying environment variables..."
missing_vars=0

check_env_var() {
  if [ -z "${!1}" ]; then
    log_warning "Environment variable $1 is not set. Using default value if available."
    missing_vars=$((missing_vars + 1))
    return 1
  else
    return 0
  fi
}

check_env_var "DATABASE_URL"
check_env_var "NODE_ENV"
check_env_var "PORT"
check_env_var "HOST"

if [ $missing_vars -gt 0 ]; then
  log_warning "Some environment variables are not set ($missing_vars). Check the logs above for details."
else
  log_success "All required environment variables are properly set."
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

# Check database schema and prepare for migrations
prepare_database() {
  log_info "Checking database schema status..."

  # Check if database is empty (no tables)
  TABLE_COUNT=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'" 2>/dev/null | tr -d ' ' || echo "0")
  
  if [ "$TABLE_COUNT" = "0" ]; then
    log_info "Database appears to be empty (no tables found). Will need to create schema."
    return 0
  else
    log_info "Database has $TABLE_COUNT tables."
    return 0
  fi
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
  log_info "Checking if database needs initialization with seed data..."
  
  # Run a simple query to check if users table has any records
  USER_COUNT=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM users" 2>/dev/null | tr -d ' ' || echo "0")
  
  if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" = "0" ]; then
    log_info "Database has no users. Initializing with seed data..."
    
    if node scripts/init-db.js; then
      log_success "Database initialization completed successfully"
      return 0
    else
      log_error "Failed to initialize database with seed data"
      return 1
    fi
  else
    log_info "Database already contains $USER_COUNT users. Skipping initialization."
    return 0
  fi
}

# Application build process if needed
build_app_if_needed() {
  if [ "$NODE_ENV" = "production" ] && [ ! -d "./dist" ]; then
    log_info "Production environment detected but no dist folder found. Building application..."
    npm run build
    if [ $? -eq 0 ]; then
      log_success "Application built successfully."
      return 0
    else
      log_error "Application build failed."
      return 1
    fi
  else
    log_info "Application is already built or running in development mode."
    return 0
  fi
}

# Main initialization sequence
main() {
  log_info "Starting BookStud.io application initialization..."
  
  # Step 1: Wait for database
  if ! wait_for_db; then
    log_error "Database connection failed. Cannot proceed."
    exit 1
  fi
  
  # Step 2: Prepare database
  if ! prepare_database; then
    log_error "Database preparation failed. Cannot proceed."
    exit 1
  fi
  
  # Step 3: Run migrations
  if ! run_migrations; then
    log_error "Database migration failed. Cannot proceed."
    exit 1
  fi
  
  # Step 4: Initialize database if needed
  if ! init_database; then
    log_warning "Database initialization failed, but continuing anyway."
    # We don't exit here as this is not necessarily fatal
  fi
  
  # Step 5: Build application if needed
  if ! build_app_if_needed; then
    log_error "Application build failed. Cannot proceed."
    exit 1
  fi
  
  # Step 6: Run the main application
  log_info "All initialization steps completed successfully."
  log_info "Starting BookStud.io application..."
  print_success_banner
  
  # Execute the command passed to the script (typically npm run start)
  exec "$@"
}

# Run the main function
main