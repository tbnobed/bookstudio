#!/bin/bash
set -e

#############################################
# BookStud.io Deployment Script
#############################################

print_banner() {
  echo "┌─────────────────────────────────────────────┐"
  echo "│          BookStud.io Deployment             │"
  echo "└─────────────────────────────────────────────┘"
}

print_success() {
  echo "┌─────────────────────────────────────────────┐"
  echo "│      BookStud.io deployment complete!       │"
  echo "│                                             │"
  echo "│  Application is running at:                 │"
  echo "│  http://localhost:${APP_PORT:-3000}         │"
  echo "└─────────────────────────────────────────────┘"
}

print_warning() {
  echo "┌─────────────────────────────────────────────┐"
  echo "│      Deployment completed with warnings     │"
  echo "│                                             │"
  echo "│  The application might not be fully ready.  │"
  echo "│  Check logs with: docker-compose logs -f    │"
  echo "└─────────────────────────────────────────────┘"
}

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

# Print the main banner
print_banner

# Ensure scripts have correct permissions
log_info "Setting correct permissions for scripts..."
chmod +x docker-entrypoint.sh
find ./scripts -name "*.sh" -exec chmod +x {} \; || true

# Check for running containers and stop them
log_info "Checking for existing containers..."
if docker-compose ps -q | grep -q .; then
  log_info "Stopping existing containers..."
  docker-compose down || log_warning "Failed to stop some containers, but continuing anyway"
else
  log_info "No existing containers found"
fi

# Pull latest images (if using pre-built images)
# log_info "Pulling latest Docker images..."
# docker-compose pull || log_warning "Failed to pull some images, will try to use local versions"

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
    print_warning
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
print_success