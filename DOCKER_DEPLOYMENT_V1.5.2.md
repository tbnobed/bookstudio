# BookStud.io Docker Deployment Guide v1.5.2
## Comprehensive Audit Logging System

This guide covers deployment of BookStud.io v1.5.2 with the new comprehensive audit logging system.

## 🆕 New Features in v1.5.2

### Comprehensive Audit Logging
- **Complete System Tracking**: All user actions, system changes, and administrative operations are now logged
- **90-Day Retention**: Automatic cleanup of audit logs older than 90 days
- **Advanced Filtering**: Filter audit logs by user, action type, entity type, date range, and search terms
- **Facility Timezone Display**: All timestamps displayed in configured facility timezone
- **Admin Dashboard**: Comprehensive audit log interface with statistics and export capabilities

### 🚫 Removed: Default Notification Groups
- **No Default Groups**: Docker deployment no longer creates default notification groups automatically
- **Facility Customization**: Each facility should create their own notification groups based on their organizational structure
- **Clean Deployment**: Reduces clutter and ensures each installation is tailored to the specific facility's needs

### Audit Log Coverage
The system now tracks:
- ✅ User Management (invite, create, update, delete)
- ✅ Template Operations (create, update, delete)
- ✅ Alert Management (create, update, delete)
- ✅ System Configuration Changes
- ✅ Studio/PCR Room Management
- ✅ Notification Group Operations
- ✅ Booking Management (comprehensive tracking)
- ✅ Authentication Events (login, logout, failed attempts)

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database accessible
- SendGrid API key for email notifications
- OpenWeatherMap API key for weather integration

## Environment Variables

### Required Variables
```bash
# Database Configuration
PGUSER=postgres
PGPASSWORD=your_secure_password
PGDATABASE=bookstudio
DATABASE_URL=postgres://user:password@host:5432/database

# Email Configuration (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_VERIFIED_SENDER=support@yourfacility.com

# Weather Integration
VITE_OPENWEATHER_API_KEY=your_openweather_api_key
VITE_WEATHER_LOCATION="Your City, State"
VITE_WEATHER_LAT=40.7128
VITE_WEATHER_LON=-74.0060

# Security
SESSION_SECRET=your_secure_session_secret_at_least_32_chars
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax

# Application Configuration
APP_DOMAIN=your-domain.com
SITE_MANAGER_EMAIL=admin@yourfacility.com
PORT=5000

# Timezone Configuration (CRITICAL for Audit Logs)
TZ=America/Chicago
FACILITY_TIMEZONE=America/Chicago
VITE_FACILITY_TIMEZONE=America/Chicago

# Docker Configuration
RUNNING_IN_DOCKER=true
SUPPORT_SITE_MANAGER_ROLE=true
```

### Audit Logging Environment Variables
No additional environment variables are required for audit logging - it's enabled by default in v1.5.2.

## Deployment Steps

### 1. Prepare Environment
```bash
# Clone or update your BookStud.io repository
cd /path/to/bookstudio

# Create your .env file from the template
cp .env.example .env

# Edit the .env file with your specific values
nano .env
```

### 2. Build and Deploy
```bash
# Build the application with audit logging support
docker-compose build --no-cache

# Start the services
docker-compose up -d

# Monitor the deployment
docker-compose logs -f
```

### 3. Verify Audit Logging

After deployment, verify the audit logging system:

```bash
# Check if audit_logs table was created
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "\d audit_logs"

# Verify audit log entries are being created
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SELECT COUNT(*) FROM audit_logs;"

# Check recent audit entries
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SELECT action, entity_type, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 5;"
```

### 4. Access Audit Logs Interface

1. Navigate to your application URL
2. Log in as an admin or site manager
3. Go to **Settings** → **Audit Logs**
4. Verify you can see and filter audit log entries

## Database Migration Process

The v1.5.2 deployment includes automatic migration that:

1. **Creates audit_logs table** with proper schema
2. **Adds foreign key relationships** to the users table
3. **Sets up automatic cleanup** for 90-day retention
4. **Maintains backward compatibility** with existing deployments

### Migration Command Sequence
```bash
# The following migrations run automatically during deployment:
node scripts/consolidated-migration.cjs         # Base tables
node scripts/schema-repair.cjs                 # Schema fixes
node scripts/docker-migrate-linked-bookings.cjs # v1.5.0 features
node scripts/production-migration-v1.5.1.cjs   # v1.5.1 fixes
node scripts/production-migration-v1.5.2.cjs   # v1.5.2 audit logging
```

## Audit Log Management

### Access Requirements
- **Admin Role**: Full access to all audit logs
- **Site Manager Role**: Full access to all audit logs
- **Other Roles**: No access to audit logs

### Automatic Cleanup
- Audit logs older than 90 days are automatically cleaned up
- Cleanup runs during system startup and can be triggered manually
- Critical system events are preserved according to retention policy

### Filtering and Search
The audit logs interface supports:
- **User Filtering**: Filter by specific user who performed actions
- **Action Filtering**: Filter by action type (CREATE, UPDATE, DELETE, LOGIN, etc.)
- **Entity Filtering**: Filter by entity type (booking, user, alert, template, etc.)
- **Date Range Filtering**: Filter by start and end dates
- **Text Search**: Search across user names, actions, entity titles, and IP addresses

## Troubleshooting

### Audit Logs Not Appearing
```bash
# Check if the audit_logs table exists
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "\dt" | grep audit

# Verify the migration completed successfully
docker-compose logs db-init | grep "v1.5.2"

# Check application logs for audit service errors
docker-compose logs app | grep -i audit
```

### Performance Considerations
```bash
# Monitor audit log table size
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SELECT pg_size_pretty(pg_total_relation_size('audit_logs'));"

# Check index usage
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "\d+ audit_logs"
```

### Timezone Issues
```bash
# Verify timezone configuration
docker-compose exec app printenv | grep TZ
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SHOW timezone;"

# Test facility timezone in application
# Navigate to audit logs and verify timestamps display in your facility timezone
```

## Backup Considerations

### Enhanced Backup for Audit Logs
```bash
# Create backup including audit logs
docker-compose exec db pg_dump -U $PGUSER -d $PGDATABASE -f /tmp/backup_with_audit.sql

# Copy backup from container
docker cp $(docker-compose ps -q db):/tmp/backup_with_audit.sql ./backup_with_audit_$(date +%Y%m%d_%H%M%S).sql
```

### Selective Backup (without audit logs)
```bash
# Create backup excluding audit logs if needed
docker-compose exec db pg_dump -U $PGUSER -d $PGDATABASE --exclude-table=audit_logs -f /tmp/backup_no_audit.sql
```

## Security Notes

### Audit Log Security
- Audit logs contain sensitive information about user actions
- Access is restricted to admin and site manager roles only
- IP addresses and user agents are logged for security analysis
- Consider implementing additional log shipping for compliance requirements

### Data Retention Compliance
- Default 90-day retention may need adjustment for your compliance requirements
- Modify retention period in the cleanup migration script if needed
- Consider implementing external log archival for longer retention

## Health Checks

### Audit System Health
```bash
# Verify audit service is responding
curl -H "Authorization: Bearer your_admin_token" http://your-domain.com/api/audit-logs/stats

# Check recent audit activity
curl -H "Authorization: Bearer your_admin_token" http://your-domain.com/api/audit-logs?limit=5
```

## Upgrade Notes

### From v1.5.1 to v1.5.2
- Zero downtime upgrade supported
- All existing data preserved
- New audit logging functionality added automatically
- No manual intervention required

### From Earlier Versions
- Follow the complete migration sequence
- All previous migrations are included and run automatically
- Test in staging environment first for major version upgrades

## Support

For issues specific to the audit logging system:
1. Check application logs: `docker-compose logs app | grep -i audit`
2. Verify database schema: Check audit_logs table structure
3. Test user permissions: Ensure admin/site_manager roles have access
4. Validate timezone configuration: Verify facility timezone settings

---

**BookStud.io v1.5.2** - Comprehensive Audit Logging System
*Deployed with Docker Compose for production television studio management*