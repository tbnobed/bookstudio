#!/bin/bash

# Script to build and deploy the BookStud.io application using the new Docker setup
# This script uses the improved Docker configuration that avoids patching issues

set -e

echo "BookStud.io Production Setup (New Docker Configuration)"
echo "======================================================"
echo

# Function to display help message
show_help() {
  echo "BookStud.io Production Setup Script"
  echo ""
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --help                 Show this help message"
  echo "  --clean-volumes        Remove existing database volumes to start fresh"
  echo ""
}

# Parse command line arguments
CLEAN_VOLUMES=false

for arg in "$@"
do
  case $arg in
    --help)
      show_help
      exit 0
      ;;
    --clean-volumes)
      CLEAN_VOLUMES=true
      shift
      ;;
    *)
      # Unknown option if it starts with --
      if [[ $arg == --* ]]; then
        echo "Unknown option: $arg"
        show_help
        exit 1
      fi
      ;;
  esac
done

# Handle volume cleaning if requested
if [ "$CLEAN_VOLUMES" = true ]; then
  echo "WARNING: You have chosen to clean volumes. This will DELETE ALL DATA in the database."
  read -p "Are you sure you want to continue? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping containers and removing volumes..."
    docker-compose down -v
    docker volume rm bookstudio_postgres_data 2>/dev/null || true
    # Also remove any other potentially conflicting volumes
    docker volume ls | grep 'bookstudio_' | awk '{print $2}' | xargs docker volume rm 2>/dev/null || true
    echo "Volumes cleaned successfully!"
  else
    echo "Operation cancelled."
    exit 0
  fi
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker and Docker Compose first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating default .env file..."
    cat > .env << EOF
# Database configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=bookstudio

# Application configuration
NODE_ENV=production
SESSION_SECRET=change-this-to-a-secure-random-string
PORT=5000

# Email configuration (optional - leave empty if not using email features)
SENDGRID_API_KEY=
SENDGRID_VERIFIED_SENDER=
EOF
    echo "Created .env file with default values. Please edit it with your own configuration."
fi

# Build and run the new Docker setup
echo "Building and starting BookStud.io with the new Docker configuration..."
docker-compose down || true
docker-compose build --no-cache
docker-compose up -d

echo
echo "Waiting for the application to start..."
sleep 10

# Check if the application is running
if docker-compose ps | grep -q "bookstudio-app.*Up"; then
    echo "BookStud.io is now running!"
    echo "You can access it at: http://localhost:5000"
    echo
    echo "Default admin credentials:"
    echo "  Username: admin"
    echo "  Password: admin"
    echo
    echo "IMPORTANT: Please change the admin password after first login."
else
    echo "Something went wrong. The application is not running."
    echo "Check the logs with: docker-compose logs"
    exit 1
fi