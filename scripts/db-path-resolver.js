#!/usr/bin/env node

/**
 * This script helps resolve module paths in Docker environments
 * It creates CommonJS wrapper modules for ESM modules to be used in Docker
 */
const fs = require('fs');
const path = require('path');

// Detect if running in Docker
const isDocker = process.env.RUNNING_IN_DOCKER === 'true';

function createDocker2LocalPath(dockerPath, localPath) {
  const content = `
// This is an auto-generated module path resolver for Docker environments
const path = require('path');
const fs = require('fs');

// Determine if we're in Docker
const isDocker = process.env.RUNNING_IN_DOCKER === 'true';

// Resolve the correct path
const resolvedPath = isDocker ? '${dockerPath}' : path.resolve(__dirname, '${localPath}');

// Check if the file exists
if (!fs.existsSync(resolvedPath)) {
  console.error(\`Error: Could not find module at \${resolvedPath}\`);
  process.exit(1);
}

// Export the resolved path
module.exports = {
  path: resolvedPath
};
`;

  return content;
}

// Create the server db path resolver
const dbResolverContent = createDocker2LocalPath('/app/server/db.js', '../server/db.js');

// Write the resolver to a file
const resolverPath = path.join(__dirname, 'server-db-resolver.cjs');
fs.writeFileSync(resolverPath, dbResolverContent);

console.log(`Created module path resolver at ${resolverPath}`);
console.log('Module resolution setup completed successfully');