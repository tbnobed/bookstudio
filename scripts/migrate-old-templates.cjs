/**
 * Migration script to properly convert old template structure to new structure
 * 
 * Old structure (from backup):
 * - equipment: JSON array containing {studioIds, pcrRoomId, color, status}
 * - duration: number (minutes)
 * - crew_required: JSON array
 * 
 * New structure:
 * - studio_ids: JSON array of studio IDs
 * - pcr_room_id: integer
 * - color: string
 * - status: string
 * - start_time: time (optional)
 * - end_time: time (optional)
 */

const { Pool } = require('pg');
require('dotenv').config();

async function migrateOldTemplates() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('🔧 Starting template migration from old structure...');
    
    // Get current templates to see if any need migration
    const currentTemplates = await pool.query('SELECT * FROM templates ORDER BY id');
    console.log(`Found ${currentTemplates.rows.length} templates to analyze`);
    
    // Backup templates data from your original backup
    const originalTemplateData = [
      {
        id: 1,
        name: 'Test Template',
        description: null,
        type: 'production',
        duration: 60,
        crew_required: [7, 9],
        equipment: [{"color": "#cb0b0b", "status": "confirmed", "pcrRoomId": null, "studioIds": [7]}],
        created_by: 1
      },
      {
        id: 2,
        name: 'Praise',
        description: null,
        type: 'production',
        duration: 60,
        crew_required: [9, 7],
        equipment: [{"color": "#3259f5", "status": "confirmed", "pcrRoomId": 1, "studioIds": [3, 4]}],
        created_by: 1
      },
      {
        id: 3,
        name: 'DP',
        description: null,
        type: 'production',
        duration: 300,
        crew_required: [],
        equipment: [{"color": "#8000ff", "status": "confirmed", "pcrRoomId": 1, "studioIds": [7]}],
        created_by: 1
      },
      {
        id: 4,
        name: 'MSM News',
        description: null,
        type: 'production',
        duration: 780,
        crew_required: [],
        equipment: [{"color": "#800000", "status": "confirmed", "pcrRoomId": 1, "studioIds": [1, 2]}],
        created_by: 6
      },
      {
        id: 5,
        name: 'Stakelbeck Tonight',
        description: null,
        type: 'production',
        duration: 270,
        crew_required: [],
        equipment: [{"color": "#4B83E2", "status": "confirmed", "pcrRoomId": 1, "studioIds": [3, 4]}],
        created_by: 9
      },
      {
        id: 6,
        name: 'Stakelbeck Tonight v2',
        description: null,
        type: 'production',
        duration: 270,
        crew_required: [9, 7],
        equipment: [{"color": "#4B83E2", "status": "confirmed", "pcrRoomId": 1, "studioIds": [3, 4]}],
        created_by: 9
      },
      {
        id: 7,
        name: 'Remote Production 1',
        description: 'Remote Production 1 for demo',
        type: 'production',
        duration: 420,
        crew_required: [8],
        equipment: [{"color": "#4B83E2", "status": "confirmed", "pcrRoomId": 1, "studioIds": [9]}],
        created_by: 7
      }
    ];
    
    console.log(`Processing ${originalTemplateData.length} original templates...`);
    
    // Clear existing templates to prevent duplicates
    await pool.query('DELETE FROM templates WHERE id IN (1,2,3,4,5,6,7)');
    console.log('Cleared existing template entries for migration...');
    
    // Process each original template
    for (const template of originalTemplateData) {
      try {
        // Extract data from equipment field (first item contains the template config)
        const equipment = template.equipment[0] || {};
        
        // Get PCR room ID
        let pcrRoomId = equipment.pcrRoomId;
        
        // Get studio IDs
        let studioIds = equipment.studioIds || [];
        
        // Insert template with proper structure
        const insertQuery = `
          INSERT INTO templates (
            id, name, description, type, duration, studio_ids, pcr_room_id,
            color, status, created_by, notify_list, start_time, end_time
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;
        
        await pool.query(insertQuery, [
          template.id,
          template.name,
          template.description,
          template.type,
          template.duration,
          JSON.stringify(studioIds),
          pcrRoomId,
          equipment.color || '#3B82F6',
          equipment.status || 'confirmed',
          template.created_by,
          JSON.stringify(template.crew_required || []),
          null, // start_time
          null  // end_time
        ]);
        
        console.log(`✅ Migrated template ${template.id}: ${template.name}`);
        console.log(`   Studios: [${studioIds.join(', ')}], PCR: ${pcrRoomId}, Color: ${equipment.color}`);
        
      } catch (error) {
        console.error(`❌ Error processing template ${template.id}:`, error);
      }
    }
    
    // Update sequence to prevent conflicts
    await pool.query("SELECT setval('templates_id_seq', COALESCE((SELECT MAX(id) FROM templates), 1))");
    
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
  migrateOldTemplates().catch(console.error);
}

module.exports = { migrateOldTemplates };