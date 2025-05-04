#!/bin/bash
set -e

# Set explicit environment variables for the application
export PORT=3000
export HOST=0.0.0.0

# Start the application with exec to replace the shell process
# This ensures the container stays running as long as the app does
echo "[INFO] Starting application on $HOST:$PORT"
exec node dist/index.js