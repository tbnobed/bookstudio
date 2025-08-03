# BookStud.io v1.5.3 Teams Feature - Docker Deployment Checklist

## Overview
This checklist covers the complete deployment process for BookStud.io v1.5.3, which introduces the **Teams Feature** allowing collaborative booking management where team members can view each other's bookings.

## Pre-Deployment Requirements

### 1. Environment Variables
Ensure all required environment variables are set in your `.env` file:

```bash
# Database Configuration
PGUSER=postgres
PGPASSWORD=your_secure_password
PGDATABASE=bookstudio
DATABASE_URL=postgres://user:password@db:5432/bookstudio

# SendGrid Configuration (Required for team invitations)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_VERIFIED_SENDER=your-email@yourdomain.com

# Application Configuration
SESSION_SECRET=your_session_secret_key
SITE_MANAGER_EMAIL=admin@yourdomain.com
APP_DOMAIN=yourdomain.com
TZ=America/Chicago  # Set to your facility timezone
FACILITY_TIMEZONE=America/Chicago

# Weather Integration (Optional)
VITE_OPENWEATHER_API_KEY=your_weather_api_key
VITE_WEATHER_LOCATION=Your City
VITE_WEATHER_LAT=latitude
VITE_WEATHER_LON=longitude

# Security Configuration
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

### 2. Version Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 4GB RAM
- 20GB available disk space

## Deployment Steps

### Step 1: Prepare Deployment Environment
```bash
# Create project directory
mkdir -p bookstudio-v1.5.3
cd bookstudio-v1.5.3

# Copy project files
# (Include all project files, docker-compose.yml, Dockerfile, etc.)

# Set proper permissions
chmod +x scripts/*.sh
```

### Step 2: Environment Configuration
```bash
# Copy and configure environment variables
cp .env.example .env
# Edit .env file with your production values
nano .env
```

### Step 3: Build and Deploy
```bash
# Build with version tag
export VERSION=1.5.3
docker-compose build --no-cache

# Start services
docker-compose up -d

# Monitor startup logs
docker-compose logs -f app
```

### Step 4: Verify Database Migration
The deployment includes automatic database migration for the Teams feature:

```bash
# Check migration logs
docker-compose logs db-init

# Verify teams tables were created
docker-compose exec db psql -U postgres -d bookstudio -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('teams', 'team_members');
"
```

Expected output:
```
 table_name  
-------------
 teams
 team_members
```

### Step 5: Health Checks
```bash
# Check application health
curl http://localhost:5000/api/health

# Verify database connectivity
docker-compose exec app node -e "
  const { Pool } = require('pg');
  const pool = new Pool(process.env.DATABASE_URL);
  pool.query('SELECT NOW()').then(() => console.log('DB Connected')).catch(console.error);
"
```

### Step 6: Verify Teams Feature
1. **Access Application**: Navigate to your domain
2. **Login as Admin**: Use admin credentials
3. **Access Teams Management**: 
   - Go to Settings → Teams (admin/site manager only)
   - Verify team creation functionality
4. **Test Team Features**:
   - Create a test team
   - Invite team members
   - Verify "My Bookings" page shows personal/team tabs
   - Test team booking visibility

## New Features in v1.5.3

### Teams Feature
- **Team Management**: Create, edit, and delete teams (admin/site manager only)
- **Member Management**: Invite users to teams, manage roles
- **Collaborative Booking Views**: Team members can view each other's bookings
- **Enhanced My Bookings Page**: Separate tabs for personal vs team bookings
- **Visual Indicators**: Clear distinction between personal and team bookings
- **Pagination Support**: Efficient handling of large teams

### Database Schema Updates
- `teams` table: Stores team information
- `team_members` table: Manages team membership relationships
- Foreign key constraints and indexes for optimal performance

## Troubleshooting

### Common Issues

#### Migration Failures
```bash
# Check migration logs
docker-compose logs db-init

# Manually run teams migration
docker-compose exec app node scripts/docker-migrate-teams-v1.5.3.cjs
```

#### Database Connection Issues
```bash
# Verify database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Test connection
docker-compose exec db pg_isready -U postgres
```

#### Teams Feature Not Working
1. Verify migration completed successfully
2. Check admin/site manager role permissions
3. Verify SendGrid configuration for team invitations
4. Check browser console for JavaScript errors

### Performance Monitoring
```bash
# Monitor resource usage
docker stats

# Check application logs
docker-compose logs -f app

# Monitor database performance
docker-compose exec db pg_stat_activity
```

## Rollback Procedure
If issues occur, rollback to previous version:

```bash
# Stop current deployment
docker-compose down

# Restore database backup (if available)
# ... restore process ...

# Deploy previous version
export VERSION=1.5.2
docker-compose up -d
```

## Post-Deployment Tasks

### 1. Create Initial Teams
- Login as admin
- Navigate to Settings → Teams
- Create initial production teams
- Invite team members

### 2. User Training
- Inform users about new Teams feature
- Demonstrate My Bookings page changes
- Train team leads on team management

### 3. Monitoring Setup
- Set up log monitoring for team-related activities
- Monitor team invitation email delivery
- Track team booking usage patterns

## Security Considerations

### Team Access Control
- Only admin and site manager roles can manage teams
- Team members can only view, not edit, other team member bookings
- Team invitations require valid email verification

### Data Privacy
- Team bookings maintain all existing privacy controls
- Audit logs track all team management activities
- User permissions remain role-based

## Backup Strategy
```bash
# Backup teams data
docker-compose exec db pg_dump -U postgres -d bookstudio \
  --table=teams --table=team_members > teams_backup.sql

# Full database backup
docker-compose exec db pg_dump -U postgres bookstudio > full_backup_v1.5.3.sql
```

## Support Information
- **Version**: 1.5.3
- **Release Date**: [Current Date]
- **Critical Dependencies**: PostgreSQL 14+, SendGrid API
- **Browser Requirements**: Modern browsers with ES6 support

## Success Criteria
- ✅ All containers start successfully
- ✅ Database migration completes without errors
- ✅ Teams tables exist with proper constraints
- ✅ Application health check passes
- ✅ Teams management interface accessible to admins
- ✅ My Bookings page shows personal/team tabs
- ✅ Team invitations send successfully
- ✅ Team bookings display properly with visual indicators

This completes the comprehensive deployment checklist for BookStud.io v1.5.3 Teams Feature.