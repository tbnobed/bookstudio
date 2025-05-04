#!/bin/bash
set -e

echo "Running database initialization..."
docker exec bookstuio-app npm run db:push
echo "Running migration for notification groups..."
docker exec bookstuio-app node scripts/migrate-db.js
echo "Seeding initial data..."
docker exec bookstuio-app node scripts/init-db.js
echo "Database initialization complete!"