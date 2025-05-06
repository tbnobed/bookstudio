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

## Docker Compose Configuration

The docker-compose.yml file sets up three main services:

1. **app** - The main application server running on port 5000
2. **db-init** - A one-time initialization container for database setup
3. **db** - PostgreSQL 14 database server

Key features of the configuration:

- Database service name is `db` (not `postgres`)
- Uses explicit service dependencies with healthchecks
- The initialization process uses TypeScript scripts with `tsx` to set up schema properly:
  - `migrate-db.ts` - Core schema setup
  - `migrate-file-attachments.ts` - Attachments support
  - `migrate-pcr-rooms.ts` - Production Control Room schema
  - `create-booking-studios-table.ts` - Junction table for multi-studio bookings
  - `apply-booking-copy.ts` - Functionality to copy bookings
  - `init-db.ts` - Default data creation

## Environment Variables

Several environment variables can be used to configure the deployment:

```
# PostgreSQL Configuration
PGUSER=postgres              # Database username
PGPASSWORD=postgres          # Database password
PGDATABASE=bookstudio        # Database name
PGHOST=db                    # Database hostname (must match service name)
PGPORT=5432                  # Database port

# Application Configuration
PORT=5000                    # Web application port
NODE_ENV=production          # Environment
RUNNING_IN_DOCKER=true       # Docker environment flag
TZ=America/Chicago           # Container timezone
FACILITY_TIMEZONE=America/Chicago  # Location timezone for the facility

# Security
SESSION_SECRET=random-string  # Session cookie encryption key
COOKIE_SECURE=true            # Use secure cookies
COOKIE_SAME_SITE=lax          # SameSite cookie policy

# SendGrid Email Integration
SENDGRID_API_KEY=your-api-key        # SendGrid API
SENDGRID_VERIFIED_SENDER=email@domain.com  # Verified sender address
```

## Multi-Stage Docker Build

The Dockerfile uses a multi-stage build process:

1. **Builder Stage**: Compiles TypeScript and builds the frontend
   - Uses Node.js with build dependencies
   - Copies only necessary source files
   - Builds the application with Vite

2. **Production Stage**: Creates a minimal production image
   - Uses Alpine Linux for a small footprint
   - Only installs production dependencies
   - Sets correct file permissions
   - Runs as an unprivileged user
   - Includes a health check
   - Uses patching to properly handle module imports

## PostgreSQL Version Compatibility

BookStud.io uses PostgreSQL 14 for database storage. The docker-compose.yml explicitly specifies:

```yaml
db:
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
db:
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
docker compose logs db

# View database initialization logs
docker compose logs db-init
```

### Database Backup Before Changes

```bash
# Backup the current database 
docker compose exec db pg_dump -U postgres bookstudio > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database Recovery After Failed Upgrade

If you need to restore from a backup:

```bash
# Stop the containers
docker compose down
   
# Clear the corrupted volume
docker volume rm bookstudio_postgres_data
   
# Start only the database
docker compose up -d db
   
# Wait for it to be ready
sleep 5
   
# Restore the backup
cat your_backup_file.sql | docker compose exec -T db psql -U postgres bookstudio
   
# Start the rest of the system
docker compose up -d
```

## Keeping PostgreSQL Versions Consistent

For future reference, always use the same major PostgreSQL version (14.x) for compatibility unless you perform a proper database migration. The docker-compose.yml correctly specifies postgres:14-alpine to ensure this consistency.