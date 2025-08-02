# BookStud.io v1.5.2 Production Deployment Checklist
## Comprehensive Audit Logging System

Use this checklist to ensure a complete and successful deployment of BookStud.io v1.5.2 with the new audit logging system.

## Pre-Deployment Checklist

### 1. Environment Preparation
- [ ] Docker and Docker Compose installed and updated
- [ ] Production server meets minimum requirements (4GB RAM, 20GB storage)
- [ ] Backup of existing production database (if upgrading)
- [ ] All required API keys and credentials available

### 2. Environment Variables Configuration
- [ ] **Database**: `PGUSER`, `PGPASSWORD`, `PGDATABASE` configured
- [ ] **SendGrid**: `SENDGRID_API_KEY`, `SENDGRID_VERIFIED_SENDER` set
- [ ] **Weather**: `VITE_OPENWEATHER_API_KEY`, location coordinates configured
- [ ] **Security**: `SESSION_SECRET` generated (minimum 32 characters)
- [ ] **Timezone**: `TZ`, `FACILITY_TIMEZONE`, `VITE_FACILITY_TIMEZONE` all set consistently
- [ ] **Domain**: `APP_DOMAIN` set to production URL (no ports)
- [ ] **Site Manager**: `SITE_MANAGER_EMAIL` configured

### 3. Audit Logging Readiness
- [ ] Confirmed no additional environment variables needed (audit logging enabled by default)
- [ ] Admin/Site Manager roles exist for audit log access
- [ ] Database has sufficient storage for audit logs (estimate 100MB per year for busy facility)

## Deployment Process

### 4. Build and Deploy
```bash
# Navigate to project directory
cd /path/to/bookstudio

# Pull latest code (if applicable)
git pull origin main

# Build with no cache to ensure v1.5.2 features
docker-compose build --no-cache

# Deploy services
docker-compose up -d
```

### 5. Monitor Deployment
- [ ] Watch logs for successful startup: `docker-compose logs -f`
- [ ] Verify all migrations completed successfully
- [ ] Confirm v1.5.2 audit logging migration ran without errors
- [ ] Check application health endpoint responds

### 6. Database Verification
```bash
# Verify audit_logs table exists
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "\d audit_logs"

# Check table structure includes all required columns
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "\d+ audit_logs"

# Verify foreign key relationship to users table
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SELECT conname FROM pg_constraint WHERE conrelid = 'audit_logs'::regclass;"
```

## Post-Deployment Verification

### 7. Application Access
- [ ] Application loads successfully at production URL
- [ ] Login functionality works with existing users
- [ ] Admin/Site Manager can access all features

### 8. Audit Logging System Test
- [ ] Navigate to **Settings** → **Audit Logs** as admin
- [ ] Verify audit log entries are visible
- [ ] Test filtering by user, action type, entity type
- [ ] Confirm timestamps display in facility timezone
- [ ] Create a test booking and verify it appears in audit logs
- [ ] Test user filter dropdown shows all users correctly

### 9. System Functionality Test
- [ ] **Bookings**: Create, update, delete bookings work correctly
- [ ] **Templates**: Template operations generate audit entries
- [ ] **Users**: User management actions are logged
- [ ] **Alerts**: Alert creation/updates create audit entries
- [ ] **Weather**: Signage displays weather correctly
- [ ] **Notifications**: Email notifications sent successfully

### 10. Performance and Security
- [ ] Application responds within acceptable time limits
- [ ] Audit logs page loads quickly (under 2 seconds)
- [ ] Database performance remains stable
- [ ] Only admin/site_manager roles can access audit logs
- [ ] SSL certificate valid and HTTPS working

## Troubleshooting Guide

### Common Issues and Solutions

#### Audit Logs Not Visible
```bash
# Check if migration completed
docker-compose logs db-init | grep "v1.5.2"

# Verify table exists and has data
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SELECT COUNT(*) FROM audit_logs;"

# Check user role permissions
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SELECT username, role FROM users WHERE role IN ('admin', 'site_manager');"
```

#### Timezone Display Issues
```bash
# Verify environment variables
docker-compose exec app printenv | grep -E "(TZ|TIMEZONE)"

# Check database timezone
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SHOW timezone;"

# Test facility timezone in browser developer tools
```

#### Performance Issues
```bash
# Check audit logs table size
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SELECT pg_size_pretty(pg_total_relation_size('audit_logs'));"

# Verify indexes are in place
docker-compose exec db psql -U $PGUSER -d $PGDATABASE -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'audit_logs';"
```

## Rollback Plan

### If Issues Occur
1. **Stop current deployment**: `docker-compose down`
2. **Restore from backup**: Use production backup scripts
3. **Check logs**: `docker-compose logs > deployment_error.log`
4. **Contact support**: Provide error logs and specific symptoms

### Emergency Commands
```bash
# Stop all services immediately
docker-compose down

# View last 100 log lines from all services
docker-compose logs --tail=100

# Restore database from backup
docker-compose exec db psql -U $PGUSER -d $PGDATABASE < /path/to/backup.sql
```

## Success Criteria

### Deployment is successful when:
- [ ] All services running (`docker-compose ps` shows all as "Up")
- [ ] Application accessible at production URL
- [ ] Audit logs page loads and displays entries
- [ ] User filtering works correctly
- [ ] Timestamps show in facility timezone
- [ ] All existing functionality preserved
- [ ] Email notifications still working
- [ ] Weather integration functioning
- [ ] Performance remains acceptable

## Post-Deployment Tasks

### 11. Documentation and Training
- [ ] Update internal documentation with audit logging features
- [ ] Train admin staff on new audit log filtering capabilities
- [ ] Document audit log retention policy for compliance
- [ ] Schedule regular audit log review processes

### 12. Monitoring Setup
- [ ] Set up monitoring for audit log table growth
- [ ] Configure alerts for audit service failures
- [ ] Document backup procedures including audit logs
- [ ] Plan for log retention and compliance requirements

---

**BookStud.io v1.5.2 Deployment Complete** ✅
*Ready for production use with comprehensive audit logging system*

## Support Contact
For deployment issues or questions about the audit logging system, contact your system administrator or refer to the troubleshooting documentation.