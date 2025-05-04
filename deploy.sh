#!/bin/bash
set -e

# BookStud.io Deployment Script
echo "┌─────────────────────────────────────────────┐"
echo "│          BookStud.io Deployment             │"
echo "└─────────────────────────────────────────────┘"

# Ensure correct permissions on scripts
chmod +x docker-entrypoint.sh
chmod +x scripts/*.sh

# Stopping any existing containers
echo "Stopping any existing containers..."
docker-compose down || true

# Building and starting BookStud.io
echo "Building and starting BookStud.io..."
docker-compose up -d --build

# Wait for the application to be ready
echo "Waiting for the application to start..."
attempt=0
max_attempts=30
until $(curl --output /dev/null --silent --head --fail http://localhost:${APP_PORT:-3000}/health); do
  if [ ${attempt} -eq ${max_attempts} ]; then
    echo "Maximum attempts reached. Application might not be running properly."
    break
  fi
  
  attempt=$(($attempt+1))
  echo "Waiting for application to be ready... (${attempt}/${max_attempts})"
  sleep 5
done

if [ ${attempt} -lt ${max_attempts} ]; then
  echo "┌─────────────────────────────────────────────┐"
  echo "│      BookStud.io deployment complete!       │"
  echo "│                                             │"
  echo "│  Application is running at:                 │"
  echo "│  http://localhost:${APP_PORT:-3000}         │"
  echo "└─────────────────────────────────────────────┘"
else
  echo "┌─────────────────────────────────────────────┐"
  echo "│      Deployment completed with warnings     │"
  echo "│                                             │"
  echo "│  The application might not be fully ready.  │"
  echo "│  Check logs with: docker-compose logs -f    │"
  echo "└─────────────────────────────────────────────┘"
fi