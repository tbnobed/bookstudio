#!/bin/bash
# Simple entrypoint script for Docker that only starts the application
# The database initialization is handled separately by init-db-docker.sh
set -e

echo "========================================"
echo "BookStud.io Simple Application Startup"
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

# Start the application - no database initialization here
echo "========================================"
echo "Starting the BookStud.io application..."
echo "========================================"
exec node dist/index.js