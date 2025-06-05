# Production Template Restoration Guide

## Issue: Templates Not Loading Due to Schema Changes

Your production environment is experiencing template loading failures because the database schema has been updated with new columns that don't exist in your current templates table.

## Error Symptoms

```
Error getting all templates: error: column "studio_ids" does not exist
Error getting all templates: error: column "start_time" does not exist
Error getting all templates: error: column "end_time" does not exist
```

## Solution: Automated Template Restoration

The Docker deployment now includes automatic template restoration that will:

1. **Add Missing Columns**: Automatically adds required schema columns
2. **Fix Data Format Issues**: Corrects JSON formatting problems
3. **Migrate Legacy Data**: Converts old template formats to new schema
4. **Preserve Existing Templates**: Keeps all your current template configurations

## Production Deployment Commands

### Option 1: Full Docker Deployment (Recommended)

```bash
# Stop existing services
docker-compose down

# Pull latest code and rebuild
git pull origin main
docker-compose build

# Deploy with automatic template restoration
docker-compose up -d
```

### Option 2: Manual Template Fix (If needed)

If templates still fail after deployment, run the restoration script manually:

```bash
# Connect to running application container
docker-compose exec app node scripts/docker-restore-legacy-templates.cjs
```

### Option 3: Direct Database Fix

Connect directly to your production database and run:

```sql
-- Add missing columns if they don't exist
ALTER TABLE templates ADD COLUMN IF NOT EXISTS studio_ids TEXT DEFAULT '[]';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS pcr_room_id INTEGER;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';

-- Fix data format issues
UPDATE templates SET studio_ids = '[]' WHERE studio_ids IS NULL OR studio_ids = '';
UPDATE templates SET status = 'confirmed' WHERE status IS NULL OR status = '';
UPDATE templates SET color = '#3b82f6' WHERE color IS NULL OR color = '';

-- Fix notify_list format (if it's causing issues)
UPDATE templates SET notify_list = '[]'::json WHERE notify_list::text = '' OR notify_list IS NULL;
```

## What Gets Restored

Your templates will be automatically updated to include:

- **Multi-Studio Support**: `studio_ids` column for selecting multiple studios
- **Time Fields**: `start_time` and `end_time` for template timing
- **PCR Room Integration**: `pcr_room_id` for production control room assignments
- **Status Management**: `status` column for booking workflow states
- **Color Coding**: `color` column for visual categorization
- **Notification Groups**: `notify_list` for team-based alerts

## Verification Steps

After deployment, verify templates are working:

1. **Check Application Logs**:
```bash
docker-compose logs app | grep templates
```

2. **Test Template Loading**:
```bash
curl http://your-domain.com/api/templates
```

3. **Verify in Application**:
   - Navigate to Templates section
   - Create a new booking and check template dropdown
   - Ensure all your existing templates appear

## Backup Before Deployment

Always backup your production database before deployment:

```bash
# Create backup
docker-compose exec app bash /app/scripts/production-backup.sh

# Or manual PostgreSQL backup
docker-compose exec db pg_dump -U postgres bookstudio > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Rollback Plan

If something goes wrong, restore from backup:

```bash
# Restore from latest backup
docker-compose exec app bash /app/scripts/production-restore.sh backup_filename.sql.gz
```

## Expected Results

After successful deployment:

- Templates section will load without errors
- All your existing templates will appear with preserved settings
- New template features (time fields, multi-studio) will be available
- Template application will work in booking creation

## Template Migration Details

The restoration process specifically handles:

1. **Schema Compatibility**: Ensures all required columns exist
2. **Data Migration**: Converts old single-studio format to multi-studio arrays
3. **Default Values**: Sets appropriate defaults for new fields
4. **JSON Format Fixes**: Corrects notify_list formatting issues
5. **Legacy Preservation**: Maintains all existing template configurations

Your production environment will have fully functional templates after this deployment.