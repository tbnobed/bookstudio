/**
 * Docker-specific fix for alerts table schema
 * Runs in Docker environment to fix column naming issue
 */

const { Pool } = require('pg');

async function fixDockerAlerts() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://bookstudio:bookstudio@db:5432/bookstudio',
  });

  try {
    console.log('🔧 Fixing Docker alerts table schema...');
    
    // Check current table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'alerts'
      ORDER BY ordinal_position;
    `);
    
    console.log('Current alerts table columns:');
    columns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
    // Check if user_id column exists and created_by doesn't
    const hasUserId = columns.rows.some(row => row.column_name === 'user_id');
    const hasCreatedBy = columns.rows.some(row => row.column_name === 'created_by');
    
    if (hasUserId && !hasCreatedBy) {
      console.log('Renaming user_id to created_by...');
      await pool.query('ALTER TABLE alerts RENAME COLUMN user_id TO created_by;');
      console.log('✅ Successfully renamed user_id to created_by');
    } else if (hasCreatedBy) {
      console.log('✅ created_by column already exists');
    } else {
      console.log('❌ Unexpected table structure');
    }
    
  } catch (error) {
    console.error('❌ Error fixing Docker alerts:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixDockerAlerts()
  .then(() => {
    console.log('🎉 Docker alerts fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Docker alerts fix failed:', error);
    process.exit(1);
  });