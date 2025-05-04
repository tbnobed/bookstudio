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
sleep 5  # Short wait to ensure containers are registered

if ! docker ps | grep -q bookstuio-app; then
  log "ERROR: Application container failed to start"
  docker-compose logs app
  exit 1
fi

if ! docker ps | grep -q bookstuio-db; then
  log "ERROR: Database container failed to start"
  docker-compose logs db
  exit 1
fi

# Check if db-init container completed successfully
log "Checking database initialization container status..."
if ! docker ps -a | grep -q "bookstuio-db-init.*Exited (0)"; then
  log "ERROR: Database initialization container did not complete successfully"
  docker-compose logs db-init
  log "If problems persist in development, try running: ./cleanup.sh"
  exit 1
fi

# Wait for DB to be ready - using a more reliable approach than just sleeping
log "Waiting for database to be ready..."
RETRIES=15  # Increased retries for more patience
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $RETRIES ]; do
  if docker exec bookstuio-db pg_isready -U postgres -d bookstuio &> /dev/null; then
    log "Database is ready."
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -eq $RETRIES ]; then
    log "Error: Database failed to become ready after multiple attempts"
    log "If problems persist in development, try running: ./cleanup.sh"
    docker-compose logs db
    exit 1
  fi
  
  log "Waiting for database to become ready (attempt $RETRY_COUNT/$RETRIES)..."
  sleep 3
done

# No need to prepare CommonJS files anymore, volumes will mount directly
log "Using Docker volumes for direct script access, no file manipulation needed..."

# Database initialization is now handled by the db-init container
log "Database initialization will be performed by the db-init container..."
# No need to manually run initialization scripts anymore

# Verify application is responding
log "Verifying application is responding..."
RETRIES=10  # Increased retries for more patience
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $RETRIES ]; do
  if curl -s http://localhost:3000 > /dev/null; then
    log "Application is responding."
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -eq $RETRIES ]; then
    log "Warning: Application is not responding on http://localhost:3000"
    log "Check application logs with: docker-compose logs app"
    
    # Print recent logs to help diagnose issues
    log "Recent application logs:"
    docker-compose logs --tail=20 app
    log "If problems persist in development, try running: ./cleanup.sh"
  fi
  
  log "Waiting for application to respond (attempt $RETRY_COUNT/$RETRIES)..."
  sleep 5  # Increased wait time
done

log "=============================================="
log "Deployment complete!"
log "BookStud.io is now accessible at http://localhost:3000"
log "=============================================="