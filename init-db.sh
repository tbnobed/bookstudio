#!/bin/bash
set -e

# Wait for PostgreSQL to start
echo "Waiting for PostgreSQL to start..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h db -U $POSTGRES_USER -d $POSTGRES_DB -c '\q'; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL started"

# Run migrations
echo "Running database migrations..."
npm run db:push

# Seed initial data if needed
echo "Seeding initial data..."
node scripts/init-db.js

echo "Database setup complete!"