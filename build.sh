#!/bin/bash
set -e

echo "┌─────────────────────────────────────────────┐"
echo "│        BookStud.io Deployment Tool          │"
echo "└─────────────────────────────────────────────┘"

# Stop any running containers
echo "[INFO] Stopping any existing containers..."
docker-compose down || echo "[WARNING] Failed to stop containers, but continuing"

# Build and start the application
echo "[INFO] Building and starting BookStud.io..."
docker-compose up -d --build

# Show container status
echo "[INFO] Container status:"
docker-compose ps

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│      BookStud.io deployment initiated       │"
echo "│                                             │"
echo "│  Check logs with:                           │"
echo "│  docker-compose logs -f app                 │"
echo "└─────────────────────────────────────────────┘"