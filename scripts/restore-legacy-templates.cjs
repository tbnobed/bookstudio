const { Pool } = require('pg');

async function restoreLegacyTemplates() {
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'bookstudio',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres'
  });

  try {
    console.log('Restoring and updating legacy templates...');

    // First, check what columns exist in the templates table
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'templates'
      ORDER BY ordinal_position;
    `);

    const existingColumns = columnsResult.rows.map(row => row.column_name);
    console.log('Existing columns in templates table:', existingColumns);

    // Add missing columns if they don't exist
    const requiredColumns = [
      { name: 'studio_ids', type: 'TEXT', defaultValue: '[]' },
      { name: 'start_time', type: 'TEXT', defaultValue: null },
      { name: 'end_time', type: 'TEXT', defaultValue: null },
      { name: 'pcr_room_id', type: 'INTEGER', defaultValue: null },
      { name: 'status', type: 'TEXT', defaultValue: "'confirmed'" },
      { name: 'color', type: 'TEXT', defaultValue: "'#3b82f6'" },
      { name: 'notify_list', type: 'TEXT', defaultValue: '[]' }
    ];

    for (const column of requiredColumns) {
      if (!existingColumns.includes(column.name)) {
        console.log(`Adding missing column: ${column.name}`);
        let alterQuery = `ALTER TABLE templates ADD COLUMN ${column.name} ${column.type}`;
        if (column.defaultValue) {
          alterQuery += ` DEFAULT ${column.defaultValue}`;
        }
        await pool.query(alterQuery);
        console.log(`✓ Added ${column.name} column`);
      } else {
        console.log(`✓ Column ${column.name} already exists`);
      }
    }

    // Update existing templates to have proper default values
    console.log('Updating existing templates with default values...');
    
    // Set default studio_ids for templates that don't have them
    await pool.query(`
      UPDATE templates 
      SET studio_ids = '[]' 
      WHERE studio_ids IS NULL OR studio_ids = '';
    `);

    // Set default notify_list for templates that don't have them
    await pool.query(`
      UPDATE templates 
      SET notify_list = '[]' 
      WHERE notify_list IS NULL OR notify_list = '';
    `);

    // Set default status for templates that don't have them
    await pool.query(`
      UPDATE templates 
      SET status = 'confirmed' 
      WHERE status IS NULL OR status = '';
    `);

    // Set default color for templates that don't have them
    await pool.query(`
      UPDATE templates 
      SET color = '#3b82f6' 
      WHERE color IS NULL OR color = '';
    `);

    // Try to infer studio_ids from any legacy studioId column if it exists
    const legacyStudioCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'templates' 
        AND column_name = 'studio_id'
      );
    `);

    if (legacyStudioCheck.rows[0].exists) {
      console.log('Found legacy studio_id column, migrating to studio_ids...');
      await pool.query(`
        UPDATE templates 
        SET studio_ids = CASE 
          WHEN studio_id IS NOT NULL THEN '[' || studio_id || ']'
          ELSE '[]'
        END
        WHERE (studio_ids IS NULL OR studio_ids = '' OR studio_ids = '[]')
        AND studio_id IS NOT NULL;
      `);
      console.log('✓ Migrated legacy studio_id values to studio_ids');
    }

    // Get all current templates to show what we have
    const templatesResult = await pool.query(`
      SELECT id, name, description, studio_ids, start_time, end_time, 
             pcr_room_id, status, color, notify_list
      FROM templates 
      ORDER BY id;
    `);

    console.log('\nCurrent templates after restoration:');
    templatesResult.rows.forEach(template => {
      console.log(`- ID: ${template.id}, Name: "${template.name}", Studios: ${template.studio_ids}, Status: ${template.status}`);
    });

    // If no templates exist, create a default one
    if (templatesResult.rows.length === 0) {
      console.log('\nNo templates found, creating default template...');
      await pool.query(`
        INSERT INTO templates (name, description, studio_ids, status, color, notify_list)
        VALUES (
          'Default Template',
          'A basic template for general bookings',
          '[1]',
          'confirmed',
          '#3b82f6',
          '[]'
        );
      `);
      console.log('✓ Created default template');
    }

    console.log('\nLegacy templates restoration completed successfully!');

  } catch (error) {
    console.error('Error restoring legacy templates:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

restoreLegacyTemplates();