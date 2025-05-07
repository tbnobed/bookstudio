#!/bin/bash
set -e

# Set timezone for consistent date/time handling across environments
export TZ=America/Chicago
export FACILITY_TIMEZONE=America/Chicago

# Log timezone information for debugging
echo "Setting timezone to America/Chicago for consistent facility time handling"
date
echo "Current timezone: $(date +%Z)"

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

# Run additional migration scripts for new features
echo "Migrating PCR rooms schema..."
npx tsx scripts/migrate-pcr-rooms.ts

echo "Creating booking-studios junction table..."
npx tsx scripts/create-booking-studios-table.ts

# Migrate file attachments
echo "Migrating file attachments schema..."
npx tsx scripts/migrate-file-attachments.ts

# Seed initial data if needed
echo "Seeding initial data..."
node scripts/init-db.js

echo "Database setup complete!"