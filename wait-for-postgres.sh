#!/bin/bash
# Enhanced wait-for-postgres.sh script with better error handling and timeout
# Usage: ./wait-for-postgres.sh hostname port [-t timeout] [-- command args...]

set -e

# Initialize variables
HOST="$1"
PORT="$2"
shift 2

TIMEOUT=60
QUIET=0
COMMAND=()

# Process optional parameters
while [ $# -gt 0 ]; do
  case "$1" in
    -t|--timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    -q|--quiet)
      QUIET=1
      shift
      ;;
    --)
      shift
      COMMAND=("$@")
      break
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Function to log messages unless quiet mode is enabled
log() {
  if [ "$QUIET" -ne 1 ]; then
    echo "$@"
  fi
}

# Function to check if PostgreSQL is ready
is_postgres_ready() {
  # Use netcat to check if the port is open
  if nc -z -w1 "$HOST" "$PORT" > /dev/null 2>&1; then
    # Additional check to verify PostgreSQL is actually responding
    if PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h "$HOST" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -c '\q' > /dev/null 2>&1; then
      return 0  # Success - PostgreSQL is ready
    fi
  fi
  return 1  # Not ready yet
}

# Main wait loop with timeout
log "Waiting for PostgreSQL at $HOST:$PORT (timeout: ${TIMEOUT}s)..."
start_time=$(date +%s)

while true; do
  if is_postgres_ready; then
    end_time=$(date +%s)
    elapsed=$((end_time - start_time))
    log "PostgreSQL is ready after ${elapsed}s at $HOST:$PORT"
    break
  fi
  
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))
  
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    log "Timeout after ${TIMEOUT}s waiting for PostgreSQL at $HOST:$PORT"
    exit 1
  fi
  
  sleep 1
done

# Execute command if provided
if [ ${#COMMAND[@]} -gt 0 ]; then
  log "Executing command: ${COMMAND[*]}"
  exec "${COMMAND[@]}"
fi