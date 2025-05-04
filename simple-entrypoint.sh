#!/bin/bash
# Simple entrypoint script for Docker that only starts the application
# Database initialization is now handled by the db-init container
set -e

echo "========================================"
echo "BookStud.io Application Startup"
echo "========================================"

# Check if we have a DATABASE_URL environment variable
if [ -z "$DATABASE_URL" ]; then
  echo "WARNING: DATABASE_URL is not set. Make sure database connection details are provided."
  echo "Continuing with default connection parameters..."
fi

# Check if we have a SENDGRID_API_KEY environment variable
if [ -z "$SENDGRID_API_KEY" ]; then
  echo "WARNING: SENDGRID_API_KEY is not set. Email notifications will not work."
fi

# Show info about environment
echo "Environment: ${NODE_ENV:-development}"
echo "Application port: ${PORT:-3000}"
echo "SendGrid email service initialized"

# Start the application
echo "========================================"
echo "Starting the BookStud.io application..."
echo "========================================"
exec node dist/server.js