// Support both Docker and local development environments
let db, pool, ensureConnection;
try {
  // Try Docker path first (absolute path)
  const dockerDb = require('/app/server/db');
  db = dockerDb.db;
  pool = dockerDb.pool;
  ensureConnection = dockerDb.ensureConnection;
  console.log('Using Docker database connection');
} catch (error) {
  // Fall back to local development path (relative path)
  const localDb = require('../server/db');
  db = localDb.db;
  pool = localDb.pool;
  ensureConnection = localDb.ensureConnection;
  console.log('Using local development database connection');
}
import { fileAttachments } from "../shared/schema";
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateFileAttachments() {
  console.log("Starting file attachments schema migration...");
  
  try {
    // Ensure database connection
    await ensureConnection();
    
    console.log("Creating file_attachments table...");
    
    // Create file_attachments table
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS file_attachments (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type TEXT NOT NULL,
        path TEXT NOT NULL,
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        description TEXT
      );
    `;
    
    await pool.query(createTableSql);
    
    // Create directory for file uploads if it doesn't exist
    const uploadDir = path.resolve(path.join(__dirname, '..', 'uploads'));
    if (!fs.existsSync(uploadDir)){
      console.log("Creating uploads directory...");
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    console.log("File attachments migration completed successfully!");
  } catch (error) {
    console.error("Error during file attachments migration:", error);
    throw error;
  } finally {
    // No need to close the pool as it might be used elsewhere
  }
}

// Self-invoke the function
migrateFileAttachments()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  });

export { migrateFileAttachments };