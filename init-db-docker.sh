#!/bin/bash
# Enhanced database initialization script with better error handling and container verification
set -e

echo "========================================"
echo "BookStud.io Database Initialization"
echo "========================================"

# Verify containers are running - don't skip this check
echo "Verifying Docker containers..."
if ! docker ps | grep -q bookstuio-db; then
  echo "ERROR: Database container 'bookstuio-db' is not running"
  echo "Run 'docker-compose up -d' first"
  exit 1
fi

if ! docker ps | grep -q bookstuio-app; then
  echo "ERROR: Application container 'bookstuio-app' is not running"
  echo "Run 'docker-compose up -d' first"
  exit 1
fi

# Verify PostgreSQL is ready to accept connections
echo "Verifying database connection..."
DB_READY=$(docker exec bookstuio-db pg_isready -U postgres -d bookstuio 2>/dev/null || echo "not_ready")
if [[ "$DB_READY" == *"not_ready"* ]]; then
  echo "Waiting for PostgreSQL to become available..."
  sleep 5
  DB_READY=$(docker exec bookstuio-db pg_isready -U postgres -d bookstuio 2>/dev/null || echo "not_ready")
  if [[ "$DB_READY" == *"not_ready"* ]]; then
    echo "ERROR: Database is not responding. Please check database logs:"
    echo "docker-compose logs bookstuio-db"
    exit 1
  fi
fi

echo "Database is ready. Proceeding with initialization..."

# Step 1: Create schema tables using Drizzle
echo "Creating database schema..."
if ! docker exec bookstuio-app npm run db:push; then
  echo "ERROR: Failed to create database schema."
  echo "Check application logs: docker-compose logs bookstuio-app"
  exit 1
fi

# Step 2: Run migrations for notification groups
echo "Running notification group migrations..."
if ! docker exec bookstuio-app node scripts/migrate-db.js; then
  echo "ERROR: Failed to run notification group migrations."
  echo "Check application logs: docker-compose logs bookstuio-app"
  exit 1
fi

# Step 3: Seed initial data
echo "Seeding initial data..."
if ! docker exec bookstuio-app node scripts/init-db.js; then
  echo "ERROR: Failed to seed initial data."
  echo "Check application logs: docker-compose logs bookstuio-app"
  exit 1
fi

echo "========================================"
echo "Database initialization complete!"
echo "BookStud.io is now accessible at http://localhost:3000"
echo "========================================"