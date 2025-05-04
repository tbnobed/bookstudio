#!/bin/bash
# BookStud.io Complete Docker Cleanup Script
# This script thoroughly cleans all Docker resources related to the application
# to ensure a fresh start for the deployment process

set -e

echo "========================================================="
echo "BookStud.io Docker Environment Cleanup"
echo "========================================================="

# Function to display section headers
section() {
  echo
  echo "-----------------------------------------------------------"
  echo "$1"
  echo "-----------------------------------------------------------"
}

# Stop all running containers
section "Stopping any existing containers"
docker-compose down --remove-orphans || echo "No running containers to stop"

# Check for any other running containers that might be related
CONTAINERS=$(docker ps -a --filter name=bookstuio --format "{{.ID}}" 2>/dev/null || echo "")
if [ -n "$CONTAINERS" ]; then
  echo "Found additional containers with 'bookstuio' in the name, removing them..."
  docker rm -f $CONTAINERS 2>/dev/null || echo "Failed to remove some containers"
fi

# Remove all related networks
section "Cleaning up Docker networks"
NETWORKS=$(docker network ls --filter name=bookstuio --format "{{.ID}}" 2>/dev/null || echo "")
if [ -n "$NETWORKS" ]; then
  echo "Found networks related to BookStud.io, removing them..."
  docker network rm $NETWORKS 2>/dev/null || echo "Failed to remove some networks"
fi

# Remove all volumes to ensure clean data
section "Cleaning up Docker volumes"
VOLUMES=$(docker volume ls --filter name=bookstuio --format "{{.Name}}" 2>/dev/null || echo "")
if [ -n "$VOLUMES" ]; then
  echo "Found volumes related to BookStud.io, removing them..."
  docker volume rm $VOLUMES 2>/dev/null || echo "Failed to remove some volumes"
fi

# Clean up any dangling images to free space
section "Cleaning up dangling Docker images"
docker image prune -f

# Remove specific images related to the app
IMAGES=$(docker images --filter reference="*bookstuio*" --format "{{.ID}}" 2>/dev/null || echo "")
if [ -n "$IMAGES" ]; then
  echo "Found images related to BookStud.io, removing them..."
  docker rmi -f $IMAGES 2>/dev/null || echo "Failed to remove some images"
fi

# Clean up build artifacts
section "Cleaning up build artifacts"
rm -rf dist node_modules .cache

# Run npm install to ensure dependencies are up to date
section "Reinstalling npm dependencies"
npm ci || npm install

# Rebuild the application
section "Building the application from scratch"
npm run build

echo
echo "========================================================="
echo "Cleanup complete! You can now run ./deploy.sh to start fresh"
echo "========================================================="