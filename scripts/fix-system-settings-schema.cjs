/**
 * Fix System Settings Schema - Correct column names
 * 
 * This script fixes the system_settings table to have the correct column names
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

async function fixSystemSettingsSchema() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    console.log('🔧 Fixing system_settings table schema...');
    
    // Begin transaction
    await client.query('BEGIN');

    // Check current table structure
    const currentColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'system_settings' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 Current system_settings columns:', currentColumns.rows.map(r => r.column_name));

    const existingColumns = currentColumns.rows.map(row => row.column_name);

    // If we have old column names, rename them to new ones
    if (existingColumns.includes('setting_key') && !existingColumns.includes('key')) {
      console.log('🔄 Renaming setting_key to key...');
      await client.query('ALTER TABLE system_settings RENAME COLUMN setting_key TO key;');
    }

    if (existingColumns.includes('setting_value') && !existingColumns.includes('value')) {
      console.log('🔄 Renaming setting_value to value...');
      await client.query('ALTER TABLE system_settings RENAME COLUMN setting_value TO value;');
    }

    // Drop description column if it exists (not needed in current schema)
    if (existingColumns.includes('description')) {
      console.log('🗑️ Dropping description column...');
      await client.query('ALTER TABLE system_settings DROP COLUMN IF EXISTS description;');
    }

    // Verify final structure
    const finalColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'system_settings' 
      ORDER BY ordinal_position;
    `);

    console.log('📋 Final system_settings structure:', finalColumns.rows);

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ System settings schema fix completed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing system settings schema:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixSystemSettingsSchema()
    .then(() => {
      console.log('🎉 System settings schema fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 System settings schema fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixSystemSettingsSchema };