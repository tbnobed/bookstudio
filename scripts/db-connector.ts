/**
 * Database connector utility that resolves paths for both Docker and local environments
 */
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import * as fs from 'fs';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define paths to try
const paths = [
  // Docker path
  '/app/server/db.js',
  // Local development path
  resolve(__dirname, '../server/db.js'),
  // TypeScript paths for development
  resolve(__dirname, '../server/db.ts'),
];

// For debugging
console.log('Searching for database module in paths:');
paths.forEach(p => console.log(` - ${p} (exists: ${fs.existsSync(p)})`));

// Find the correct path
let dbPath = '';
for (const path of paths) {
  if (fs.existsSync(path)) {
    dbPath = path;
    console.log(`Using database module from: ${dbPath}`);
    break;
  }
}

if (!dbPath) {
  console.error('Could not find database module in any of the expected paths');
  process.exit(1);
}

// Export the module
export { dbPath };