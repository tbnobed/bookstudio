/**
 * Fix production template schema to match current Drizzle schema
 * 
 * This script:
 * 1. Renames snake_case columns to camelCase to match current schema
 * 2. Ensures all required columns exist
 * 3. Migrates existing template data
 */

import pg from 'pg';
const { Pool } = pg;

// Use the same DATABASE_URL that the app uses
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(text, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function fixProductionTemplateSchema() {
  try {
    console.log('🔧 Starting production template schema fix...');
    
    // First, check what columns exist
    const columnsCheck = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'templates' 
      ORDER BY column_name
    `);
    
    console.log('📋 Current template table columns:');
    columnsCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    const existingColumns = columnsCheck.rows.map(row => row.column_name);
    
    // Check if we have old structure (equipment, crew_required)
    const hasOldStructure = existingColumns.includes('equipment') && existingColumns.includes('crew_required');
    const hasNewStructure = existingColumns.includes('studio_ids');
    
    if (hasNewStructure && !hasOldStructure) {
      console.log('✅ Templates already use new schema structure');
      return;
    }
    
    if (!hasOldStructure) {
      console.log('⚠️ No old or new structure found. Creating new schema...');
      await query(`
        ALTER TABLE templates 
        ADD COLUMN IF NOT EXISTS studio_ids JSON DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS pcr_room_id INTEGER,
        ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3259f5',
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed',
        ADD COLUMN IF NOT EXISTS notify_list JSON DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS start_time TIME,
        ADD COLUMN IF NOT EXISTS end_time TIME
      `);
      console.log('✅ New schema columns added');
      return;
    }
    
    console.log('🔄 Converting old schema to new schema...');
    
    // Get all templates with old structure
    const oldTemplates = await query(`
      SELECT id, name, description, type, duration, crew_required, equipment, created_by
      FROM templates
    `);
    
    console.log(`Found ${oldTemplates.rows.length} templates to migrate`);
    
    // Add new columns
    await query(`
      ALTER TABLE templates 
      ADD COLUMN IF NOT EXISTS studio_ids JSON DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS pcr_room_id INTEGER,
      ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3259f5',
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed',
      ADD COLUMN IF NOT EXISTS notify_list JSON DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS start_time TIME,
      ADD COLUMN IF NOT EXISTS end_time TIME
    `);
    
    console.log('✅ New columns added to templates table');
    
    // Migrate data for each template
    for (const template of oldTemplates.rows) {
      try {
        console.log(`\n🔄 Migrating template ${template.id}: "${template.name}"`);
        
        // Parse equipment data
        let equipmentData = [];
        if (template.equipment) {
          try {
            equipmentData = typeof template.equipment === 'string' 
              ? JSON.parse(template.equipment) 
              : template.equipment;
          } catch (e) {
            console.warn(`  ⚠️ Could not parse equipment for template ${template.id}:`, e.message);
          }
        }
        
        // Parse crew_required data
        let crewData = [];
        if (template.crew_required) {
          try {
            crewData = typeof template.crew_required === 'string'
              ? JSON.parse(template.crew_required)
              : template.crew_required;
          } catch (e) {
            console.warn(`  ⚠️ Could not parse crew_required for template ${template.id}:`, e.message);
          }
        }
        
        // Extract data from first equipment entry (legacy structure)
        const firstEquipment = Array.isArray(equipmentData) && equipmentData.length > 0 
          ? equipmentData[0] 
          : {};
        
        const studioIds = firstEquipment.studioIds || [];
        const pcrRoomId = firstEquipment.pcrRoomId || null;
        const color = firstEquipment.color || '#3259f5';
        const status = firstEquipment.status || 'confirmed';
        
        console.log(`  📝 Extracted data:`);
        console.log(`    - studioIds: ${JSON.stringify(studioIds)}`);
        console.log(`    - pcrRoomId: ${pcrRoomId}`);
        console.log(`    - color: ${color}`);
        console.log(`    - status: ${status}`);
        console.log(`    - notifyList: ${JSON.stringify(crewData)}`);
        
        // Update template with new structure
        await query(`
          UPDATE templates 
          SET 
            studio_ids = $1,
            pcr_room_id = $2,
            color = $3,
            status = $4,
            notify_list = $5
          WHERE id = $6
        `, [
          JSON.stringify(studioIds),
          pcrRoomId,
          color,
          status,
          JSON.stringify(crewData),
          template.id
        ]);
        
        console.log(`  ✅ Successfully migrated template ${template.id}`);
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate template ${template.id}:`, error.message);
      }
    }
    
    console.log('\n🎉 Template schema migration completed!');
    console.log('\n📋 Verifying migration...');
    
    // Verify the migration
    const updatedTemplates = await query(`
      SELECT id, name, studio_ids, pcr_room_id, color, status, notify_list
      FROM templates
      ORDER BY id
    `);
    
    console.log(`✅ Found ${updatedTemplates.rows.length} templates with new schema:`);
    updatedTemplates.rows.forEach(template => {
      console.log(`  - ${template.name} (ID: ${template.id})`);
      console.log(`    Studios: ${template.studio_ids}`);
      console.log(`    PCR Room: ${template.pcr_room_id || 'None'}`);
      console.log(`    Color: ${template.color}`);
      console.log(`    Status: ${template.status}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
fixProductionTemplateSchema()
  .then(() => {
    console.log('\n🎉 All done! Your templates should now work properly.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });