# BookStud.io Offline Deployment Guide

This guide provides instructions for deploying BookStud.io in environments with limited or no internet connectivity using our offline-capable deployment process.

## Overview

The offline deployment approach:
- Uses a specially designed Dockerfile that avoids network requests
- Leverages host networking for improved connectivity within your network
- Sets up NPM to operate in offline mode to avoid dependency downloads
- Provides robust error-handling and database initialization

## Prerequisites

- Docker and Docker Compose installed on the host machine
- Git to clone the repository (or a downloaded copy of the codebase)
- Minimal network connectivity to clone the repository (one-time only)
- PostgreSQL credentials for the database

## Deployment Steps

### 1. Prepare the Environment

```bash
# Create a directory for the application
mkdir -p /opt/bookstudio
cd /opt/bookstudio

# Create directories for persistent data and backups
mkdir -p data/postgres
mkdir -p uploads
mkdir -p logs
mkdir -p backups

# Set appropriate permissions
chmod -R 755 uploads logs
```

### 2. Copy or Clone the Repository

If you have the codebase already available as a ZIP or tarball:

```bash
# Extract the files into the directory
tar -xzf bookstudio.tar.gz -C /opt/bookstudio
# OR
unzip bookstudio.zip -d /opt/bookstudio
```

If you need to clone from a repository (requires connectivity):

```bash
git clone https://github.com/your-org/bookstudio.git /opt/bookstudio
cd /opt/bookstudio
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cat > .env << 'EOF'
# Database settings
PGUSER=postgres
PGPASSWORD=your_secure_password
PGDATABASE=bookstudio
PGHOST=localhost
PGPORT=5432

# Application settings
PORT=5000
NODE_ENV=production
TZ=America/Chicago
FACILITY_TIMEZONE=America/Chicago

# Session settings
SESSION_SECRET=your_secure_session_secret
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax

# Email settings (if using SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_VERIFIED_SENDER=support@your-domain.com

# Deployment settings
VERSION=1.4.1
SUPPORT_SITE_MANAGER_ROLE=true
EOF
```

### 4. Set Up for Offline Deployment

```bash
# Make sure you're in the application directory
cd /opt/bookstudio

# Use offline-capable production configuration
cp Dockerfile.offline Dockerfile
cp docker-compose.host.yml docker-compose.yml
```

### 5. Build and Start the Application

```bash
# Build the Docker images (this will use the offline-capable approach)
docker-compose build

# Start the application in detached mode
docker-compose up -d
```

### 6. Monitor the Deployment

```bash
# Watch the logs to ensure everything starts correctly
docker-compose logs -f

# Check container status
docker-compose ps
```

### 7. Verify the Application

- Access the application at `http://your-server-ip:5000`
- Log in with the default admin account (username: `admin`, password: `admin`)
- Change the default password immediately for security

## Troubleshooting

### Database Issues

If you encounter database issues during startup:

```bash
# Access the database directly
docker exec -it bookstudio_db psql -U postgres -d bookstudio

# Run the comprehensive database fix script
docker exec -it bookstudio_app node scripts/fix-db-all.js
```

### Container Build Failures

If the container build still fails:

```bash
# Check build logs
docker-compose logs --no-color db-init > build-logs.txt
cat build-logs.txt | grep -i error

# Use the emergency offline build script if provided
./emergency-offline-build.sh
```

### Runtime Errors

For runtime errors or application issues:

```bash
# Check application logs
docker-compose logs -f app

# Restart the application if necessary
docker-compose restart app
```

## Maintenance

### Backing Up the Database

```bash
# Create a database backup
docker exec bookstudio_db pg_dump -U postgres bookstudio > /opt/bookstudio/backups/db_backup_$(date +%Y%m%d%H%M%S).sql
```

### Restoring from Backup

```bash
# Stop the application
docker-compose down

# Start just the database
docker-compose up -d db

# Wait for the database to be ready
sleep 10

# Restore from backup
cat /opt/bookstudio/backups/your-backup-file.sql | docker exec -i bookstudio_db psql -U postgres bookstudio

# Restart the application
docker-compose up -d
```

## Automatic Deployment Script

For convenience, you can use our automated deployment script:

```bash
# Make the script executable
chmod +x deploy-production.sh

# Run the deployment script
./deploy-production.sh
```

This script will:
1. Check prerequisites
2. Back up the database if an existing installation is found
3. Configure the offline-capable build environment
4. Build and start the containers
5. Verify the deployment

## Reference: Configuration Files

### docker-compose.host.yml
This file configures the Docker Compose deployment with host networking for maximum compatibility.

### Dockerfile.offline
This Dockerfile is specifically designed to avoid network requests during the build process, making it suitable for environments with limited internet connectivity.

---

For additional help or custom configurations, please refer to the application documentation or contact your system administrator.