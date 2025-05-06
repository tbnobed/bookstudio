#!/bin/bash
set -e

echo "Setting up production environment..."

# Ensure Vite and its plugins are installed
if [ "$NODE_ENV" = "production" ]; then
  echo "Installing Vite and its plugins for production..."
  npm install --no-save @vitejs/plugin-react vite
  
  # Create a symlink to our production-ready vite.ts (if it exists)
  if [ -f /app/server/vite.prod.ts ]; then
    echo "Using production-ready Vite setup..."
    cp -f /app/server/vite.prod.ts /app/dist/server/vite.js
  fi
fi

# Run the original command
exec "$@"