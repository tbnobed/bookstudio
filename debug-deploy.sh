#!/bin/bash
set -e

echo "┌─────────────────────────────────────────────┐"
echo "│     BookStud.io Debug Deployment Tool       │"
echo "└─────────────────────────────────────────────┘"

# Stop any running containers
echo "[INFO] Stopping any existing containers..."
docker-compose down || echo "[WARNING] Failed to stop containers, but continuing"

# Build and start the application
echo "[INFO] Building and starting BookStud.io in debug mode..."
docker-compose up -d --build

# Show container status
echo "[INFO] Container status:"
docker-compose ps

# Show network information
echo "[INFO] Docker network information:"
docker network ls
docker network inspect bookstuio-network

# Print information about the app container
echo "[INFO] Checking app container network settings:"
docker inspect bookstuio-app | grep -A 20 "NetworkSettings"

# Check if port 3000 is actually being listened to
echo "[INFO] Checking port bindings:"
docker exec bookstuio-app netstat -tulpn | grep LISTEN

# Check env variables
echo "[INFO] Checking container environment variables:"
docker exec bookstuio-app env | sort

# Test the health endpoint directly
echo "[INFO] Testing health endpoint from inside container:"
docker exec bookstuio-app wget -O - http://localhost:3000/health || echo "Failed to access health endpoint"

# Print container logs
echo "[INFO] Container logs:"
docker-compose logs app

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│      Debug information collected            │"
echo "│                                             │"
echo "│  Check logs with:                           │"
echo "│  docker-compose logs -f app                 │"
echo "└─────────────────────────────────────────────┘"