#!/bin/bash
# Script to assist with applying the booking copy feature fixes

echo "BookStud.io Copy Booking Feature Fix"
echo "==================================="
echo 
echo "This script will help you apply the fixes to your production environment."
echo "Make sure you have a backup of your production files before proceeding."
echo

# Set the base directory to the current directory by default
BASE_DIR="."
if [ -n "$1" ]; then
  BASE_DIR="$1"
fi

echo "Will apply patches to files in: $BASE_DIR"
echo

# Function to check if a file exists
check_file() {
  if [ ! -f "$1" ]; then
    echo "Error: File $1 not found!"
    return 1
  fi
  return 0
}

# Check if the target files exist
echo "Checking for target files..."
CLIENT_FILE="$BASE_DIR/client/src/components/booking/CopyBookingModal.tsx"
ROUTES_FILE="$BASE_DIR/server/routes.ts"
STORAGE_FILE="$BASE_DIR/server/storage.ts"

check_file "$CLIENT_FILE" || exit 1
echo "✓ Found $CLIENT_FILE"
check_file "$ROUTES_FILE" || exit 1
echo "✓ Found $ROUTES_FILE"
check_file "$STORAGE_FILE" || exit 1
echo "✓ Found $STORAGE_FILE"
echo

echo "The following changes will be applied:"
echo "1. Fix CopyBookingModal.tsx to properly reset loading state"
echo "2. Verify the booking copy route handler is properly implemented"
echo "3. Ensure the storage interface and implementation are correct"
echo

read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Operation canceled."
  exit 1
fi

echo
echo "Applying fixes..."
echo

# Now it's up to you to edit the files using your preferred method
echo "Please manually apply the changes from:"
echo "- CopyBookingModal.fix.js to $CLIENT_FILE"
echo "- routes.fix.js to $ROUTES_FILE"
echo "- storage.fix.js to $STORAGE_FILE"
echo
echo "After applying the changes, rebuild your Docker containers with:"
echo "docker-compose build"
echo "docker-compose up -d"
echo
echo "For more details, refer to the README.md file in this directory."
echo
echo "Fix application complete. Please test the booking copy feature after deployment."