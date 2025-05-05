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

# Set the UI version environment variable
echo "UI_VERSION=1.5.1" >> .env
echo "Setting UI version to 1.5.1 with optimized calendar spacing"

echo "Database setup complete!"