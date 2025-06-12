#!/usr/bin/env node

/**
 * Production Template Migration Script
 * 
 * This script fixes legacy templates in production environments that were
 * created before the database schema update. It converts old template formats
 * to the new schema structure expected by the template application logic.
 * 
 * Usage:
 *   node scripts/fix-production-templates.js
 * 
 * Or in Docker:
 *   docker-compose exec app node scripts/fix-production-templates.js
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bookstudio',
  ssl: false // Disable SSL for local/development databases
});

async function fixProductionTemplates() {
  console.log('🔧 Starting production template migration...\n');

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection established');

    // Get all existing templates
    const templatesResult = await pool.query(`
      SELECT id, name, description, studio_ids, start_time, end_time, 
             pcr_room_id, status, color, notify_list, type, duration
      FROM templates 
      ORDER BY id;
    `);

    console.log(`\nFound ${templatesResult.rows.length} templates to process:`);
    templatesResult.rows.forEach(template => {
      console.log(`- ID: ${template.id}, Name: "${template.name}"`);
      console.log(`  Current studios: ${template.studio_ids}, Status: ${template.status || 'NULL'}, Color: ${template.color || 'NULL'}`);
    });

    if (templatesResult.rows.length === 0) {
      console.log('\nNo templates found. Creating a default template...');
      await pool.query(`
        INSERT INTO templates (name, description, studio_ids, status, color, notify_list, type, duration)
        VALUES (
          'Default Template',
          'A basic template for general bookings',
          '[1]',
          'confirmed',
          '#3b82f6',
          '[]'::json,
          'production',
          120
        );
      `);
      console.log('✓ Created default template');
      return;
    }

    // Process each template
    console.log('\n🔄 Converting legacy template data...');
    
    for (const template of templatesResult.rows) {
      let needsUpdate = false;
      let updateFields = [];
      let updateValues = [];
      let valueIndex = 1;
      
      console.log(`\nProcessing: ${template.name} (ID: ${template.id})`);
      
      // Fix studio_ids format
      if (template.studio_ids) {
        if (typeof template.studio_ids === 'string') {
          try {
            // Test if it's already valid JSON
            const parsed = JSON.parse(template.studio_ids);
            if (Array.isArray(parsed)) {
              console.log(`  ✓ Studio IDs already in correct JSON array format`);
            } else {
              throw new Error('Not an array');
            }
          } catch (e) {
            // Legacy format - try to convert
            const legacyStudioId = parseInt(template.studio_ids);
            if (!isNaN(legacyStudioId)) {
              updateFields.push(`studio_ids = $${valueIndex++}`);
              updateValues.push(`[${legacyStudioId}]`);
              needsUpdate = true;
              console.log(`  → Converting legacy studio ID "${template.studio_ids}" to JSON array [${legacyStudioId}]`);
            } else {
              // Set default if can't parse
              updateFields.push(`studio_ids = $${valueIndex++}`);
              updateValues.push('[1]');
              needsUpdate = true;
              console.log(`  → Setting default studio ID [1] (couldn't parse: "${template.studio_ids}")`);
            }
          }
        } else if (Array.isArray(template.studio_ids)) {
          // Already an array, convert to JSON string
          updateFields.push(`studio_ids = $${valueIndex++}`);
          updateValues.push(JSON.stringify(template.studio_ids));
          needsUpdate = true;
          console.log(`  → Converting array to JSON string: ${JSON.stringify(template.studio_ids)}`);
        }
      } else {
        // No studio_ids - set default
        updateFields.push(`studio_ids = $${valueIndex++}`);
        updateValues.push('[1]');
        needsUpdate = true;
        console.log(`  → Setting default studio ID [1] (was NULL)`);
      }
      
      // Fix notify_list format
      if (!template.notify_list) {
        updateFields.push(`notify_list = $${valueIndex++}`);
        updateValues.push('[]');
        needsUpdate = true;
        console.log(`  → Setting default empty notify_list []`);
      } else if (typeof template.notify_list === 'string' && template.notify_list !== '[]') {
        try {
          JSON.parse(template.notify_list);
          console.log(`  ✓ Notify list already in correct JSON format`);
        } catch (e) {
          updateFields.push(`notify_list = $${valueIndex++}`);
          updateValues.push('[]');
          needsUpdate = true;
          console.log(`  → Fixing invalid notify_list format to []`);
        }
      } else if (Array.isArray(template.notify_list)) {
        updateFields.push(`notify_list = $${valueIndex++}`);
        updateValues.push(JSON.stringify(template.notify_list));
        needsUpdate = true;
        console.log(`  → Converting notify_list array to JSON string`);
      }
      
      // Set missing required fields
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
      
      if (!template.type) {
        updateFields.push(`type = $${valueIndex++}`);
        updateValues.push('production');
        needsUpdate = true;
        console.log(`  → Setting default type: production`);
      }
      
      if (!template.duration) {
        updateFields.push(`duration = $${valueIndex++}`);
        updateValues.push(120);
        needsUpdate = true;
        console.log(`  → Setting default duration: 120 minutes`);
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
        console.log(`  ✅ Updated template "${template.name}"`);
      } else {
        console.log(`  ✅ Template "${template.name}" already in correct format`);
      }
    }

    // Show final results
    console.log('\n📊 Final template status after migration:');
    const finalTemplatesResult = await pool.query(`
      SELECT id, name, description, studio_ids, start_time, end_time, 
             pcr_room_id, status, color, notify_list, type, duration
      FROM templates 
      ORDER BY id;
    `);

    finalTemplatesResult.rows.forEach(template => {
      console.log(`\n- Template ID: ${template.id} - "${template.name}"`);
      console.log(`  Studios: ${template.studio_ids}`);
      console.log(`  Status: ${template.status}, Color: ${template.color}, Type: ${template.type}`);
      console.log(`  Duration: ${template.duration} min, PCR Room: ${template.pcr_room_id || 'None'}`);
      if (template.start_time && template.end_time) {
        console.log(`  Times: ${template.start_time} - ${template.end_time}`);
      }
    });

    console.log('\n🎉 Production template migration completed successfully!');
    console.log('\nTemplates should now work correctly with the booking form.');

  } catch (error) {
    console.error('\n❌ Error during template migration:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  fixProductionTemplates().catch(console.error);
}

module.exports = { fixProductionTemplates };