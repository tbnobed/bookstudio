#!/bin/bash
set -e

echo "========================================"
echo "BookStud.io Deployment Script"
echo "========================================"

# Ensure scripts are executable
echo "Making scripts executable..."
chmod +x wait-for-postgres.sh
chmod +x init-db-docker.sh

# Stop any existing containers
echo "Stopping any existing containers..."
docker-compose down

# Build the containers without cache
echo "Building and starting BookStud.io..."
docker-compose build --no-cache
docker-compose up -d

# Wait for containers to start fully
echo "Waiting for containers to start..."
sleep 10

# Run database initialization
echo "Initializing database..."
./init-db-docker.sh

echo "========================================"
echo "Deployment complete!"
echo "BookStud.io should now be accessible at http://localhost:3000"
echo "========================================"