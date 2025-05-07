#!/bin/bash
# Script to build the application for Docker production environment

# Ensure we're in the app directory
cd /app

echo "Building client application..."
npx vite build

echo "Building server application..."
npx esbuild server/index.prod.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --outfile=dist/index.js

echo "Copying static assets..."
if [ ! -d "dist/public" ]; then
  mkdir -p dist/public
  cp -r public/* dist/public/
fi

echo "Making build outputs accessible..."
chmod -R 755 dist

echo "Build completed successfully!"