#!/bin/bash
set -e

echo "Waiting for Docker containers to start..."
sleep 5

echo "Checking container status..."
CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' bookstuio-app)
if [ "$CONTAINER_STATUS" != "running" ]; then
  echo "ERROR: Container bookstuio-app is not running. Current status: $CONTAINER_STATUS"
  echo "Checking Docker logs for errors..."
  docker logs bookstuio-app
  exit 1
fi

echo "Running database initialization..."
docker exec bookstuio-app npm run db:push
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to push database schema"
  exit 1
fi

echo "Running migration for notification groups..."
docker exec bookstuio-app node scripts/migrate-db.js
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to run notification group migration"
  exit 1
fi

echo "Seeding initial data..."
docker exec bookstuio-app node scripts/init-db.js
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to seed initial data"
  exit 1
fi

echo "Database initialization complete!"
echo "BookStud.io should now be accessible at http://localhost:3000"