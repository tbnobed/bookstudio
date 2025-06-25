#!/bin/bash

echo "=== Docker Build Debug Script ==="
echo "Timestamp: $(date)"

echo "=== Current .env file contents ==="
cat .env | grep VITE_ || echo "No VITE_ vars found in .env"

echo "=== Building with enhanced debugging ==="
docker-compose down
docker-compose build --no-cache app 2>&1 | tee docker-build.log

echo "=== Searching build log for environment variables ==="
grep -A 5 -B 5 "Environment Check\|VITE\|Found .env" docker-build.log || echo "No environment debug output found"

echo "=== Starting containers ==="
docker-compose up -d

echo "=== Build complete ==="
echo "Check docker-build.log for full build output"