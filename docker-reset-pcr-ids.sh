#!/bin/bash

# Script to reset PCR room IDs in Docker environment

# This script should be run from the host machine 
# where the Docker container is running

echo "============================================"
echo "PCR Room ID Reset Script for Docker"
echo "============================================"
echo ""
echo "This script will:"
echo "1. Reset all PCR room IDs to start from 1"
echo "2. Update any bookings that reference these rooms"
echo "3. Reset the sequence for new PCR room IDs"
echo ""
echo "Warning: This operation cannot be undone!"
echo "Make sure you have a database backup if needed."
echo ""

# Enter the app container and run the reset script
docker exec -it bookstudio-app-1 /bin/bash -c "cd /app && tsx scripts/reset-pcr-room-ids.ts"

echo ""
echo "PCR room ID reset operation completed."
echo "Check the logs above for any errors."
echo "============================================"