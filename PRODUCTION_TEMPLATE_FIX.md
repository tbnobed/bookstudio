# Production Template Fix Guide

## Problem
Templates created before the database schema update may not work correctly with the new template application logic. This happens when legacy templates have incompatible data formats in the `studio_ids` and `notify_list` columns.

## Solution
Run the production template migration script to convert legacy template data to the new format.

## Quick Fix Commands

### Option 1: Using Docker (Recommended)
```bash
# Run the migration script inside the Docker container
docker-compose exec app node scripts/fix-production-templates.js
```

### Option 2: Using Direct Node.js
```bash
# Run the migration script directly
node scripts/fix-production-templates.js
```

## What the Script Does

1. **Checks Current Templates**: Examines all existing templates in the database
2. **Converts Studio IDs**: Fixes `studio_ids` format from legacy single values to JSON arrays
3. **Fixes Notify Lists**: Ensures `notify_list` is in proper JSON array format
4. **Sets Missing Fields**: Adds default values for required fields:
   - `status`: "confirmed"
   - `color`: "#3b82f6" (blue)
   - `type`: "production"
   - `duration`: 120 minutes
5. **Shows Results**: Displays before/after comparison

## Expected Output

```
🔧 Starting production template migration...

✓ Database connection established

Found 3 templates to process:
- ID: 1, Name: "News Template"
  Current studios: 2, Status: NULL, Color: NULL
- ID: 2, Name: "Sports Template"  
  Current studios: [1,2], Status: confirmed, Color: #ff0000

🔄 Converting legacy template data...

Processing: News Template (ID: 1)
  → Converting legacy studio ID "2" to JSON array [2]
  → Setting default status: confirmed
  → Setting default color: #3b82f6
  ✅ Updated template "News Template"

Processing: Sports Template (ID: 2)
  ✅ Template "Sports Template" already in correct format

📊 Final template status after migration:

- Template ID: 1 - "News Template"
  Studios: [2]
  Status: confirmed, Color: #3b82f6, Type: production
  Duration: 120 min, PCR Room: None

- Template ID: 2 - "Sports Template"
  Studios: [1,2]
  Status: confirmed, Color: #ff0000, Type: production
  Duration: 120 min, PCR Room: 1

🎉 Production template migration completed successfully!

Templates should now work correctly with the booking form.
```

## Verification

After running the script:

1. **Test Template Application**: 
   - Open the booking form
   - Select a template from the dropdown
   - Verify all fields populate correctly (studios, times, colors, etc.)

2. **Check Database**: 
   - Templates should have proper JSON format in `studio_ids` column
   - All required fields should have values

## Troubleshooting

### Script Fails to Connect
- Verify `DATABASE_URL` environment variable is set correctly
- Check database is running and accessible

### Templates Still Don't Work
- Clear browser cache and reload the application
- Check browser console for JavaScript errors
- Verify the script completed without errors

### Missing Templates After Migration
- Check if templates were accidentally deleted
- Restore from backup if needed
- The script creates a default template if none exist

## Integration with Deployment

This script is automatically included in the Docker deployment process via:
- `scripts/docker-restore-legacy-templates.cjs` (automatic on container start)
- `scripts/fix-production-templates.js` (manual execution)

For automated deployment, the legacy template restoration runs during container initialization and handles most cases automatically.