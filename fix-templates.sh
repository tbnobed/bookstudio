#!/bin/bash

# Production Template Fix Script
# This script fixes legacy templates in production environments

echo "🔧 BookStud.io Template Migration Tool"
echo "====================================="
echo ""

# Check if running in Docker environment
if [ -f /.dockerenv ]; then
    echo "✓ Running inside Docker container"
    EXEC_PREFIX=""
else
    echo "ℹ Running on host system - will use docker-compose exec"
    EXEC_PREFIX="docker-compose exec app"
fi

echo ""
echo "This script will:"
echo "1. Connect to your production database"
echo "2. Convert legacy template data to new format" 
echo "3. Fix studio_ids and notify_list columns"
echo "4. Set missing required fields"
echo ""

read -p "Continue with template migration? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Starting template migration..."
echo ""

# Run the migration script
$EXEC_PREFIX node scripts/fix-production-templates.cjs

RESULT=$?

echo ""
if [ $RESULT -eq 0 ]; then
    echo "✅ Template migration completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Test template functionality in your booking form"
    echo "2. Verify templates populate all fields correctly"
    echo "3. Check that multi-studio selection works"
else
    echo "❌ Template migration failed!"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check DATABASE_URL environment variable"
    echo "2. Verify database is running and accessible"
    echo "3. Review error messages above"
    exit 1
fi