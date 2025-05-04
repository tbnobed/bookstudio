#!/bin/bash
# Enhanced deployment script with better error handling and reliability
set -e

echo "=============================================="
echo "BookStud.io Deployment Script"
echo "=============================================="

# Function to check if a command exists
check_command() {
  if ! command -v $1 &> /dev/null; then
    echo "Error: $1 is not installed. Please install $1 first."
    exit 1
  fi
}

# Function to handle errors during deployment
handle_error() {
  echo "=============================================="
  echo "Error during deployment at step: $1"
  echo "=============================================="
  echo "Checking container logs..."
  
  if docker ps | grep -q bookstuio-db; then
    echo "Database container logs:"
    docker logs bookstuio-db | tail -n 20
  fi
  
  if docker ps | grep -q bookstuio-app; then
    echo "Application container logs:"
    docker logs bookstuio-app | tail -n 20
  fi
  
  echo "Deployment failed. Please fix the issues and try again."
  exit 1
}

# Set up trap to catch errors
trap 'handle_error "$BASH_COMMAND"' ERR

# Check for required commands
echo "Checking prerequisites..."
check_command docker
check_command docker-compose

# Ensure scripts are executable
echo "Setting up execution permissions..."
chmod +x wait-for-postgres.sh
chmod +x init-db-docker.sh
chmod +x docker-entrypoint.sh 2>/dev/null || true

# Stop any existing containers
echo "Stopping any existing containers..."
docker-compose down || true  # Continue even if this fails (e.g., no containers running)

# Clean up any old volumes if needed
echo "Cleaning up any stale resources..."
docker volume prune -f || true  # Continue even if this fails

# Build and start the containers
echo "Building and starting BookStud.io..."
docker-compose build --no-cache
docker-compose up -d

# Verify containers started properly
echo "Verifying containers are running..."
sleep 5  # Short wait to ensure containers are registered

if ! docker ps | grep -q bookstuio-app; then
  echo "ERROR: Application container failed to start"
  docker-compose logs app
  exit 1
fi

if ! docker ps | grep -q bookstuio-db; then
  echo "ERROR: Database container failed to start"
  docker-compose logs db
  exit 1
fi

# Wait for DB to be ready - using a more reliable approach than just sleeping
echo "Waiting for database to be ready..."
RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $RETRIES ]; do
  if docker exec bookstuio-db pg_isready -U postgres -d bookstuio &> /dev/null; then
    echo "Database is ready."
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -eq $RETRIES ]; then
    echo "Error: Database failed to become ready after multiple attempts"
    docker-compose logs db
    exit 1
  fi
  
  echo "Waiting for database to become ready (attempt $RETRY_COUNT/$RETRIES)..."
  sleep 3
done

# Run database initialization
echo "Running database initialization..."
./init-db-docker.sh

# Verify application is responding
echo "Verifying application is responding..."
RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $RETRIES ]; do
  if curl -s http://localhost:3000 > /dev/null; then
    echo "Application is responding."
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -eq $RETRIES ]; then
    echo "Warning: Application is not responding on http://localhost:3000"
    echo "Check application logs with: docker-compose logs app"
  fi
  
  echo "Waiting for application to respond (attempt $RETRY_COUNT/$RETRIES)..."
  sleep 3
done

echo "=============================================="
echo "Deployment complete!"
echo "BookStud.io is now accessible at http://localhost:3000"
echo "=============================================="