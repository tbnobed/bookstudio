#!/bin/bash
set -e

echo "Initializing PostgreSQL database for BookStud.io..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h db -U postgres; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready, creating database..."

# Create database if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE bookstudio;
    GRANT ALL PRIVILEGES ON DATABASE bookstudio TO postgres;
EOSQL

echo "Database initialization completed successfully."