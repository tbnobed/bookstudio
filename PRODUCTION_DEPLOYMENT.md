# BookStud.io Production Deployment Guide

## Updates Summary

We have made several improvements to prepare BookStud.io for production deployment:

1. **Calendar Layout Fixes**
   - Replaced absolute positioning with flex-column layout
   - Fixed layout shifts when adding/editing bookings
   - Improved rendering performance for cells with many bookings

2. **Timezone Handling**
   - Added explicit America/Chicago timezone setting throughout the stack
   - Improved date comparison and formatting
   - Added facility timezone environment variable

3. **Docker Optimization**
   - Updated Dockerfile with production-ready settings
   - Improved PostgreSQL configuration for better performance
   - Added health checks and proper error handling
   - Enhanced static file serving with caching

4. **Performance Improvements**
   - Added request size limits to handle larger payloads
   - Optimized static asset caching
   - Added database connection pooling and improved query performance
   - Increased logging rotation for better diagnostics

## Docker-Based Deployment

This application is designed to be deployed entirely with Docker and Docker Compose, with no additional scripts needed.

### Prerequisites

- Docker and Docker Compose installed on the host machine
- Access to your deployment server
- Required environment variables for database and email settings

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Database Settings
PGUSER=your_database_user
PGPASSWORD=your_database_password
PGDATABASE=bookstudio
PGPORT=5432

# Application Settings
PORT=5000
NODE_ENV=production
TZ=America/Chicago
FACILITY_TIMEZONE=America/Chicago

# Email Settings
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_VERIFIED_SENDER=support@your-domain.com

# Security Settings
SESSION_SECRET=your_session_secret_key
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

Replace placeholders with your actual values.

### Deployment Steps

1. **Copy files to your production server**

   Transfer the latest code to your production server.

2. **Set up environment variables**

   Create or update the `.env` file with your production settings.

3. **Build and start the Docker containers**

   ```bash
   # Build the Docker images with the latest code
   docker-compose build --no-cache
   
   # Start the containers
   docker-compose up -d
   ```

   You can optionally specify a version tag:
   
   ```bash
   # Build with a specific version tag
   VERSION=1.0.0 docker-compose build --no-cache
   
   # Start with that version
   VERSION=1.0.0 docker-compose up -d
   ```

4. **Verify deployment**

   After deployment completes, verify that:
   - The application is accessible at http://your-domain.com or http://localhost:5000
   - You can log in to the application
   - The calendar displays correctly
   - Bookings can be created and edited

### Verification

Check the service health:

```bash
docker-compose ps
```

All services should show `Up (healthy)` status.

Check the logs for any issues:

```bash
docker-compose logs -f
```

### Maintenance

#### Backup Database

To manually back up the database:

```bash
# Create backups directory if it doesn't exist
mkdir -p ./backups

# Backup the database
docker-compose exec db pg_dump -U postgres bookstudio > ./backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Update Application

To update the application with new code changes:

```bash
# Pull the latest code changes
git pull

# Rebuild and restart the containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Database connection issues**
   - Check the database service is running: `docker-compose ps db`
   - Verify database credentials in `.env` file
   - Check database logs: `docker-compose logs db`

2. **Application not starting**
   - Check application logs: `docker-compose logs app`
   - Verify all required environment variables are set
   - Check port availability (port 5000 should be free)

3. **Email not working**
   - Verify SendGrid API key is valid
   - Check SendGrid verified sender email is correct
   - Check application logs for email-related errors

4. **Docker container failing to start**
   - Check if the required ports are already in use
   - Verify Docker and Docker Compose are installed and running correctly
   - Check Docker logs: `docker-compose logs`

### Contact Support

For additional support, please contact the development team or open an issue in the project repository.