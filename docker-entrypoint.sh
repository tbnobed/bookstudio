#!/bin/bash
set -e

# First, wait for PostgreSQL to start
echo "Waiting for PostgreSQL to start..."
./wait-for-postgres.sh db 5432

echo "PostgreSQL is up and running at db:5432 - executing command"

# Run initialization script to create tables
echo "Initializing database schema and tables..."
npm run db:push

# Run migration for notification groups
echo "Setting up notification groups..."
node scripts/migrate-db.js

# Seed initial data
echo "Seeding initial data..."
node scripts/init-db.js

echo "Database initialization complete!"

# Initialize SendGrid email service
echo "SendGrid email service initialized"

# Finally, start the application
echo "Starting the application..."
exec node dist/index.js