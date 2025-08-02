/**
 * Production Migration v1.5.2
 * Comprehensive Audit Logging Enhancement
 * 
 * This migration ensures the audit_logs table is properly set up with all required columns
 * for comprehensive system-wide audit tracking.
 */

const { Pool } = require('pg');

// Database configuration - handle SSL more intelligently
const dbConfig = {
  connectionString: process.env.DATABASE_URL
};

// Only add SSL config if the connection string indicates it's needed
// Docker local PostgreSQL doesn't need SSL, but external services might
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('ssl=true')) {
  dbConfig.ssl = { rejectUnauthorized: false };
} else {
  // For Docker and local development, explicitly disable SSL
  dbConfig.ssl = false;
}

async function runMigration() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Production Migration v1.5.2 - Comprehensive Audit Logging Enhancement');
    
    // Begin transaction
    await client.query('BEGIN');

    // Check if audit_logs table exists and has all required columns
    const auditTableCheck = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 Current audit_logs table structure:', auditTableCheck.rows);

    // Create audit_logs table if it doesn't exist
    if (auditTableCheck.rows.length === 0) {
      console.log('🆕 Creating audit_logs table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
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
      
      console.log('✅ Created audit_logs table with indexes');
    } else {
      console.log('📋 Audit_logs table exists, checking columns...');
      
      const existingColumns = auditTableCheck.rows.map(row => row.column_name);
      const requiredColumns = [
        'id', 'user_id', 'action', 'entity_type', 'entity_id', 
        'entity_title', 'details', 'ip_address', 'user_agent', 'timestamp'
      ];
      
      // Add missing columns
      for (const column of requiredColumns) {
        if (!existingColumns.includes(column)) {
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
      
      // Ensure indexes exist
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
      `);
    }

    // Verify table structure after migration
    const finalTableCheck = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 Final audit_logs table structure:', finalTableCheck.rows);

    // Test audit logging functionality
    console.log('🧪 Testing audit logging functionality...');
    
    const testLogResult = await client.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_title, details)
      VALUES (0, 'migration_test', 'system', 'Migration v1.5.2', $1)
      RETURNING id;
    `, [JSON.stringify({ 
      migration: 'v1.5.2',
      status: 'testing',
      timestamp: new Date().toISOString()
    })]);

    console.log(`✅ Test audit log created with ID: ${testLogResult.rows[0].id}`);

    // Clean up test log
    await client.query('DELETE FROM audit_logs WHERE id = $1', [testLogResult.rows[0].id]);
    console.log('🧹 Test audit log cleaned up');

    // Count existing audit logs
    const auditCount = await client.query('SELECT COUNT(*) FROM audit_logs');
    console.log(`📊 Total audit logs in database: ${auditCount.rows[0].count}`);

    // Add a migration completion audit log
    await client.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_title, details)
      VALUES (0, 'migration_completed', 'system', 'Migration v1.5.2', $1);
    `, [JSON.stringify({ 
      migration: 'v1.5.2',
      description: 'Comprehensive audit logging enhancement completed',
      features: [
        'Enhanced audit logging for user management',
        'Template operations audit logging',
        'Alert management audit logging',
        'System configuration audit logging',
        'Studio and PCR room management audit logging',
        'Notification group management audit logging'
      ],
      completedAt: new Date().toISOString()
    })]);

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('');
    console.log('🎉 Production Migration v1.5.2 completed successfully!');
    console.log('');
    console.log('📈 Enhanced Features:');
    console.log('   ✅ Comprehensive audit logging across all system operations');
    console.log('   ✅ User management operations tracking');
    console.log('   ✅ Template CRUD operations logging');
    console.log('   ✅ Alert management audit trail');
    console.log('   ✅ System configuration changes tracking');
    console.log('   ✅ Studio and PCR room management logging');
    console.log('   ✅ Notification group management audit trail');
    console.log('   ✅ Enhanced audit log display with proper null handling');
    console.log('   ✅ 90-day retention policy with automatic cleanup');
    console.log('');

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    console.error('🔄 Transaction rolled back');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };