#!/bin/bash
set -e

# Set explicit environment variables for the application
export PORT=3000
export HOST=0.0.0.0

# Start the application using the production start script from package.json
echo "[INFO] Starting application on $HOST:$PORT"
npm run start