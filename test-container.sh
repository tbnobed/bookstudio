#!/bin/bash
set -e

echo "┌─────────────────────────────────────────────┐"
echo "│      BookStud.io Network Testing Tool       │"
echo "└─────────────────────────────────────────────┘"

# Stop any existing test containers
echo "[INFO] Stopping any existing test containers..."
docker-compose -f docker-compose.test.yml down || echo "[WARNING] Failed to stop containers, but continuing"

# Build and start the test environment
echo "[INFO] Starting test environment..."
docker-compose -f docker-compose.test.yml up -d

# Wait a moment for the server to start
echo "[INFO] Waiting for test server to start..."
sleep 5

# Try to connect to the test server
echo "[INFO] Testing connection to container..."
curl -v http://localhost:8080

# Show container logs
echo "[INFO] Test server logs:"
docker-compose -f docker-compose.test.yml logs test-server

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│     Network test completed                  │"
echo "│                                             │"
echo "│  If you see 'Test server running...' above, │"
echo "│  then network connectivity is working.      │"
echo "│                                             │"
echo "│  To stop test containers:                   │"
echo "│  docker-compose -f docker-compose.test.yml down │"
echo "└─────────────────────────────────────────────┘"