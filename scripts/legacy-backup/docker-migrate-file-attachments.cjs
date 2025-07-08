/**
 * File attachments migration script optimized for Docker environments
 * This is a CommonJS version of the migrate-file-attachments.ts script
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Ensure we have environment variables
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable must be set");
}

// Create database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function migrateFileAttachments() {
  console.log("Starting file attachments schema migration...");
  
  try {
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
    const uploadDir = path.resolve('/app/uploads');
    if (!fs.existsSync(uploadDir)){
      console.log("Creating uploads directory...");
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    console.log("File attachments migration completed successfully!");
  } catch (error) {
    console.error("Error during file attachments migration:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Self-invoke the function
migrateFileAttachments();