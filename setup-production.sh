#!/bin/bash
set -e

echo "Setting up production environment..."

# Ensure Vite and its plugins are installed in production
if [ "$NODE_ENV" = "production" ]; then
  echo "Installing Vite and its plugins for production..."
  npm install --no-save @vitejs/plugin-react vite @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal
  
  # Fix node_modules paths to ensure they're available in the production environment
  echo "Creating node_modules symlink for production..."
  if [ ! -d /app/dist/node_modules ]; then
    mkdir -p /app/dist/node_modules
  fi
  
  # Copy just the required vite plugins so they're available
  echo "Copying required Vite plugins to dist folder..."
  cp -r /app/node_modules/vite /app/dist/node_modules/
  cp -r /app/node_modules/@vitejs /app/dist/node_modules/
  cp -r /app/node_modules/@replit /app/dist/node_modules/
  
  # Create fallback module for any other missing dependencies
  echo "Creating fallback module handler..."
  cat > /app/dist/module-loader.js << 'EOL'
  // This is a custom module loader that will try to load modules from the main node_modules
  // if they're not found in the dist folder
  const originalRequire = module.constructor.prototype.require;
  module.constructor.prototype.require = function(path) {
    try {
      return originalRequire.call(this, path);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        try {
          // Try to load from the root node_modules
          return originalRequire.call(this, require('path').resolve('/app/node_modules', path));
        } catch (e) {
          throw err; // If that also fails, throw the original error
        }
      }
      throw err;
    }
  };
EOL

  # Add the module loader to the start script
  echo "Modifying the start script to use module loader..."
  cat > /app/start-with-module-loader.js << 'EOL'
  // Load the module loader first
  require('./module-loader');
  // Then load the actual index.js
  require('./index.js');
EOL

  echo "Production environment setup completed."
fi

# Run the original command
if [ "$NODE_ENV" = "production" ] && [ "$1" = "npm" ] && [ "$2" = "start" ]; then
  echo "Starting with custom module loader..."
  cd /app/dist
  exec node start-with-module-loader.js
else
  exec "$@"
fi