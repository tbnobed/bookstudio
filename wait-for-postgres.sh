#!/bin/sh
# wait-for-postgres.sh

set -e

host="$1"
port="$2"
shift 2
cmd="$@"

until nc -z -v -w30 "$host" "$port"; do
  echo "Waiting for PostgreSQL at $host:$port..."
  sleep 2
done

echo "PostgreSQL is up and running at $host:$port - executing command"
exec $cmd