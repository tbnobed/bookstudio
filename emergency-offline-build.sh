#!/bin/bash
# Emergency offline build script for BookStud.io
# This script handles deployment in environments with severe connectivity issues

# Exit on error
set -e

# Display banner
echo "================================================="
echo "   BookStud.io Emergency Offline Build - v1.4.1"
echo "================================================="
echo

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH. Please install Docker first."
    exit 1
fi

echo "⚠️ This is an emergency build process for environments with severe connectivity issues."
echo "⚠️ It bypasses normal build processes and may take longer but requires minimal connectivity."
echo

read -p "Continue with emergency offline build? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment aborted"
    exit 1
fi

# Create a minimal Dockerfile that avoids ALL network operations
cat > Dockerfile.emergency << 'EOF'
# Ultra-minimal Dockerfile for environments with severe connectivity issues
FROM node:20.18.1-alpine3.19

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV TZ=America/Chicago
ENV FACILITY_TIMEZONE=America/Chicago

# Create app directory
WORKDIR /app

# Set timezone
RUN ln -sf /usr/share/zoneinfo/America/Chicago /etc/localtime && \
    echo "America/Chicago" > /etc/timezone

# Create directory structure
RUN mkdir -p /app/client /app/server /app/shared /app/scripts /app/dist /app/uploads /app/logs

# Copy pre-built application (must be provided separately)
COPY . /app/

# Create unprivileged user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app/uploads /app/logs

# Set appropriate permissions
RUN chmod -R 755 /app/uploads /app/logs

# Switch to unprivileged user
USER appuser

# Expose application port
EXPOSE 5000

# Add a basic health check using the file system (no network)
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD test -f /app/dist/index.js || exit 1

# Default command
CMD ["node", "dist/index.js"]
EOF

# Create a minimal docker-compose file
cat > docker-compose.emergency.yml << 'EOF'
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.emergency
    image: bookstudio:emergency
    restart: always
    network_mode: host
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://${PGUSER:-postgres}:${PGPASSWORD:-postgres}@localhost:5432/${PGDATABASE:-bookstudio}
      - PGHOST=localhost
      - PGPORT=5432
      - PGUSER=${PGUSER:-postgres}
      - PGPASSWORD=${PGPASSWORD:-postgres}
      - PGDATABASE=${PGDATABASE:-bookstudio}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
      - SENDGRID_VERIFIED_SENDER=${SENDGRID_VERIFIED_SENDER:-support@bookstud.io}
      - SESSION_SECRET=${SESSION_SECRET:-emergencysecret}
      - COOKIE_SECURE=${COOKIE_SECURE:-true}
      - COOKIE_SAME_SITE=${COOKIE_SAME_SITE:-lax}
      - RUNNING_IN_DOCKER=true
      - SUPPORT_SITE_MANAGER_ROLE=true
      - TZ=America/Chicago
      - FACILITY_TIMEZONE=America/Chicago
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    depends_on:
      - db
    command: >
      sh -c "
        echo 'Starting BookStud.io application in emergency mode...' &&
        node scripts/fix-system-settings.js || true &&
        node scripts/fix-db-all.js || true &&
        node dist/index.js
      "

  db:
    image: postgres:14-alpine
    restart: always
    network_mode: host
    environment:
      - POSTGRES_USER=${PGUSER:-postgres}
      - POSTGRES_PASSWORD=${PGPASSWORD:-postgres}
      - POSTGRES_DB=${PGDATABASE:-bookstudio}
      - TZ=America/Chicago
      - PGTZ=America/Chicago
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
EOF

echo "🔧 Created emergency configuration files"

# Check for pre-built dist directory
if [ ! -d "dist" ]; then
    echo "⚠️ The 'dist' directory is required for emergency build."
    echo "⚠️ You need to provide a pre-built application."
    
    read -p "Would you like to attempt to build the application now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔨 Building application... (may fail if required dependencies are not installed)"
        
        # Check for npm
        if ! command -v npm &> /dev/null; then
            echo "❌ npm is not installed or not in PATH. Cannot build application."
            exit 1
        fi
        
        # Attempt to build
        npm ci --offline || npm ci --prefer-offline || npm ci || echo "⚠️ npm ci failed, trying to continue..."
        npm run build || echo "⚠️ npm run build failed, deployment may not work correctly"
    else
        echo "❌ Cannot continue without built application. Deployment aborted."
        exit 1
    fi
fi

echo "⚙️ Setting up emergency configuration..."
cp Dockerfile.emergency Dockerfile
cp docker-compose.emergency.yml docker-compose.yml

# Stop existing containers
if docker ps -a | grep -q bookstudio; then
    echo "🛑 Stopping existing containers..."
    docker-compose down || true
    sleep 2
fi

echo "🏗️ Building emergency Docker image..."
docker-compose build --no-cache

echo "🚀 Starting BookStud.io in emergency mode..."
docker-compose up -d

# Verify deployment
echo "🔍 Checking application status..."
sleep 10

if docker ps | grep -q bookstudio_app; then
    echo "✅ Emergency deployment appears successful!"
    echo "📱 You can access the application at http://localhost:5000"
    echo "📋 Check logs with: docker-compose logs -f"
else
    echo "❌ Emergency deployment may have failed. Check logs with: docker-compose logs -f"
fi

echo
echo "⚠️ Note: This is an emergency deployment with minimal features."
echo "⚠️ Data validation and some functionality may be limited."
echo "⚠️ Please transition to standard deployment when connectivity is restored."