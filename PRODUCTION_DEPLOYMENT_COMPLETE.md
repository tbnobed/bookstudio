# BookStud.io Production Deployment Guide

## Complete Docker Deployment with Backup & Restore

This guide provides comprehensive instructions for deploying BookStud.io in production with full backup and restore capabilities, including all the latest database schema updates.

## Prerequisites

- Docker and Docker Compose installed
- Domain name (optional, for custom domains)
- Nginx Proxy Manager or similar reverse proxy
- SendGrid account (for email notifications)

## Quick Start

1. **Clone the repository:**
```bash
git clone <your-repo-url>
cd bookstudio
```

2. **Configure environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your production settings:
```env
# Database Configuration
PGUSER=postgres
PGPASSWORD=your_secure_database_password
PGDATABASE=bookstudio

# Email Configuration (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_VERIFIED_SENDER=support@yourdomain.com

# Security
SESSION_SECRET=your_secure_session_secret_here
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax

# Application Configuration
PORT=5000
VERSION=latest

# Backup Configuration
BACKUP_RETENTION_DAYS=30
```

3. **Deploy the application:**
```bash
docker-compose up -d
```

## Database Schema Updates Included

The Docker deployment automatically applies all necessary database migrations:

- ✅ **Template Time Fields**: Start and end time storage for templates
- ✅ **PCR Room Integration**: Production Control Room assignments
- ✅ **Booking-Studio Junction**: Multi-studio booking support
- ✅ **File Attachments**: Document upload capabilities
- ✅ **Color Coding**: Visual booking categorization
- ✅ **Status Management**: Booking workflow states
- ✅ **System Settings**: Configurable application settings
- ✅ **Site Manager Role**: Enhanced role-based access control
- ✅ **Notification Groups**: Team-based alert systems

## Backup and Restore System

### Automatic Backups

The application includes an integrated backup system accessible through the admin interface:

- **Scheduled Backups**: Configurable automatic backup scheduling
- **Manual Backups**: On-demand backup creation
- **Retention Management**: Automatic cleanup of old backups
- **Compression**: Efficient storage with gzip compression

### Manual Backup Commands

**Create a backup:**
```bash
docker-compose exec app bash /app/scripts/production-backup.sh
```

**List available backups:**
```bash
docker-compose exec app ls -la /app/backups/
```

### Restore Operations

**Restore from a backup:**
```bash
docker-compose exec app bash /app/scripts/production-restore.sh backup_filename.sql.gz
```

**Example:**
```bash
docker-compose exec app bash /app/scripts/production-restore.sh bookstudio-backup_20250605_230000.sql.gz
```

### Backup Storage

Backups are stored in the persistent Docker volume `bookstudio_backups` and are accessible at `/app/backups/` within the container.

## Production Configuration

### Reverse Proxy Setup (Nginx Proxy Manager)

1. **Add Proxy Host:**
   - Domain: `your-domain.com`
   - Forward Hostname/IP: `your-server-ip`
   - Forward Port: `5000`
   - Enable SSL with Let's Encrypt

2. **Custom Nginx Configuration (optional):**
```nginx
# File upload size limit
client_max_body_size 50M;

# WebSocket support for real-time features
location /ws {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Email Configuration

To enable email notifications, you'll need a SendGrid account:

1. **Create SendGrid Account:** Sign up at sendgrid.com
2. **Get API Key:** Create an API key with mail send permissions
3. **Verify Sender:** Add and verify your sender email address
4. **Update Environment:** Add credentials to your `.env` file

### Security Best Practices

1. **Use Strong Passwords:**
   - Database passwords should be at least 16 characters
   - Session secrets should be cryptographically random

2. **Regular Updates:**
   - Keep Docker images updated
   - Monitor security advisories

3. **Firewall Configuration:**
   - Only expose port 5000 to your reverse proxy
   - Block direct database access from external networks

## Monitoring and Maintenance

### Health Checks

The application includes built-in health checks:
```bash
# Check application health
curl http://localhost:5000/api/health

# Check container health
docker-compose ps
```

### Log Management

View application logs:
```bash
# Application logs
docker-compose logs app

# Database logs
docker-compose logs db

# Follow logs in real-time
docker-compose logs -f app
```

### Backup Verification

Regularly verify your backups:
```bash
# List backups with sizes
docker-compose exec app ls -lh /app/backups/

# Test restore in development environment
docker-compose exec app bash /app/scripts/production-restore.sh test-backup.sql.gz
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed:**
   - Check database container status: `docker-compose ps db`
   - Verify environment variables in `.env`
   - Ensure database has finished initializing

2. **Email Not Sending:**
   - Verify SendGrid API key and sender address
   - Check application logs for email errors
   - Ensure sender email is verified in SendGrid

3. **File Upload Issues:**
   - Check disk space: `df -h`
   - Verify upload directory permissions
   - Increase nginx client_max_body_size if needed

### Recovery Procedures

**Complete System Recovery:**
1. Stop all services: `docker-compose down`
2. Restore from backup: Use restore script with latest backup
3. Restart services: `docker-compose up -d`
4. Verify functionality through health checks

**Database Recovery:**
1. Access database container: `docker-compose exec db psql -U postgres bookstudio`
2. Run diagnostic queries to identify issues
3. Apply manual fixes or restore from backup

## Performance Optimization

### Database Tuning

The PostgreSQL container includes production-optimized settings:
- `shared_buffers=256MB` - Memory for shared buffers
- `work_mem=4MB` - Memory for query operations
- `max_connections=100` - Connection limit

### Application Scaling

For high-traffic deployments:
1. **Load Balancing:** Deploy multiple app containers
2. **Database Scaling:** Consider PostgreSQL replication
3. **CDN Integration:** Use CDN for static assets
4. **Monitoring:** Implement application performance monitoring

## Support and Updates

### Version Updates

To update to a new version:
1. Create a backup: `docker-compose exec app bash /app/scripts/production-backup.sh`
2. Pull latest images: `docker-compose pull`
3. Restart services: `docker-compose up -d`
4. Verify functionality

### Getting Help

- Check application logs for detailed error messages
- Review this deployment guide for configuration issues
- Ensure all environment variables are properly set
- Verify database schema is up to date

## Summary

This production deployment includes:

✅ **Complete Database Schema** - All latest migrations and features
✅ **Automated Backup System** - Scheduled and manual backups with retention
✅ **Production Security** - SSL, secure cookies, and proper user permissions
✅ **Performance Optimization** - Tuned database and application settings
✅ **Monitoring & Health Checks** - Built-in status monitoring
✅ **Email Integration** - SendGrid-powered notifications
✅ **Template Time Fields** - Enhanced template system with timing
✅ **Role-Based Access** - Complete user permission management

Your BookStud.io instance is now ready for production use with enterprise-grade backup and restore capabilities.