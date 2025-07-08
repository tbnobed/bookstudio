const { Pool } = require('pg');

async function migrateTemplateTimeFields() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'bookstudio',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres'
  });

  try {
    console.log('Migrating template time fields...');

    // Check if templates table exists
    const tableExistsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'templates'
      );
    `);

    if (!tableExistsResult.rows[0].exists) {
      console.log('Templates table does not exist, skipping time fields migration');
      return;
    }

    // Check if start_time column exists
    const startTimeExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'templates' 
        AND column_name = 'start_time'
      );
    `);

    if (!startTimeExists.rows[0].exists) {
      console.log('Adding start_time column to templates table...');
      await pool.query('ALTER TABLE templates ADD COLUMN start_time TEXT;');
      console.log('✓ Added start_time column');
    } else {
      console.log('✓ start_time column already exists');
    }

    // Check if end_time column exists
    const endTimeExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'templates' 
        AND column_name = 'end_time'
      );
    `);

    if (!endTimeExists.rows[0].exists) {
      console.log('Adding end_time column to templates table...');
      await pool.query('ALTER TABLE templates ADD COLUMN end_time TEXT;');
      console.log('✓ Added end_time column');
    } else {
      console.log('✓ end_time column already exists');
    }

    console.log('Template time fields migration completed successfully');

  } catch (error) {
    console.error('Error migrating template time fields:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateTemplateTimeFields();