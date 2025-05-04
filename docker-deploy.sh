#!/bin/bash
set -e

# BookStud.io Docker Deployment Script
echo "┌─────────────────────────────────────────────┐"
echo "│      BookStud.io Docker Deployment          │"
echo "└─────────────────────────────────────────────┘"

# Functions for logging
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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  log_error "Docker is not installed. Please install Docker and try again."
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  log_error "Docker Compose is not installed. Please install Docker Compose and try again."
  exit 1
fi

# Check if Docker service is running
if ! docker info &> /dev/null; then
  log_error "Docker service is not running. Please start the Docker service and try again."
  exit 1
fi

# Stopping any existing containers
log_info "Checking for existing containers..."
if docker-compose ps -q | grep -q .; then
  log_info "Stopping existing containers..."
  docker-compose down || log_warning "Failed to stop some containers, but continuing anyway"
else
  log_info "No existing containers found"
fi

# Build and start the containers
log_info "Building and starting containers..."
if ! docker-compose up -d --build; then
  log_error "Failed to start containers"
  exit 1
fi

# Wait for the application to be ready
log_info "Waiting for the application to start..."
APP_PORT=${APP_PORT:-3000}
HEALTH_URL="http://localhost:${APP_PORT}/health"
attempt=0
max_attempts=30

until $(curl --output /dev/null --silent --head --fail "${HEALTH_URL}"); do
  if [ ${attempt} -eq ${max_attempts} ]; then
    log_warning "Maximum attempts reached. Application health check failed."
    echo "┌─────────────────────────────────────────────┐"
    echo "│      Deployment completed with warnings     │"
    echo "│                                             │"
    echo "│  The application might not be fully ready.  │"
    echo "│  Check logs with: docker-compose logs -f    │"
    echo "└─────────────────────────────────────────────┘"
    exit 1
  fi
  
  attempt=$(($attempt+1))
  log_info "Waiting for application to be ready... (${attempt}/${max_attempts})"
  sleep 5
done

# Display Docker container status
log_info "Container status:"
docker-compose ps

# Verification complete
log_success "Application is up and running!"
echo "┌─────────────────────────────────────────────┐"
echo "│      BookStud.io deployment complete!       │"
echo "│                                             │"
echo "│  Application is running at:                 │"
echo "│  http://localhost:${APP_PORT}               │"
echo "│                                             │"
echo "│  To view logs:                              │"
echo "│  docker-compose logs -f                     │"
echo "│                                             │"
echo "│  To stop the application:                   │"
echo "│  docker-compose down                        │"
echo "└─────────────────────────────────────────────┘"