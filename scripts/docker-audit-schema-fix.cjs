/**
 * Docker Audit Schema Fix - Handle old audit_logs table with wrong column names
 * 
 * This script specifically addresses the Docker deployment issue where
 * an older migration creates audit_logs with resource_type/resource_name
 * instead of entity_type/entity_title
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

async function fixDockerAuditSchema() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    console.log('🔧 Docker Audit Schema Fix - Handling old audit_logs table...');
    
    // Begin transaction
    await client.query('BEGIN');

    // Check if audit_logs table exists and get its structure
    const tableCheck = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position;
    `);

    if (tableCheck.rows.length === 0) {
      console.log('📋 No audit_logs table found, will be created by v1.5.2 migration');
      await client.query('COMMIT');
      return;
    }

    console.log('📋 Current audit_logs columns:', tableCheck.rows.map(r => r.column_name));
    const existingColumns = tableCheck.rows.map(row => row.column_name);

    // Check if this is the old schema with resource_type/resource_name
    const hasOldSchema = existingColumns.includes('resource_type') || existingColumns.includes('resource_name');
    const hasNewSchema = existingColumns.includes('entity_type') && existingColumns.includes('entity_title');

    if (hasOldSchema && !hasNewSchema) {
      console.log('🔍 Found old audit_logs schema - dropping and recreating with correct schema...');
      
      // Drop the old table (it likely has minimal data in Docker fresh deployment)
      await client.query('DROP TABLE IF EXISTS audit_logs CASCADE;');
      console.log('🗑️ Dropped old audit_logs table');
      
      // Create new table with correct schema
      await client.query(`
        CREATE TABLE audit_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id INTEGER,
          entity_title TEXT,
          details JSON DEFAULT '{}',
          ip_address TEXT,
          user_agent TEXT,
          timestamp TIMESTAMP DEFAULT NOW()
        );
      `);
      
      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
      `);
      
      console.log('✅ Created new audit_logs table with correct schema');
      
    } else if (!hasOldSchema && hasNewSchema) {
      console.log('✅ Audit_logs table already has correct schema');
      
    } else {
      console.log('🔄 Mixed schema detected, ensuring correct column names...');
      
      // Rename columns if needed
      if (existingColumns.includes('resource_type') && !existingColumns.includes('entity_type')) {
        await client.query('ALTER TABLE audit_logs RENAME COLUMN resource_type TO entity_type;');
        console.log('🔄 Renamed resource_type to entity_type');
      }
      
      if (existingColumns.includes('resource_name') && !existingColumns.includes('entity_title')) {
        await client.query('ALTER TABLE audit_logs RENAME COLUMN resource_name TO entity_title;');
        console.log('🔄 Renamed resource_name to entity_title');
      }
      
      // Ensure required columns exist
      const finalCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'audit_logs';
      `);
      const finalColumns = finalCheck.rows.map(row => row.column_name);
      
      const requiredColumns = [
        'id', 'user_id', 'action', 'entity_type', 'entity_id', 
        'entity_title', 'details', 'ip_address', 'user_agent', 'timestamp'
      ];
      
      for (const column of requiredColumns) {
        if (!finalColumns.includes(column)) {
          console.log(`➕ Adding missing column: ${column}`);
          
          switch (column) {
            case 'entity_type':
              await client.query(`ALTER TABLE audit_logs ADD COLUMN ${column} TEXT NOT NULL DEFAULT 'unknown';`);
              break;
            case 'entity_id':
              await client.query(`ALTER TABLE audit_logs ADD COLUMN ${column} INTEGER;`);
              break;
            case 'entity_title':
              await client.query(`ALTER TABLE audit_logs ADD COLUMN ${column} TEXT;`);
              break;
            case 'ip_address':
              await client.query(`ALTER TABLE audit_logs ADD COLUMN ${column} TEXT;`);
              break;
            case 'user_agent':
              await client.query(`ALTER TABLE audit_logs ADD COLUMN ${column} TEXT;`);
              break;
            case 'details':
              await client.query(`ALTER TABLE audit_logs ADD COLUMN ${column} JSON DEFAULT '{}';`);
              break;
            case 'action':
              await client.query(`ALTER TABLE audit_logs ADD COLUMN ${column} TEXT NOT NULL DEFAULT 'unknown';`);
              break;
            case 'user_id':
              await client.query(`ALTER TABLE audit_logs ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0;`);
              break;
          }
        }
      }
    }

    // Verify final structure
    const finalTableCheck = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 Final audit_logs structure:', finalTableCheck.rows);

    // Test the table works with new schema
    try {
      const testResult = await client.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_title, details)
        VALUES (0, 'docker_schema_fix_test', 'system', 'Docker Schema Fix', $1)
        RETURNING id;
      `, [JSON.stringify({ 
        fix: 'docker_audit_schema',
        status: 'testing',
        timestamp: new Date().toISOString()
      })]);
      
      console.log('✅ Test audit log created with ID:', testResult.rows[0].id);
      
      // Clean up test log
      await client.query('DELETE FROM audit_logs WHERE id = $1', [testResult.rows[0].id]);
      console.log('🧹 Test audit log cleaned up');
      
    } catch (testError) {
      console.error('❌ Test insert failed:', testError.message);
      throw testError;
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Docker audit schema fix completed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing Docker audit schema:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixDockerAuditSchema()
    .then(() => {
      console.log('🎉 Docker audit schema fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Docker audit schema fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDockerAuditSchema };