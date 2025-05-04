#!/bin/bash
set -e

# Script to wait for the database to be ready
# This is used by the docker-entrypoint.sh

# Constants
MAX_RETRIES=30
RETRY_INTERVAL=3

# Parse DATABASE_URL to extract connection parameters
# This allows us to use either the individual variables or the DATABASE_URL
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

# Check for the existence of netcat
if command -v nc >/dev/null 2>&1; then
  echo "Using netcat for port checking"
  PORT_COMMAND="nc -z -w1 $DB_HOST $DB_PORT"
else
  echo "Netcat not found, using timeout and telnet/bash dev/tcp fallback"
  if command -v timeout >/dev/null 2>&1; then
    if command -v telnet >/dev/null 2>&1; then
      PORT_COMMAND="timeout 1 telnet $DB_HOST $DB_PORT"
    else
      PORT_COMMAND="timeout 1 bash -c '</dev/tcp/$DB_HOST/$DB_PORT'"
    fi
  else
    echo "Neither netcat nor timeout found, can't check port. Assuming port is open."
    PORT_COMMAND="true"
  fi
fi

# Check for the existence of psql
if command -v psql >/dev/null 2>&1; then
  echo "Using psql for database checking"
  # First try using environment variables for psql
  if PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1" >/dev/null 2>&1; then
    echo "Database connection successful!"
    exit 0
  fi
  
  # Retry loop for the database connection
  retry_count=0
  
  while [ $retry_count -lt $MAX_RETRIES ]; do
    # First check if the port is open
    if eval $PORT_COMMAND >/dev/null 2>&1; then
      echo "Port ${DB_PORT} on host ${DB_HOST} is reachable"
      
      # Then try a simple SELECT query
      if PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1" >/dev/null 2>&1; then
        echo "Successfully connected to database!"
        exit 0
      else
        echo "Port is reachable but the database is not yet accepting connections, attempt ${retry_count}/${MAX_RETRIES}"
      fi
    else
      echo "Waiting for database port to be reachable, attempt ${retry_count}/${MAX_RETRIES}"
    fi
    
    retry_count=$((retry_count + 1))
    sleep $RETRY_INTERVAL
  done
  
  echo "ERROR: Failed to connect to the database after ${MAX_RETRIES} attempts"
  exit 1
else
  echo "psql command not found, can't verify database connection"
  echo "Will assume database is eventually available"
  
  retry_count=0
  # Just check if the port is open
  while [ $retry_count -lt $MAX_RETRIES ]; do
    if eval $PORT_COMMAND >/dev/null 2>&1; then
      echo "Port ${DB_PORT} on host ${DB_HOST} is reachable"
      echo "Assuming database is ready (can't verify with psql)"
      exit 0
    fi
    
    retry_count=$((retry_count + 1))
    echo "Waiting for database port to be reachable, attempt ${retry_count}/${MAX_RETRIES}"
    sleep $RETRY_INTERVAL
  done
  
  echo "WARNING: Could not verify database port after ${MAX_RETRIES} attempts"
  echo "Continuing anyway, but the application might fail to connect"
  exit 1
fi