#!/bin/bash

# Try to fetch the /health endpoint
response=$(wget -q -O - http://localhost:3000/health || echo "FAILED")

if [[ "$response" == *"ok"* ]]; then
  # If response contains "ok", exit with 0 (success)
  exit 0
else
  # Otherwise, exit with 1 (failure)
  exit 1
fi