/**
 * Fixed Production Template Migration Script
 * 
 * This script properly migrates templates from old structure to new schema format
 * with correct studio ID assignments.
 */

const { Pool } = require('pg');

async function migrateProductionTemplates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('🔧 Starting production template migration...');
    
    // Get current templates
    const templatesResult = await pool.query('SELECT * FROM templates ORDER BY id');
    const templates = templatesResult.rows;
    
    console.log(`Found ${templates.length} templates to analyze\n`);
    
    const templatesNeedingMigration = [];
    
    for (const template of templates) {
      console.log(`Analyzing template ${template.id}: "${template.name}"`);
      let needsMigration = false;
      
      const migrationPlan = {
        id: template.id,
        studio_ids: null,
        pcr_room_id: template.pcr_room_id,
        color: template.color,
        status: template.status,
        notify_list: template.notify_list
      };
      
      // Check if template has equipment field (old format)
      if (template.equipment) {
        try {
          const equipment = Array.isArray(template.equipment) ? template.equipment : JSON.parse(template.equipment);
          console.log(`  Found equipment field:`, equipment);
          
          if (equipment.length > 0) {
            const firstEquipment = equipment[0];
            if (firstEquipment.studioIds && firstEquipment.studioIds.length > 0) {
              migrationPlan.studio_ids = JSON.stringify(firstEquipment.studioIds);
              console.log(`  Extracted studio IDs: ${JSON.stringify(firstEquipment.studioIds)}`);
            }
            migrationPlan.pcr_room_id = firstEquipment.pcrRoomId || template.pcr_room_id;
            migrationPlan.color = firstEquipment.color || template.color || '#3B82F6';
            migrationPlan.status = firstEquipment.status || template.status || 'confirmed';
            needsMigration = true;
          }
        } catch (error) {
          console.log(`  Error parsing equipment field:`, error.message);
        }
      }
      
      // Check if template has crew_required field
      if (template.crew_required) {
        console.log(`  Found crew_required field:`, template.crew_required);
        migrationPlan.notify_list = JSON.stringify(template.crew_required);
        needsMigration = true;
      }
      
      // Set defaults if values are missing
      migrationPlan.pcr_room_id = migrationPlan.pcr_room_id || null;
      migrationPlan.color = migrationPlan.color || '#3B82F6';
      migrationPlan.status = migrationPlan.status || 'confirmed';
      migrationPlan.notify_list = migrationPlan.notify_list || '[]';
      
      // Only set empty array if no studio_ids were found at all
      if (!migrationPlan.studio_ids) {
        migrationPlan.studio_ids = '[]';
      }
      
      // Ensure notify_list is properly formatted
      if (migrationPlan.notify_list && typeof migrationPlan.notify_list !== 'string') {
        migrationPlan.notify_list = JSON.stringify(migrationPlan.notify_list);
      }
      
      if (needsMigration) {
        templatesNeedingMigration.push(migrationPlan);
        console.log(`  ✓ Template needs migration`);
      } else {
        console.log(`  ⚠ Template already in correct format`);
      }
      console.log('');
    }
    
    if (templatesNeedingMigration.length === 0) {
      console.log('🎉 All templates are already in the correct format!');
      return;
    }
    
    console.log(`🔄 Migrating ${templatesNeedingMigration.length} templates...`);
    
    // Apply migrations
    for (const plan of templatesNeedingMigration) {
      const updateQuery = `
        UPDATE templates 
        SET 
          studio_ids = $1::json,
          pcr_room_id = $2,
          color = $3,
          status = $4,
          notify_list = $5::json
        WHERE id = $6
      `;
      
      await pool.query(updateQuery, [
        plan.studio_ids,
        plan.pcr_room_id,
        plan.color,
        plan.status,
        plan.notify_list,
        plan.id
      ]);
      
      const studioIds = JSON.parse(plan.studio_ids);
      console.log(`  ✅ Migrated template ${plan.id}`);
      console.log(`     Studios: ${JSON.stringify(studioIds)}, PCR: ${plan.pcr_room_id}, Color: ${plan.color}`);
    }
    
    // Clean up old columns if they exist
    try {
      await pool.query('ALTER TABLE templates DROP COLUMN IF EXISTS equipment');
      console.log('  🧹 Removed old column: equipment');
    } catch (error) {
      console.log('  ⚠ Equipment column already removed or doesn\'t exist');
    }
    
    try {
      await pool.query('ALTER TABLE templates DROP COLUMN IF EXISTS crew_required');
      console.log('  🧹 Removed old column: crew_required');
    } catch (error) {
      console.log('  ⚠ Crew_required column already removed or doesn\'t exist');
    }
    
    console.log('\n🎉 Template migration completed!\n');
    
    // Show final state
    const finalTemplates = await pool.query(`
      SELECT id, name, studio_ids, pcr_room_id, color, duration 
      FROM templates 
      ORDER BY id
    `);
    
    console.log('Final templates in database:');
    for (const template of finalTemplates.rows) {
      const studioIds = JSON.parse(template.studio_ids || '[]');
      console.log(`  ${template.id}. ${template.name}:`);
      console.log(`     Studios: ${JSON.stringify(studioIds)}, PCR: ${template.pcr_room_id}`);
      console.log(`     Color: ${template.color}, Duration: ${template.duration}min`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateProductionTemplates()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });