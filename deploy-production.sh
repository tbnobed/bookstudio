#!/bin/bash
# BookStud.io Robust Production Deployment Script
# This script handles common deployment issues automatically

set -e
echo "=== BookStud.io Production Deployment ==="
echo "Starting deployment process at $(date)"

# Check if running as root/sudo
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root or with sudo"
    exit 1
fi

# Backup first
echo "Creating backup of existing deployment..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p /opt/bookstudio/backups

# Backup database if it exists and is running
if docker ps | grep -q bookstudio_db; then
    echo "Backing up existing database..."
    docker exec bookstudio_db pg_dump -U ${PGUSER:-postgres} ${PGDATABASE:-bookstudio} > "/opt/bookstudio/backups/db_backup_$TIMESTAMP.sql"
    echo "Database backup created at /opt/bookstudio/backups/db_backup_$TIMESTAMP.sql"
fi

# Copy configuration files
echo "Setting up offline-capable production configuration..."
cp Dockerfile.offline Dockerfile
cp docker-compose.host.yml docker-compose.yml

# Ensure scripts directory exists
mkdir -p scripts

# Check if fix-system-settings.js exists, create if not
if [ ! -f "scripts/fix-system-settings.js" ]; then
    echo "Creating system settings fix script..."
    cat > scripts/fix-system-settings.js << 'EOF'
/**
 * Fix for system_settings table missing description column
 */

const { Pool } = require('pg');

async function fixSystemSettings() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres'
  });

  try {
    console.log('Starting system_settings table fix...');

    // Check if system_settings table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('Creating system_settings table from scratch...');
      await pool.query(`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('system_settings table created successfully');
    } else {
      console.log('system_settings table exists, checking for description column...');
      
      // Check if description column exists
      const columnExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'description'
        );
      `);

      if (!columnExists.rows[0].exists) {
        console.log('Adding description column to system_settings table...');
        await pool.query(`
          ALTER TABLE system_settings ADD COLUMN description TEXT;
        `);
        console.log('description column added successfully');
      } else {
        console.log('description column already exists');
      }
    }

    // Check if siteName setting exists
    const siteNameExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM system_settings 
        WHERE key = 'siteName'
      );
    `);

    if (!siteNameExists.rows[0].exists) {
      console.log('Adding siteName setting to system_settings table...');
      await pool.query(`
        INSERT INTO system_settings (key, value, description)
        VALUES ('siteName', 'The Plex Studios', 'The name of the facility displayed throughout the application');
      `);
      console.log('siteName setting added successfully');
    } else {
      console.log('siteName setting already exists');
    }

    console.log('System settings fix completed successfully');
  } catch (error) {
    console.error('Error fixing system_settings table:', error);
  } finally {
    await pool.end();
  }
}

fixSystemSettings().then(() => {
  console.log('Script execution completed');
});
EOF
    echo "Fix script created successfully"
fi

# Check if docker-fix-system-settings.cjs exists, create if not
if [ ! -f "scripts/docker-fix-system-settings.cjs" ]; then
    echo "Creating Docker-compatible system settings fix script..."
    cp scripts/fix-system-settings.js scripts/docker-fix-system-settings.cjs
    echo "Docker-compatible fix script created"
fi

# Ensure environment variables
if [ ! -f ".env" ]; then
    echo "Creating .env file with default values..."
    cat > .env << EOF
# Database Settings
PGUSER=bookstudio
PGPASSWORD=$(openssl rand -hex 12)
PGDATABASE=bookstudio
PGPORT=5432

# Application Settings
PORT=5000
NODE_ENV=production
TZ=America/Chicago
FACILITY_TIMEZONE=America/Chicago

# Security Settings
SESSION_SECRET=$(openssl rand -hex 32)
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
EOF
    echo ".env file created with secure random values"
else
    echo "Using existing .env file"
fi

# Stop any existing containers
echo "Stopping any existing containers..."
docker-compose down || true

# Build with retries
echo "Building Docker images with resilient settings..."
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose build; then
        echo "Build successful!"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT+1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "Build failed, retrying in 5 seconds... (Attempt $RETRY_COUNT of $MAX_RETRIES)"
            sleep 5
        else
            echo "Build failed after $MAX_RETRIES attempts."
            echo "Please check your network connection and try again."
            exit 1
        fi
    fi
done

# Start the application
echo "Starting the application..."
docker-compose up -d

# Check if application started successfully
echo "Verifying deployment..."
sleep 10

if docker-compose ps | grep -q "app.*Up"; then
    echo "Application container is running!"
else
    echo "Warning: Application container failed to start. Checking logs..."
    docker-compose logs app
fi

if docker-compose ps | grep -q "db.*Up"; then
    echo "Database container is running!"
else
    echo "Warning: Database container failed to start. Checking logs..."
    docker-compose logs db
fi

echo "Deployment process completed at $(date)"
echo "You can access the application at: http://$(hostname -I | awk '{print $1}'):${PORT:-5000}"
echo "To view logs: docker-compose logs -f"
echo "To restart: docker-compose restart"
echo "=== Deployment Complete ==="