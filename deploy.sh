#!/bin/bash
set -e

# Display welcome message
echo "======================="
echo "BookStud.io Deployment"
echo "======================="
echo ""

# If .env doesn't exist, copy from example
if [ ! -f .env ]; then
  echo "Creating .env file from .env.example..."
  cp .env.example .env
  echo "Please edit .env file with your configuration settings!"
  exit 1
fi

# Make init script executable
chmod +x init-db.sh

# Check if docker and docker-compose are installed
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed. Please install Docker first."
  echo "Visit https://docs.docker.com/get-docker/ for installation instructions."
  exit 1
fi

if ! command -v docker-compose &> /dev/null; then
  echo "Docker Compose is not installed. Please install Docker Compose first."
  echo "Visit https://docs.docker.com/compose/install/ for installation instructions."
  exit 1
fi

# Stop existing containers if they exist
echo "Stopping any existing containers..."
docker-compose down 2>/dev/null || true

# Build and start the application
echo "Building and starting BookStud.io..."
docker-compose up -d --build

echo ""
echo "===================="
echo "Deployment Complete!"
echo "===================="
echo ""
echo "BookStud.io is now running!"
echo "Access it at: http://localhost:3000"
echo ""
echo "To check logs: docker-compose logs -f"
echo "To stop the application: docker-compose down"