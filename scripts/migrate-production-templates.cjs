/**
 * Production Template Migration Script
 * 
 * This script analyzes your current templates and migrates them from any old structure
 * to the new template schema format, regardless of their current state.
 */

const { Pool } = require('pg');

async function migrateProductionTemplates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('🔧 Starting production template migration...');
    
    // First, get the current table structure to understand what we're working with
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'templates' 
      ORDER BY ordinal_position
    `);
    
    console.log('Current templates table structure:');
    tableStructure.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Get all current templates
    const currentTemplates = await pool.query('SELECT * FROM templates ORDER BY id');
    console.log(`\nFound ${currentTemplates.rows.length} templates to analyze`);
    
    if (currentTemplates.rows.length === 0) {
      console.log('No templates found to migrate.');
      return;
    }
    
    // Analyze each template to determine migration needs
    const templatesNeedingMigration = [];
    
    for (const template of currentTemplates.rows) {
      console.log(`\nAnalyzing template ${template.id}: "${template.name}"`);
      
      let needsMigration = false;
      let migrationPlan = {
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type || 'production',
        duration: template.duration || 60,
        created_by: template.created_by || 1,
        studio_ids: null,
        pcr_room_id: null,
        color: null,
        status: null,
        notify_list: null,
        start_time: null,
        end_time: null
      };
      
      // Check if template has old equipment field structure
      if (template.equipment) {
        console.log(`  Found equipment field:`, template.equipment);
        needsMigration = true;
        
        try {
          let equipment = template.equipment;
          if (typeof equipment === 'string') {
            equipment = JSON.parse(equipment);
          }
          
          if (Array.isArray(equipment) && equipment.length > 0) {
            const equipmentData = equipment[0];
            migrationPlan.studio_ids = JSON.stringify(equipmentData.studioIds || []);
            migrationPlan.pcr_room_id = equipmentData.pcrRoomId || null;
            migrationPlan.color = equipmentData.color || '#3B82F6';
            migrationPlan.status = equipmentData.status || 'confirmed';
          }
        } catch (error) {
          console.log(`  Error parsing equipment field:`, error.message);
        }
      }
      
      // Check if template has crew_required field
      if (template.crew_required) {
        console.log(`  Found crew_required field:`, template.crew_required);
        needsMigration = true;
        migrationPlan.notify_list = JSON.stringify(template.crew_required);
      }
      
      // Check if studio_ids field exists but is in wrong format
      if (template.studio_ids) {
        if (typeof template.studio_ids === 'string') {
          // Already in correct format
          migrationPlan.studio_ids = template.studio_ids;
        } else if (Array.isArray(template.studio_ids)) {
          // Convert array to JSON string
          migrationPlan.studio_ids = JSON.stringify(template.studio_ids);
          needsMigration = true;
        }
      }
      
      // Set other fields from existing data
      migrationPlan.pcr_room_id = migrationPlan.pcr_room_id || template.pcr_room_id || null;
      migrationPlan.color = migrationPlan.color || template.color || '#3B82F6';
      migrationPlan.status = migrationPlan.status || template.status || 'confirmed';
      migrationPlan.notify_list = migrationPlan.notify_list || template.notify_list || '[]';
      migrationPlan.start_time = template.start_time || null;
      migrationPlan.end_time = template.end_time || null;
      
      // Ensure notify_list is properly formatted
      if (migrationPlan.notify_list && typeof migrationPlan.notify_list !== 'string') {
        migrationPlan.notify_list = JSON.stringify(migrationPlan.notify_list);
      }
      
      // Ensure studio_ids is set (fallback to empty array only if truly nothing found)
      if (!migrationPlan.studio_ids) {
        migrationPlan.studio_ids = '[]';
      }
      
      if (needsMigration) {
        templatesNeedingMigration.push(migrationPlan);
        console.log(`  ✓ Template needs migration`);
      } else {
        console.log(`  ✓ Template already in correct format`);
      }
    }
    
    if (templatesNeedingMigration.length === 0) {
      console.log('\n✅ All templates are already in the correct format!');
      return;
    }
    
    console.log(`\n🔄 Migrating ${templatesNeedingMigration.length} templates...`);
    
    // Perform the migration
    for (const template of templatesNeedingMigration) {
      try {
        const updateQuery = `
          UPDATE templates SET
            name = $2,
            description = $3,
            type = $4,
            duration = $5,
            studio_ids = $6,
            pcr_room_id = $7,
            color = $8,
            status = $9,
            created_by = $10,
            notify_list = $11,
            start_time = $12,
            end_time = $13
          WHERE id = $1
        `;
        
        await pool.query(updateQuery, [
          template.id,
          template.name,
          template.description,
          template.type,
          template.duration,
          template.studio_ids,
          template.pcr_room_id,
          template.color,
          template.status,
          template.created_by,
          template.notify_list,
          template.start_time,
          template.end_time
        ]);
        
        console.log(`  ✅ Migrated template ${template.id}: "${template.name}"`);
        console.log(`     Studios: ${template.studio_ids}, PCR: ${template.pcr_room_id}, Color: ${template.color}`);
        
      } catch (error) {
        console.error(`  ❌ Error migrating template ${template.id}:`, error.message);
      }
    }
    
    // Clean up old columns if they exist
    const columnsToRemove = ['equipment', 'crew_required'];
    for (const column of columnsToRemove) {
      try {
        const checkColumn = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'templates' AND column_name = $1
        `, [column]);
        
        if (checkColumn.rows.length > 0) {
          await pool.query(`ALTER TABLE templates DROP COLUMN IF EXISTS ${column}`);
          console.log(`  🧹 Removed old column: ${column}`);
        }
      } catch (error) {
        console.log(`  ⚠️  Could not remove column ${column}:`, error.message);
      }
    }
    
    console.log('\n🎉 Template migration completed!');
    
    // Show final template status
    const finalTemplates = await pool.query(`
      SELECT id, name, studio_ids, pcr_room_id, color, status, duration 
      FROM templates 
      ORDER BY id
    `);
    
    console.log('\nFinal templates in database:');
    finalTemplates.rows.forEach(template => {
      console.log(`  ${template.id}. ${template.name}:`);
      console.log(`     Studios: ${template.studio_ids}, PCR: ${template.pcr_room_id}`);
      console.log(`     Color: ${template.color}, Duration: ${template.duration}min`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  migrateProductionTemplates().catch(console.error);
}

module.exports = { migrateProductionTemplates };