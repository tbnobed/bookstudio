#!/bin/bash
set -e

# Set explicit environment variables for the application
export PORT=3000
export HOST=0.0.0.0

# Start the application and capture its exit code
echo "[INFO] Starting application on $HOST:$PORT"
npm run start

# If we get here, the application has exited
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "[ERROR] Application exited with code $EXIT_CODE"
  # Exit with the same code to ensure the container also fails
  exit $EXIT_CODE
fi