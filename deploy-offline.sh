#!/bin/bash
# Offline-capable deployment script for BookStud.io
# This script helps deploy the application in environments with limited internet connectivity

# Exit on error
set -e

# Display banner
echo "================================================="
echo "   BookStud.io Offline Deployment - v1.4.1"
echo "================================================="
echo

# Check if running with proper permissions
if [ "$(id -u)" != "0" ]; then
   echo "⚠️  Warning: This script should typically be run with sudo or as root"
   echo "   Some operations may fail without proper permissions"
   echo
   read -p "Continue anyway? (y/n) " -n 1 -r
   echo
   if [[ ! $REPLY =~ ^[Yy]$ ]]; then
       echo "Deployment aborted"
       exit 1
   fi
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH. Please install Docker first."
    exit 1
fi

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed or not in PATH. Please install Docker Compose first."
    exit 1
fi

# Ensure we're in the right directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create necessary directories if they don't exist
echo "📁 Creating necessary directories..."
mkdir -p data/postgres
mkdir -p uploads
mkdir -p logs
mkdir -p backups
chmod -R 755 uploads logs

# Check if previous installation exists
if docker ps -a | grep -q bookstudio_db; then
    echo "🔄 Existing installation detected"
    
    # Ask about backing up
    read -p "Would you like to create a database backup before proceeding? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Creating database backup..."
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        mkdir -p ./backups
        docker exec bookstudio_db pg_dump -U ${PGUSER:-postgres} ${PGDATABASE:-bookstudio} > "./backups/db_backup_$TIMESTAMP.sql"
        echo "✅ Database backup created at ./backups/db_backup_$TIMESTAMP.sql"
    fi
fi

# Copy configuration files
echo "🔧 Setting up offline-capable production configuration..."
cp Dockerfile.offline Dockerfile
cp docker-compose.host.yml docker-compose.yml

# Ensure scripts directory exists
mkdir -p scripts

# Check for .env file and create if needed
if [ ! -f .env ]; then
    echo "⚠️ No .env file found, creating default configuration"
    echo "⚙️ You may want to edit this file after deployment"
    
    cat > .env << 'EOF'
# Database settings
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=bookstudio
PGHOST=localhost
PGPORT=5432

# Application settings
PORT=5000
NODE_ENV=production
TZ=America/Chicago
FACILITY_TIMEZONE=America/Chicago

# Session settings
SESSION_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax

# Deployment settings
VERSION=1.4.1
SUPPORT_SITE_MANAGER_ROLE=true
EOF
    echo "✅ Created default .env file"
fi

# Stopping existing containers if they exist
if docker ps -a | grep -q bookstudio; then
    echo "🛑 Stopping existing containers..."
    docker-compose down || true
    sleep 2
fi

# Build the Docker images with offline-capable approach
echo "🏗️ Building Docker images (this may take a while)..."
docker-compose build --no-cache

# Start the application
echo "🚀 Starting BookStud.io..."
docker-compose up -d

# Check if the application started successfully
echo "🔍 Checking application status..."
sleep 10

if docker ps | grep -q bookstudio_app; then
    echo
    echo "✅ BookStud.io deployed successfully!"
    echo
    echo "📱 You can now access the application at http://localhost:5000"
    echo "🔑 Default login: username 'admin', password 'admin'"
    echo "⚠️ Be sure to change the default password immediately"
    echo 
    echo "📋 View logs with: docker-compose logs -f"
    echo "🛑 Stop with: docker-compose down"
    echo
    echo "For more information, see OFFLINE_DEPLOYMENT_GUIDE.md"
else
    echo "❌ Deployment may have failed. Please check the logs:"
    echo "docker-compose logs -f"
    exit 1
fi