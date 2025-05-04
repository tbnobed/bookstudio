#!/bin/bash

# Print debugging information
echo "Starting health check at $(date)"
echo "Checking environment variables:"
echo "HOST: $HOST"
echo "PORT: $PORT"

# Try to fetch the /health endpoint with verbose output
echo "Attempting to connect to health endpoint..."
response=$(wget -v -O - http://localhost:3000/health 2>&1 || echo "FAILED")
echo "Response from health check: $response"

# Also try with 0.0.0.0 explicitly
echo "Attempting to connect via 0.0.0.0..."
response2=$(wget -v -O - http://0.0.0.0:3000/health 2>&1 || echo "FAILED")
echo "Response from 0.0.0.0 health check: $response2"

if [[ "$response" == *"healthy"* ]] || [[ "$response2" == *"healthy"* ]]; then
  # If response contains "healthy", exit with 0 (success)
  echo "Health check passed!"
  exit 0
else
  # Otherwise, exit with 1 (failure)
  echo "Health check failed!"
  exit 1
fi