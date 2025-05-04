#!/bin/bash
set -e

# Script to wait for the database to be ready

# Constants
MAX_RETRIES=30
RETRY_INTERVAL=3

# Parse DATABASE_URL to extract connection parameters
if [ -n "$DATABASE_URL" ]; then
  DB_HOST=$(echo $DATABASE_URL | sed -E 's/.*@([^:]+)(:[0-9]+)?\/.*/\1/')
  DB_PORT=$(echo $DATABASE_URL | sed -E 's/.*:([0-9]+)\/.*/\1/')
  DB_NAME=$(echo $DATABASE_URL | sed -E 's/.*\/([^?]+).*/\1/')
  DB_USER=$(echo $DATABASE_URL | sed -E 's/.*:\/\/([^:]+):.*/\1/')
  DB_PASS=$(echo $DATABASE_URL | sed -E 's/.*:\/\/[^:]+:([^@]+).*/\1/')
else
  # Fall back to individual environment variables
  DB_HOST=${PGHOST:-db}
  DB_PORT=${PGPORT:-5432}
  DB_NAME=${POSTGRES_DB:-bookstuio}
  DB_USER=${POSTGRES_USER:-postgres}
  DB_PASS=${POSTGRES_PASSWORD:-postgres}
fi

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."

# Function to check if PostgreSQL is ready
check_postgres() {
  PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1" >/dev/null 2>&1
  return $?
}

# Retry loop for the database connection
retry_count=0

while [ $retry_count -lt $MAX_RETRIES ]; do
  if check_postgres; then
    echo "Successfully connected to PostgreSQL!"
    exit 0
  else
    echo "Waiting for PostgreSQL to be ready, attempt ${retry_count}/${MAX_RETRIES}"
    retry_count=$((retry_count + 1))
    sleep $RETRY_INTERVAL
  fi
done

echo "ERROR: Failed to connect to PostgreSQL after ${MAX_RETRIES} attempts"
exit 1