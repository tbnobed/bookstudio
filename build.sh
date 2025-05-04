#!/bin/bash
set -e

echo "Building BookStud.io for production..."

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build the application
echo "Building application..."
npm run build

# We're using the JavaScript versions directly
echo "Skipping TypeScript compilation for database scripts..."

echo "Build complete! You can now deploy the application using ./deploy.sh"