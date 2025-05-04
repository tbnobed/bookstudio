#!/bin/bash
set -e

# DEPRECATED: This script is no longer used
# Database initialization is now handled by the dedicated db-init container in docker-compose.yml

echo "WARNING: This script is deprecated and should not be used directly."
echo "Database initialization is now handled by the db-init container in docker-compose.yml"
echo "Run ./deploy.sh instead to properly deploy the application"
exit 1