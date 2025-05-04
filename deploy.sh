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
  exit 1
}

# Set up trap to catch errors
trap 'handle_error "$BASH_COMMAND"' ERR

# Check for required commands
log "Checking prerequisites..."
check_command docker
check_command docker-compose

# Ensure scripts are executable
log "Making scripts executable..."
chmod +x wait-for-postgres.sh
chmod +x init-db-docker.sh
chmod +x docker-entrypoint.sh 2>/dev/null || true
chmod +x simple-entrypoint.sh 2>/dev/null || true

# Stop any existing containers
log "Stopping any existing containers..."
docker-compose down || true  # Continue even if this fails (e.g., no containers running)

# Clean up any old volumes if needed
log "Cleaning up any stale resources..."
docker volume prune -f || true  # Continue even if this fails

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

# Wait for DB to be ready - using a more reliable approach than just sleeping
log "Waiting for database to be ready..."
RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $RETRIES ]; do
  if docker exec bookstuio-db pg_isready -U postgres -d bookstuio &> /dev/null; then
    log "Database is ready."
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -eq $RETRIES ]; then
    log "Error: Database failed to become ready after multiple attempts"
    docker-compose logs db
    exit 1
  fi
  
  log "Waiting for database to become ready (attempt $RETRY_COUNT/$RETRIES)..."
  sleep 3
done

# Prepare CommonJS files for more reliable database initialization
log "Preparing CommonJS files for database initialization..."
docker exec bookstuio-app /bin/sh -c "mkdir -p /app/scripts /app/shared"

# Copy the CommonJS files that are already in the container via Dockerfile
docker exec bookstuio-app /bin/sh -c "chmod +x /app/scripts/*.cjs"
docker exec bookstuio-app /bin/sh -c "cp /app/scripts/schema.cjs /app/shared/ 2>/dev/null || echo 'Schema file already exists'"

# Run database initialization
log "Running database initialization with enhanced compatibility..."
./init-db-docker.sh

# Verify application is responding
log "Verifying application is responding..."
RETRIES=5
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
  fi
  
  log "Waiting for application to respond (attempt $RETRY_COUNT/$RETRIES)..."
  sleep 3
done

log "=============================================="
log "Deployment complete!"
log "BookStud.io is now accessible at http://localhost:3000"
log "=============================================="