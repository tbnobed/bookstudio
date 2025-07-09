/**
 * Quick fix script to rename user_id column to created_by in alerts table
 * This addresses the schema mismatch between database and application
 */

const { Pool } = require('pg');

async function fixAlertsColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Fixing alerts table schema...');
    
    // Check if user_id column exists
    const userIdExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alerts' 
        AND column_name = 'user_id'
      );
    `);
    
    // Check if created_by column exists
    const createdByExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alerts' 
        AND column_name = 'created_by'
      );
    `);
    
    if (userIdExists.rows[0].exists && !createdByExists.rows[0].exists) {
      console.log('Renaming user_id column to created_by...');
      await pool.query('ALTER TABLE alerts RENAME COLUMN user_id TO created_by;');
      console.log('✅ Successfully renamed user_id to created_by');
    } else if (createdByExists.rows[0].exists) {
      console.log('✅ created_by column already exists, no changes needed');
    } else {
      console.log('❌ Neither user_id nor created_by column found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing alerts column:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixAlertsColumn()
  .then(() => {
    console.log('🎉 Alerts column fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to fix alerts column:', error);
    process.exit(1);
  });