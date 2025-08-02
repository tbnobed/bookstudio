# BookStud.io Docker Deployment Guide - Fixed Version

## Overview

This guide provides the complete Docker deployment process for BookStud.io v1.5.2 with all schema fixes applied.

## Fixed Issues

### 1. SSL Connection Error
- **Problem**: Migration script was forcing SSL connections to PostgreSQL, but Docker's PostgreSQL container doesn't support SSL by default
- **Solution**: Updated migration script to intelligently detect SSL requirements based on connection string
- **Files Fixed**: 
  - `scripts/production-migration-v1.5.2.cjs`
  - `scripts/fix-audit-schema.cjs`

### 2. Database Schema Mismatches
- **Problem**: Column name inconsistencies between migration scripts and application code
- **Solutions**:
  - **Audit Logs**: Fixed column names (`entity_type`, `entity_id`, `entity_title` instead of `resource_type`, `resource_name`)
  - **System Settings**: Fixed column names (`key`, `value` instead of `setting_key`, `setting_value`)
- **Files Fixed**:
  - `scripts/consolidated-migration.cjs`
  - `scripts/fix-system-settings-schema.cjs`

## Deployment Steps

### 1. Pre-Deployment Setup

```bash
# Clone the repository
git clone <repository-url>
cd bookstudio

# Ensure Docker and Docker Compose are installed
docker --version
docker-compose --version
```

### 2. Environment Configuration

Create or update `.env` file:

```env
# Database Configuration
DATABASE_URL=postgresql://bookstudio_user:secure_password_123@db:5432/bookstudio_db
POSTGRES_DB=bookstudio_db
POSTGRES_USER=bookstudio_user
POSTGRES_PASSWORD=secure_password_123

# Application Configuration
NODE_ENV=production
SESSION_SECRET=your-super-secure-session-secret-here
VITE_FACILITY_TIMEZONE=America/Chicago

# Email Configuration (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_VERIFIED_SENDER=your-verified-sender@domain.com

# Weather Integration (Optional)
VITE_OPENWEATHER_API_KEY=your-openweather-api-key
```

### 3. Build and Deploy

```bash
# Build and start services
docker-compose up -d --build

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Verify Deployment

#### Check Database Migration
```bash
# Check if migration completed successfully
docker-compose logs db-init

# Expected output should include:
# ✅ Consolidated migration completed successfully!
# ✅ Schema repair completed successfully!
# ✅ Production Migration v1.5.2 completed successfully!
```

#### Test Application Access
```bash
# Check if application is running
curl -I http://localhost:3000

# Should return: HTTP/1.1 200 OK
```

#### Verify Audit Logging
1. Access the application at `http://localhost:3000`
2. Login with admin credentials
3. Navigate to Settings → Audit Logs
4. Verify that audit logs are displaying correctly

### 5. Post-Deployment Verification

#### Database Schema Check
```bash
# Connect to database and verify schemas
docker-compose exec db psql -U bookstudio_user -d bookstudio_db

# Check audit_logs table structure
\d audit_logs

# Expected columns:
# - id (integer, primary key)
# - user_id (integer, not null)
# - action (text, not null)
# - entity_type (text, not null)
# - entity_id (integer)
# - entity_title (text)
# - details (json)
# - ip_address (text)
# - user_agent (text)
# - timestamp (timestamp)

# Check system_settings table structure
\d system_settings

# Expected columns:
# - id (integer, primary key)
# - key (text, not null, unique)
# - value (text, not null)
# - created_at (timestamp)
# - updated_at (timestamp)
```

## Migration Script Fixes Applied

### 1. SSL Configuration Fix

The migration scripts now use intelligent SSL detection:

```javascript
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('ssl=true')) {
  dbConfig.ssl = { rejectUnauthorized: false };
} else {
  dbConfig.ssl = false; // Explicitly disable for Docker
}
```

### 2. Audit Logs Schema Fix

Updated to use correct column names:
- `resource_type` → `entity_type`
- `resource_name` → `entity_title`
- Added proper `user_id` constraint

### 3. System Settings Schema Fix

Updated to use correct column names:
- `setting_key` → `key`
- `setting_value` → `value`
- Removed unnecessary `description` column

## Troubleshooting

### Common Issues

#### 1. Migration Fails with SSL Error
**Error**: `The server does not support SSL connections`
**Solution**: Ensure DATABASE_URL doesn't include `ssl=true` for Docker deployments

#### 2. Column Does Not Exist Errors
**Error**: `column "entity_type" does not exist`
**Solution**: Run the schema fix scripts:
```bash
docker-compose exec app node scripts/fix-audit-schema.cjs
docker-compose exec app node scripts/fix-system-settings-schema.cjs
```

#### 3. Service Won't Start
**Error**: `service "db-init" didn't complete successfully: exit 1`
**Solution**: Check logs and run individual migration scripts manually

### Manual Migration Recovery

If automated migration fails, run these commands:

```bash
# Fix audit logs schema
docker-compose exec app node scripts/fix-audit-schema.cjs

# Fix system settings schema
docker-compose exec app node scripts/fix-system-settings-schema.cjs

# Run production migration
docker-compose exec app node scripts/production-migration-v1.5.2.cjs

# Restart application
docker-compose restart app
```

## Security Considerations

1. **Change Default Passwords**: Update all default passwords in `.env`
2. **Session Secret**: Use a strong, random session secret
3. **API Keys**: Secure all API keys and don't commit them to version control
4. **Database Access**: Limit database access to necessary services only
5. **SSL/TLS**: Enable SSL/TLS for production deployments with external database

## Monitoring and Maintenance

### Log Monitoring
```bash
# Monitor all services
docker-compose logs -f

# Monitor specific service
docker-compose logs -f app
docker-compose logs -f db
```

### Database Backup
```bash
# Create backup
docker-compose exec db pg_dump -U bookstudio_user bookstudio_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker-compose exec -T db psql -U bookstudio_user bookstudio_db < backup_file.sql
```

### Health Checks

The application includes built-in health monitoring:
- Database connection status
- Audit logging functionality
- Email service connectivity
- Session store health

## Success Indicators

✅ **Deployment Successful When**:
- All Docker services are running (`docker-compose ps`)
- Database migration completed without errors
- Application accessible at configured port
- Audit logs page loads without errors
- Email notifications are working (if configured)
- No error messages in application logs

✅ **Migration v1.5.2 Features Active**:
- Comprehensive audit logging across all operations
- 90-day retention policy implemented
- Enhanced UI for audit log display
- Proper timezone handling
- User management audit trail
- Template and alert management logging

## Support

For issues not covered in this guide:
1. Check application logs: `docker-compose logs app`
2. Check database logs: `docker-compose logs db`
3. Verify environment variables are correctly set
4. Ensure all required API keys are configured
5. Check network connectivity and firewall settings

This deployment guide ensures a clean, successful deployment of BookStud.io v1.5.2 with all critical fixes applied.