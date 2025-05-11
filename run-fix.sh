#!/bin/bash
# Script to run the BookStud.io database fixes and then start the application

echo "Running comprehensive database schema fix..."
node scripts/fix-db-all.js

echo "Running booking-studio display fix..."
node scripts/fix-bookstudio-display.js

echo "Starting BookStud.io application..."
npm run dev