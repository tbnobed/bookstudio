/**
 * Fix Audit Schema - Correct column names
 * 
 * This script fixes the audit_logs table to have the correct column names
 * expected by the application code.
 */

const { Pool } = require('pg');

// Database configuration - handle SSL more intelligently
const dbConfig = {
  connectionString: process.env.DATABASE_URL
};

// Only add SSL config if the connection string indicates it's needed
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('ssl=true')) {
  dbConfig.ssl = { rejectUnauthorized: false };
} else {
  dbConfig.ssl = false;
}

async function fixAuditSchema() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    console.log('🔧 Fixing audit_logs table schema...');
    
    // Begin transaction
    await client.query('BEGIN');

    // Check current table structure
    const currentColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 Current audit_logs columns:', currentColumns.rows.map(r => r.column_name));

    const existingColumns = currentColumns.rows.map(row => row.column_name);

    // If we have old column names, rename them to new ones
    if (existingColumns.includes('resource_type') && !existingColumns.includes('entity_type')) {
      console.log('🔄 Renaming resource_type to entity_type...');
      await client.query('ALTER TABLE audit_logs RENAME COLUMN resource_type TO entity_type;');
    }

    if (existingColumns.includes('resource_name') && !existingColumns.includes('entity_title')) {
      console.log('🔄 Renaming resource_name to entity_title...');
      await client.query('ALTER TABLE audit_logs RENAME COLUMN resource_name TO entity_title;');
    }

    // Add missing columns that should exist
    const requiredColumns = ['user_id', 'action', 'entity_type', 'entity_id', 'entity_title', 'details', 'ip_address', 'user_agent', 'timestamp'];
    
    for (const column of requiredColumns) {
      if (!existingColumns.includes(column)) {
        console.log(`➕ Adding missing column: ${column}`);
        
        switch (column) {
          case 'user_id':
            await client.query('ALTER TABLE audit_logs ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;');
            break;
          case 'action':
            await client.query('ALTER TABLE audit_logs ADD COLUMN action TEXT NOT NULL DEFAULT \'unknown\';');
            break;
          case 'entity_type':
            await client.query('ALTER TABLE audit_logs ADD COLUMN entity_type TEXT NOT NULL DEFAULT \'unknown\';');
            break;
          case 'entity_id':
            await client.query('ALTER TABLE audit_logs ADD COLUMN entity_id INTEGER;');
            break;
          case 'entity_title':
            await client.query('ALTER TABLE audit_logs ADD COLUMN entity_title TEXT;');
            break;
          case 'details':
            await client.query('ALTER TABLE audit_logs ADD COLUMN details JSON DEFAULT \'{}\';');
            break;
          case 'ip_address':
            await client.query('ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;');
            break;
          case 'user_agent':
            await client.query('ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;');
            break;
          case 'timestamp':
            await client.query('ALTER TABLE audit_logs ADD COLUMN timestamp TIMESTAMP DEFAULT NOW();');
            break;
        }
      }
    }

    // Remove old columns that shouldn't exist anymore
    const oldColumns = ['resource_type', 'resource_name', 'user_name'];
    for (const column of oldColumns) {
      if (existingColumns.includes(column)) {
        console.log(`🗑️ Dropping old column: ${column}`);
        await client.query(`ALTER TABLE audit_logs DROP COLUMN IF EXISTS ${column};`);
      }
    }

    // Recreate indexes with correct names
    await client.query(`
      DROP INDEX IF EXISTS idx_audit_logs_resource_type;
      DROP INDEX IF EXISTS idx_audit_logs_user_name;
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
    `);

    console.log('✅ Updated audit_logs indexes');

    // Verify final structure
    const finalColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 Final audit_logs structure:', finalColumns.rows);

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Audit schema fix completed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing audit schema:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixAuditSchema()
    .then(() => {
      console.log('🎉 Audit schema fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Audit schema fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAuditSchema };