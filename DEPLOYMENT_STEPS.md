# BookStud.io Deployment: Step-by-Step Guide

This guide provides detailed, step-by-step instructions to deploy the BookStud.io application in a production environment.

## 1. Prerequisites

Before deployment, ensure you have:

- A Linux server with:
  - At least 2GB RAM and 1 CPU core
  - At least 10GB free disk space
  - Ubuntu 20.04 or later recommended
- Docker Engine installed (version 20.10+)
- Docker Compose installed (version 2.0+)
- Git installed
- Domain name pointing to your server (optional but recommended)

## 2. Initial Server Setup

```bash
# Update server packages
sudo apt update && sudo apt upgrade -y

# Install required tools if not already available
sudo apt install -y curl git

# Install Docker if not already installed
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose if not already installed
sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to the docker group to avoid using sudo with docker commands
sudo usermod -aG docker $USER
# Log out and log back in for this change to take effect
```

## 3. Get the Application Code

```bash
# Create a directory for the application
mkdir -p /opt/bookstudio
cd /opt/bookstudio

# Clone the repository (replace with your actual repository URL)
git clone https://github.com/your-username/bookstudio.git .
# Or download and extract a release archive
```

## 4. Configure Environment Variables

```bash
# Create .env file
touch .env

# Open the file for editing
nano .env
```

Add the following variables to your `.env` file:

```
# Database Settings
PGUSER=bookstudio
PGPASSWORD=your_strong_password_here
PGDATABASE=bookstudio
PGPORT=5432

# Application Settings
PORT=5000
NODE_ENV=production
TZ=America/Chicago
FACILITY_TIMEZONE=America/Chicago

# Email Settings (if using SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_VERIFIED_SENDER=support@your-domain.com

# Security Settings
SESSION_SECRET=your_random_secret_key
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

Generate a random session secret:

```bash
# Generate a random session secret
echo SESSION_SECRET=$(openssl rand -hex 32) >> .env
```

## 5. Build and Deploy with Docker Compose

### Option A: Using the Automated Production Deployment Script (Recommended)

We've created a comprehensive production deployment script that handles common issues automatically:

```bash
# Make sure you're in the application directory
cd /opt/bookstudio

# Make the deployment script executable if needed
chmod +x deploy-production.sh

# Run the deployment script (requires sudo)
sudo ./deploy-production.sh
```

The production deployment script:
1. Creates backups before deployment
2. Sets up production-optimized configurations
3. Ensures all fix scripts are in place
4. Handles network issues with Alpine package repositories
5. Uses retry logic for resilient builds
6. Verifies the deployment after startup

### Option B: Manual Deployment

If you prefer to deploy manually:

```bash
# Make sure you're in the application directory
cd /opt/bookstudio

# Use production-optimized configurations
cp Dockerfile.production Dockerfile
cp docker-compose.production.yml docker-compose.yml

# Build the Docker images
docker-compose build

# Start the application in detached mode
docker-compose up -d
```

## 6. Verify Deployment

Check if all services are running properly:

```bash
# Check the status of containers
docker-compose ps

# Check application logs
docker-compose logs -f app
```

Verify the application is accessible:
- Open a web browser and navigate to `http://your-server-ip:5000`
- You should see the BookStud.io login page

## 7. Setup Initial Admin User

The initialization scripts should have created default users, but you can verify:

```bash
# Check if the default admin user exists
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SELECT * FROM users WHERE role = 'admin';"
```

If no admin user exists, create one:

```bash
# Connect to the database
docker-compose exec db psql -U $PGUSER -d $PGDATABASE

# Create admin user (inside PostgreSQL shell)
INSERT INTO users (username, password, email, role) 
VALUES (
  'admin', 
  '5d41402abc4b2a76b9719d911017c592.5eb63bbbe01eeed093cb22bb8f5acdc3', -- 'hello' password
  'admin@example.com',
  'admin'
);

# Exit PostgreSQL shell
\q
```

## 8. Setup Domain and HTTPS (Optional but Recommended)

For a production deployment, you should use a proper domain with HTTPS. You have several options:

### Option A: Using Nginx Proxy Manager (Recommended)

1. Install Nginx Proxy Manager following their documentation
2. In the Nginx Proxy Manager dashboard, add a new proxy host:
   - Domain: your-domain.com
   - Scheme: http
   - Forward hostname: docker-host-ip
   - Forward port: 5000
   - Enable WebSocket Support
   - Set up SSL with Let's Encrypt

### Option B: Using Separate Nginx with Certbot

1. Install Nginx and Certbot
2. Configure Nginx:

```
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Obtain SSL certificates with Certbot:
```bash
sudo certbot --nginx -d your-domain.com
```

## 9. Setup Automatic Backups

Create a script for database backups:

```bash
# Create backup directory
mkdir -p /opt/bookstudio/backups

# Create backup script
cat > /opt/bookstudio/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/bookstudio/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cd /opt/bookstudio
source .env
docker-compose exec -T db pg_dump -U $PGUSER $PGDATABASE > "$BACKUP_DIR/bookstudio_$TIMESTAMP.sql"
# Keep only last 7 backups
ls -t $BACKUP_DIR/*.sql | tail -n +8 | xargs rm -f
EOF

# Make script executable
chmod +x /opt/bookstudio/backup.sh

# Schedule daily backups with cron
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/bookstudio/backup.sh") | crontab -
```

## 10. Update Procedure

Create an update script:

```bash
cat > /opt/bookstudio/update.sh << 'EOF'
#!/bin/bash
set -e

cd /opt/bookstudio

# Create a backup before updating
./backup.sh

# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo "Update completed successfully!"
EOF

chmod +x /opt/bookstudio/update.sh
```

## 11. System Monitoring (Optional)

For production deployments, consider adding basic monitoring:

```bash
# Install Prometheus Node Exporter
sudo apt-get install -y prometheus-node-exporter

# Or use a simpler solution like Netdata
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

## 12. Troubleshooting

If you encounter issues:

### Database Issues

```bash
# Check database logs
docker-compose logs db

# Run database fix script for common issues
docker-compose exec app node scripts/fix-db-all.js

# If you encounter system_settings table issues with missing description column
docker-compose exec app node scripts/fix-system-settings.js
```

#### Fixing system_settings Table Issues

The system occasionally encounters an error with the system_settings table during database initialization:

```
Error in system settings migration: error: column "description" of relation "system_settings" does not exist
```

This happens because the migration script tries to insert data with a "description" column that might not exist in older schema versions. The deployment process now automatically addresses this by:

1. Running the fix script first (docker-fix-system-settings.cjs)
2. Then running the standard migration script

If you need to fix this manually after deployment:

```bash
docker-compose exec app node scripts/fix-system-settings.js
```

### Application Issues

```bash
# Check application logs
docker-compose logs app

# Restart the application
docker-compose restart app

# If needed, rebuild the application
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Container Issues

```bash
# Check container status
docker-compose ps

# Check Docker logs
docker-compose logs

# Restart all services
docker-compose restart

# Complete reset (use with caution, retains database data)
docker-compose down
docker-compose up -d
```

### Docker Build Timeouts

If you experience timeouts during the Docker build process, usually when installing Alpine packages:

```bash
# 1. Use the optimized Dockerfile with faster mirrors
cp Dockerfile.optimized Dockerfile

# 2. If still having issues, try building with host network mode
docker-compose build --network=host

# 3. If the issue persists, try building with no cache but with a longer timeout
docker build --no-cache --network=host --progress=plain --timeout=600s -t bookstudio:latest .

# 4. As a last resort, manually build and push each stage separately
docker build --target builder -t bookstudio:builder .
docker build --no-cache -t bookstudio:latest .
```

## 13. Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Proxy Manager Documentation](https://nginxproxymanager.com/guide/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

## 14. Support

For additional support, please contact the development team or open an issue in the project repository.