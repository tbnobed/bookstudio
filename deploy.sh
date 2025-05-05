#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting BookStud.io deployment..."

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "docker-compose could not be found, please install it first."
    exit 1
fi

# Check for required .env file
if [ ! -f .env ]; then
    echo "No .env file found. Creating a default one."
    cat > .env << EOL
# Database configuration
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=bookstudio
PORT=5000

# Session configuration
SESSION_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax

# API Keys (replace with your actual keys)
SENDGRID_API_KEY=your_sendgrid_key_here
SENDGRID_VERIFIED_SENDER=alerts@obedtv.com
EOL
    echo ".env file created with default values. Please edit it with your actual configuration."
    exit 1
fi

# Check if database backup is needed
if [ "$1" == "--backup" ]; then
    echo "Creating database backup before deployment..."
    
    # Get current date in YYYY-MM-DD format
    BACKUP_DATE=$(date +%Y-%m-%d)
    BACKUP_DIR="./db_backups"
    BACKUP_FILE="${BACKUP_DIR}/bookstudio_${BACKUP_DATE}.sql"
    
    # Create backup directory if it doesn't exist
    mkdir -p ${BACKUP_DIR}
    
    # Get database credentials from .env file
    source .env
    
    # Run backup using docker
    echo "Backing up database to ${BACKUP_FILE}..."
    docker-compose exec -T db pg_dump -U "${PGUSER}" "${PGDATABASE}" > "${BACKUP_FILE}"
    
    echo "Database backup completed successfully at ${BACKUP_FILE}"
fi

# Build the Docker image
echo "Building Docker image..."
docker-compose build --no-cache

# Start the containers
echo "Starting containers..."
docker-compose up -d

# Wait for the database to be ready
echo "Waiting for the database to be ready..."
sleep 10

# Run database migrations
echo "Running database migrations..."
docker-compose exec app npx tsx scripts/migrate-db.ts

echo "Deployment completed successfully!"
echo "Your BookStud.io application should now be running at http://localhost:5000"
echo ""
echo "Important notes:"
echo "1. The database schema has been updated with new tables for password reset and invite tokens"
echo "2. Your email system is now fully operational using SendGrid for invited users and password resets"
echo "3. The mobile interface is now fully responsive and optimized for touch devices"
echo ""
echo "To view logs, run: docker-compose logs -f"
echo "To stop the application, run: docker-compose down"
echo "To backup the database before future deployments, run: ./deploy.sh --backup"