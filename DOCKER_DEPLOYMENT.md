# BookStud.io Docker Deployment Guide

This document covers the essential Docker Compose commands for deploying and managing BookStud.io, including how to resolve PostgreSQL version compatibility issues.

## Standard Deployment

Deploy with these simple commands:

```bash
# Build all containers
docker compose build

# Start the application
docker compose up -d
```

## Docker Compose Configuration Notes

- The version attribute in docker-compose.yml has been removed as it's considered obsolete in newer Docker Compose versions.
- ES modules are used in Node.js scripts (particularly init-db-prod.js) to align with the project's module system.

## PostgreSQL Version Compatibility

BookStud.io uses PostgreSQL 14 for database storage. The docker-compose.yml explicitly specifies:

```yaml
postgres:
  image: postgres:14-alpine
```

### Handling PostgreSQL Version Mismatch

If you encounter this error:
```
FATAL: database files are incompatible with server
DETAIL: The data directory was initialized by PostgreSQL version 14, which is not compatible with this version 16.8.
```

This happens because:
1. Your existing PostgreSQL volume was created with PostgreSQL 14
2. You're trying to use a newer PostgreSQL version (16) with that data directory
3. PostgreSQL doesn't support major version jumps without a proper migration

### Solutions

#### Option 1: Keep Your Data (Recommended)

Ensure docker-compose.yml uses PostgreSQL 14:

```yaml
postgres:
  image: postgres:14-alpine
```

Then restart:
```bash
docker compose down
docker compose up -d
```

#### Option 2: Fresh Start (Clears All Data)

If you want to start with a clean database:

```bash
# Stop all containers and remove volumes
docker compose down -v

# Remove any lingering volumes
docker volume rm bookstudio_postgres_data 2>/dev/null || true

# Remove any other potentially conflicting volumes
docker volume ls | grep 'bookstudio_' | xargs docker volume rm 2>/dev/null || true

# Rebuild and restart
docker compose build
docker compose up -d
```

## Troubleshooting

### Checking Container Logs

```bash
# View all logs
docker compose logs

# View database logs only
docker compose logs postgres

# View database initialization logs
docker compose logs db-init
```

### Database Backup Before Changes

```bash
# Backup the current database 
docker compose exec postgres pg_dump -U postgres bookstudio > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database Recovery After Failed Upgrade

If you attempted to use PostgreSQL 16 with existing PostgreSQL 14 data and need to recover:

1. Restore the docker-compose.yml to use postgres:14-alpine
2. If you have a backup, restore it:
   ```bash
   # Stop the containers
   docker compose down
   
   # Clear the corrupted volume
   docker volume rm bookstudio_postgres_data
   
   # Start only the database
   docker compose up -d postgres
   
   # Wait for it to be ready
   sleep 5
   
   # Restore the backup
   cat your_backup_file.sql | docker compose exec -T postgres psql -U postgres bookstudio
   
   # Start the rest of the system
   docker compose up -d
   ```

## Keeping PostgreSQL Versions Consistent

For future reference, always use the same major PostgreSQL version (14.x) for compatibility unless you perform a proper database migration. The docker-compose.yml correctly specifies postgres:14-alpine to ensure this consistency.