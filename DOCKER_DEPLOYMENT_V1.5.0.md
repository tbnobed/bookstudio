# BookStud.io v1.5.0 - Docker Deployment Guide
## Linked Copy Features & Recent Updates

### New Features in v1.5.0

#### 🔗 Linked Copy System
- **Linked Booking Creation**: Users can create linked copies where updates to one booking automatically update all linked copies
- **Selective Deletion**: Choose to delete individual bookings or entire linked groups
- **Visual Indicators**: Linked bookings are clearly marked in the calendar interface
- **Bidirectional Relationships**: Updates propagate in both directions between linked bookings

#### 🔧 Modal Architecture Improvements
- **Fixed Day View New Booking**: Resolved issue where Copy/Delete buttons appeared in new booking forms
- **Responsive Modal System**: Proper routing between ResponsiveBookingModal, BookingModal, and SimpleMobileForm
- **Mobile Optimization**: Enhanced mobile booking form with proper validation and error handling

#### 📊 Database Schema Updates
- **linked_bookings table**: New table to manage booking relationships
- **Enhanced bookings table**: Added `link_group_id` and `is_primary_in_group` fields
- **Improved indexes**: Optimized database performance for linked booking queries

### Docker Deployment Changes

#### Updated Migration Scripts
1. **consolidated-migration.cjs**: Now includes linked bookings table creation
2. **docker-migrate-linked-bookings.cjs**: Dedicated migration for linked copy features
3. **Enhanced schema-repair.cjs**: Ensures database consistency for existing deployments

#### Version Updates
- **Application Version**: Updated to v1.5.0 with Linked Copy Features
- **Docker Image**: bookstudio:1.5.0
- **Database Schema**: Version 1.5.0 compatible

### Deployment Instructions

#### For New Installations
```bash
# Set version in .env file
export VERSION=1.5.0

# Build and deploy
docker-compose up --build -d
```

#### For Existing Installations
```bash
# Pull latest changes
git pull origin main

# Update version
export VERSION=1.5.0

# Rebuild with new features
docker-compose down
docker-compose up --build -d
```

### Environment Variables

#### Required for v1.5.0
- `VITE_FACILITY_TIMEZONE`: Facility timezone for consistent date handling
- `DATABASE_URL`: PostgreSQL connection string
- `SENDGRID_API_KEY`: Email notifications
- `SENDGRID_VERIFIED_SENDER`: Verified sender email

#### New in v1.5.0
- Enhanced timezone handling with `FACILITY_TIMEZONE`
- Improved Docker container logging
- Better error handling for linked bookings

### Database Changes

#### New Tables
```sql
-- Linked bookings relationships
CREATE TABLE linked_bookings (
  id SERIAL PRIMARY KEY,
  primary_booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  linked_booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(primary_booking_id, linked_booking_id),
  CHECK (primary_booking_id != linked_booking_id)
);
```

#### Updated Tables
```sql
-- Enhanced bookings table
ALTER TABLE bookings ADD COLUMN link_group_id TEXT;
ALTER TABLE bookings ADD COLUMN is_primary_in_group BOOLEAN DEFAULT FALSE;
```

### API Endpoints

#### New Linked Bookings Endpoints
- `GET /api/linked-bookings/:id` - Get linked bookings for a booking
- `POST /api/linked-bookings` - Create linked booking relationship
- `DELETE /api/linked-bookings/:id` - Delete linked booking (with options)

#### Enhanced Booking Endpoints
- `POST /api/bookings/copy-linked` - Create linked copy of booking
- `PUT /api/bookings/:id/update-linked` - Update all linked bookings
- `DELETE /api/bookings/:id/delete-group` - Delete entire linked group

### Migration Process

The deployment automatically runs these migrations in order:
1. **consolidated-migration.cjs** - Core table creation
2. **schema-repair.cjs** - Fix existing schema issues
3. **docker-fix-alerts.cjs** - Alert system updates
4. **docker-migrate-linked-bookings.cjs** - Linked copy features

### Troubleshooting

#### Common Issues

**Migration Failures**
```bash
# Check migration logs
docker-compose logs db-init

# Manual migration run
docker-compose exec app node scripts/docker-migrate-linked-bookings.cjs
```

**Database Connection Issues**
```bash
# Verify database health
docker-compose exec db pg_isready -U postgres

# Check database tables
docker-compose exec db psql -U postgres -d bookstudio -c "\dt"
```

**Linked Bookings Not Working**
```bash
# Verify linked_bookings table exists
docker-compose exec db psql -U postgres -d bookstudio -c "SELECT COUNT(*) FROM linked_bookings;"

# Check booking table columns
docker-compose exec db psql -U postgres -d bookstudio -c "\d bookings"
```

### Health Checks

The application includes comprehensive health checks:
- **Database connectivity**: PostgreSQL connection verification
- **API endpoints**: Core API functionality tests
- **Linked bookings**: Relationship integrity checks

### Backup and Restore

#### Enhanced Backup System
```bash
# Create backup with linked bookings
docker-compose exec app /app/scripts/production-backup.sh

# Restore from backup
docker-compose exec app /app/scripts/production-restore.sh backup_file.sql
```

#### Data Integrity
- Linked booking relationships are preserved in backups
- Foreign key constraints ensure data consistency
- Automatic cleanup of orphaned relationships

### Performance Optimizations

#### Database Indexes
- `idx_linked_bookings_primary` - Primary booking lookups
- `idx_linked_bookings_linked` - Linked booking searches
- Enhanced booking queries for linked relationships

#### Caching Improvements
- Optimized booking-studio link queries
- Reduced database calls for linked booking operations
- Improved frontend state management

### Security Updates

#### Enhanced Validation
- Linked booking creation permissions
- User role-based access to linked operations
- Improved API endpoint security

#### Data Protection
- Cascading deletes for data integrity
- Transaction-based linked operations
- Enhanced error handling and logging

### Next Steps

After successful deployment:
1. Verify linked booking functionality in the UI
2. Test booking copy and update operations
3. Check modal behavior in day view
4. Confirm database migration completion
5. Review application logs for any errors

For technical support, check the application logs and database migration output.