#!/bin/bash
set -e

echo "Building BookStud.io for production..."

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build the application
echo "Building application..."
npm run build

# Compile TypeScript files for init and migration scripts
echo "Compiling database scripts..."
npx tsc scripts/init-db.ts --outDir scripts/ --esModuleInterop true --module CommonJS
npx tsc scripts/migrate-db.ts --outDir scripts/ --esModuleInterop true --module CommonJS

echo "Build complete! You can now deploy the application using ./deploy.sh"