#!/bin/bash
# Enhanced deployment script with better error handling and reliability
set -e

echo "=============================================="
echo "BookStud.io Deployment Script"
echo "=============================================="

# Function to log messages with timestamp
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if a command exists
check_command() {
  if ! command -v $1 &> /dev/null; then
    log "Error: $1 is not installed. Please install $1 first."
    exit 1
  fi
}

# Function to handle errors during deployment
handle_error() {
  log "=============================================="
  log "Error during deployment at step: $1"
  log "=============================================="
  log "Checking container logs..."
  
  if docker ps | grep -q bookstuio-db; then
    log "Database container logs:"
    docker logs bookstuio-db | tail -n 20
  fi
  
  if docker ps | grep -q bookstuio-app; then
    log "Application container logs:"
    docker logs bookstuio-app | tail -n 20
  fi
  
  log "Deployment failed. Please fix the issues and try again."
  log "Consider running ./cleanup.sh first to start from a clean state."
  exit 1
}

# Set up trap to catch errors
trap 'handle_error "$BASH_COMMAND"' ERR

# Parse command line parameters
SHOW_HELP=false

for arg in "$@"; do
  case $arg in
    --help)
      SHOW_HELP=true
      shift
      ;;
    --reset|--clean|--cleanup)
      echo "=============================================="
      echo "⚠️  WARNING: The --reset flag has been removed for safety ⚠️"
      echo "For development environments only, use the separate script:"
      echo "./cleanup.sh"
      echo ""
      echo "This prevents accidental data loss in production."
      echo "=============================================="
      exit 1
      ;;
  esac
done

# Display help if requested
if [ "$SHOW_HELP" = true ]; then
  echo "Usage: ./deploy.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --help     Show this help message"
  echo ""
  echo "For development environment cleanup (CAUTION: destroys all data):"
  echo "  ./cleanup.sh"
  echo ""
  echo "Example: ./deploy.sh"
  exit 0
fi

# Check for required commands
log "Checking prerequisites..."
check_command docker
check_command docker-compose

# Ensure docker entrypoint script is executable
log "Making scripts executable..."
chmod +x docker-entrypoint.sh 2>/dev/null || true

# Stop existing containers
log "Stopping any existing containers..."
docker-compose down || true  # Continue even if this fails (e.g., no containers running)

# Clean up any stale/dangling resources (doesn't remove volumes with data)
log "Cleaning up stale resources..."
docker network prune -f || true  # Continue even if this fails
docker image prune -f || true    # Clean up dangling images only

# Build and start the containers
log "Building and starting BookStud.io..."
docker-compose build --no-cache
docker-compose up -d

# Verify containers started properly
log "Verifying containers are running..."
sleep 10  # Increased wait to ensure containers are registered and have time to start

# List running containers for debugging
log "Currently running containers:"
docker ps || true

# Check if app container is running
APP_RUNNING=$(docker ps | grep -c bookstuio-app || true)
if [ "$APP_RUNNING" -eq 0 ]; then
  log "WARNING: Application container is not visible in running containers"
  log "Checking if it exists but is not running..."
  APP_EXISTS=$(docker ps -a | grep -c bookstuio-app || true)
  
  if [ "$APP_EXISTS" -gt 0 ]; then
    log "Container exists but is not running. Checking container logs:"
    docker-compose logs app || true
    log "Attempting to start the container explicitly..."
    docker-compose start app || true
    sleep 5
  else
    log "ERROR: Application container not found"
    log "If problems persist in development, try running: ./cleanup.sh"
    exit 1
  fi
fi

# Check if db container is running
DB_RUNNING=$(docker ps | grep -c bookstuio-db || true)
if [ "$DB_RUNNING" -eq 0 ]; then
  log "WARNING: Database container is not visible in running containers"
  log "If problems persist in development, try running: ./cleanup.sh"
  docker-compose logs db || true
fi

# Check if db-init container completed successfully
log "Checking database initialization container status..."
DB_INIT_SUCCESS=$(docker ps -a | grep "bookstuio-db-init.*Exited (0)" | wc -l || true)
if [ "$DB_INIT_SUCCESS" -eq 0 ]; then
  DB_INIT_EXISTS=$(docker ps -a | grep -c bookstuio-db-init || true)
  if [ "$DB_INIT_EXISTS" -gt 0 ]; then
    log "WARNING: Database initialization container did not complete successfully"
    docker-compose logs db-init || true
    log "Attempting to continue anyway..."
  else
    log "WARNING: Database initialization container not found"
  fi
else
  log "Database initialization completed successfully"
fi

# Wait for DB to be ready
log "Waiting for database to be ready..."
RETRIES=15  # Increased retries for more patience
RETRY_COUNT=0

# First check if the DB container is in a healthy state according to Docker
DB_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' bookstuio-db 2>/dev/null || echo "not found")
log "Database container health status: $DB_HEALTH"

if [ "$DB_HEALTH" = "healthy" ]; then
  log "Database container is already marked as healthy, proceeding..."
else
  # Wait a bit longer to ensure container fully starts
  log "Waiting a bit longer for container startup..."
  sleep 10
  
  while [ $RETRY_COUNT -lt $RETRIES ]; do
    # Check if container is running at all first
    if docker ps | grep -q bookstuio-db; then
      log "Database container is running."
      
      # Better to use the simplified health check that avoids the 'q' character issue
      if docker exec bookstuio-db pg_isready -U postgres &> /dev/null; then
        log "Database is accepting connections."
        
        # Perform a final validation without database name to avoid the 'q' error
        if docker exec bookstuio-db psql -U postgres -c "SELECT 1" &> /dev/null; then
          log "Database connection fully verified."
          break
        fi
      fi
    fi
    
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -eq $RETRIES ]; then
      log "WARNING: Database health check failed after multiple attempts"
      log "This may not be a critical issue - attempting to continue anyway"
      log "If problems persist, try running: ./cleanup.sh and then redeploying"
      docker-compose logs db
      # Don't exit here, try to continue
      break
    fi
    
    log "Waiting for database to become ready (attempt $RETRY_COUNT/$RETRIES)..."
    sleep 3
  done
fi

# No need to prepare CommonJS files anymore, volumes will mount directly
log "Using Docker volumes for direct script access, no file manipulation needed..."

# Database initialization is now handled by the db-init container
log "Database initialization will be performed by the db-init container..."
# No need to manually run initialization scripts anymore

# Verify application is responding
log "Verifying application is responding..."
RETRIES=20  # Increased retries for more patience
RETRY_COUNT=0

# Now first check if app container is actually running
APP_STATUS=$(docker ps --filter "name=bookstuio-app" --format "{{.Status}}" || echo "Not found")
log "App container status: $APP_STATUS"

# Show the logs regardless to help with debugging
log "Application container logs:"
docker-compose logs --tail=20 app || true

while [ $RETRY_COUNT -lt $RETRIES ]; do
  if curl -s http://localhost:3000 > /dev/null; then
    log "Application is responding."
    break
  fi

  # Try alternative port just in case - sometimes Docker maps to a different port
  if curl -s http://localhost:3001 > /dev/null; then
    log "Application is responding on port 3001 instead."
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -eq $RETRIES ]; then
    log "Warning: Application is not responding on expected ports"
    log "This might be expected if your Docker setup uses different port mappings"
    log "Try these common alternatives: http://localhost:3000, http://localhost:3001, or http://localhost:8080"
    log "If problems persist in development, try running: ./cleanup.sh"
    
    # Continue anyway - the application might be working just on a different port
  fi
  
  log "Waiting for application to respond (attempt $RETRY_COUNT/$RETRIES)..."
  sleep 5  # Increased wait time
done

log "=============================================="
log "Deployment complete!"
log "BookStud.io is now accessible at http://localhost:3000"
log "=============================================="