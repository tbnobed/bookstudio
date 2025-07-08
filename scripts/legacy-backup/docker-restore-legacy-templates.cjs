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
    console.log('Restoring and updating legacy templates for production...');

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
      { name: 'studio_ids', type: 'TEXT', defaultValue: "'[]'" },
      { name: 'start_time', type: 'TEXT', defaultValue: null },
      { name: 'end_time', type: 'TEXT', defaultValue: null },
      { name: 'pcr_room_id', type: 'INTEGER', defaultValue: null },
      { name: 'status', type: 'TEXT', defaultValue: "'confirmed'" },
      { name: 'color', type: 'TEXT', defaultValue: "'#3b82f6'" },
      { name: 'notify_list', type: 'JSON', defaultValue: "'[]'::json" }
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

    // Fix data format issues for existing templates
    console.log('Fixing template data format issues...');
    
    // Fix notify_list column format issues
    try {
      await pool.query(`
        UPDATE templates 
        SET notify_list = '[]'::json 
        WHERE notify_list::text = '' OR notify_list IS NULL;
      `);
      console.log('✓ Fixed notify_list format');
    } catch (error) {
      console.log('Note: notify_list column may need manual fixing');
    }

    // Set default studio_ids for templates that don't have them
    await pool.query(`
      UPDATE templates 
      SET studio_ids = '[]' 
      WHERE studio_ids IS NULL OR studio_ids = '';
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

    // Convert legacy templates to new format
    console.log('\nConverting legacy template data to new schema format...');
    
    for (const template of templatesResult.rows) {
      let needsUpdate = false;
      let updateFields = [];
      let updateValues = [];
      let valueIndex = 1;
      
      console.log(`Processing template: ${template.name} (ID: ${template.id})`);
      
      // Check if studio_ids needs parsing from legacy format
      if (template.studio_ids && typeof template.studio_ids === 'string') {
        try {
          // Try to parse as JSON, if it fails, treat as legacy single studio ID
          JSON.parse(template.studio_ids);
          console.log(`  ✓ Studio IDs already in correct format: ${template.studio_ids}`);
        } catch (e) {
          // Legacy format - convert single studio ID to array
          const legacyStudioId = parseInt(template.studio_ids);
          if (!isNaN(legacyStudioId)) {
            updateFields.push(`studio_ids = $${valueIndex++}`);
            updateValues.push(`[${legacyStudioId}]`);
            needsUpdate = true;
            console.log(`  → Converting legacy studio ID ${legacyStudioId} to array format`);
          }
        }
      } else if (!template.studio_ids || template.studio_ids === '') {
        // No studio IDs - set default
        updateFields.push(`studio_ids = $${valueIndex++}`);
        updateValues.push('[1]');
        needsUpdate = true;
        console.log(`  → Setting default studio ID [1]`);
      }
      
      // Check notify_list format
      if (!template.notify_list) {
        updateFields.push(`notify_list = $${valueIndex++}`);
        updateValues.push('[]');
        needsUpdate = true;
        console.log(`  → Setting default empty notify_list`);
      } else if (typeof template.notify_list === 'string' && template.notify_list !== '[]') {
        try {
          JSON.parse(template.notify_list);
          console.log(`  ✓ Notify list already in correct format`);
        } catch (e) {
          updateFields.push(`notify_list = $${valueIndex++}`);
          updateValues.push('[]');
          needsUpdate = true;
          console.log(`  → Fixing invalid notify_list format`);
        }
      }
      
      // Set defaults for missing fields
      if (!template.status) {
        updateFields.push(`status = $${valueIndex++}`);
        updateValues.push('confirmed');
        needsUpdate = true;
        console.log(`  → Setting default status: confirmed`);
      }
      
      if (!template.color) {
        updateFields.push(`color = $${valueIndex++}`);
        updateValues.push('#3b82f6');
        needsUpdate = true;
        console.log(`  → Setting default color: #3b82f6`);
      }
      
      // Apply updates if needed
      if (needsUpdate) {
        const updateQuery = `
          UPDATE templates 
          SET ${updateFields.join(', ')}
          WHERE id = $${valueIndex}
        `;
        updateValues.push(template.id);
        
        await pool.query(updateQuery, updateValues);
        console.log(`  ✓ Updated template ${template.name}`);
      } else {
        console.log(`  ✓ Template ${template.name} already in correct format`);
      }
    }

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
          '[]'::json
        );
      `);
      console.log('✓ Created default template');
    }

    // Show final results
    const finalTemplatesResult = await pool.query(`
      SELECT id, name, description, studio_ids, start_time, end_time, 
             pcr_room_id, status, color, notify_list
      FROM templates 
      ORDER BY id;
    `);

    console.log('\nFinal templates after migration:');
    finalTemplatesResult.rows.forEach(template => {
      console.log(`- ID: ${template.id}, Name: "${template.name}"`);
      console.log(`  Studios: ${template.studio_ids}, Status: ${template.status}, Color: ${template.color}`);
      if (template.start_time) console.log(`  Times: ${template.start_time} - ${template.end_time}`);
    });

    console.log('\nProduction template restoration completed successfully!');

  } catch (error) {
    console.error('Error restoring legacy templates in production:', error);
    // Don't exit with error code in production to avoid breaking deployment
    console.log('Continuing with deployment despite template restoration issues...');
  } finally {
    await pool.end();
  }
}

restoreLegacyTemplates();