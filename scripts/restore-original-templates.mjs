/**
 * Restore original templates from backup data
 * This restores the templates that were lost during schema migration
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function query(text, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function restoreOriginalTemplates() {
  try {
    console.log('🔄 Restoring original templates from backup...');
    
    // First, clear existing templates that were incorrectly migrated
    await query('DELETE FROM templates');
    console.log('✅ Cleared existing templates');
    
    // Original template data from backup
    const originalTemplates = [
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
        equipment: [{"color": "#3259f5", "status": "confirmed", "pcrRoomId": 65, "studioIds": [3, 4]}],
        created_by: 1
      },
      {
        id: 3,
        name: 'DP',
        description: null,
        type: 'production',
        duration: 300,
        crew_required: [],
        equipment: [{"color": "#8000ff", "status": "confirmed", "pcrRoomId": 64, "studioIds": [7]}],
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
        id: 6,
        name: 'Stakelbeck Tonight',
        description: null,
        type: 'production',
        duration: 270,
        crew_required: [9, 7],
        equipment: [{"color": "#4B83E2", "status": "confirmed", "pcrRoomId": 65, "studioIds": [3, 4]}],
        created_by: 9
      },
      {
        id: 8,
        name: 'Praise (Plex)',
        description: null,
        type: 'production',
        duration: 120,
        crew_required: [9, 7],
        equipment: [{"color": "#ff40ff", "status": "confirmed", "pcrRoomId": 65, "studioIds": [3, 4]}],
        created_by: 9
      },
      {
        id: 10,
        name: 'Praise (Irving)',
        description: null,
        type: 'production',
        duration: 180,
        crew_required: [9],
        equipment: [{"color": "#ff40ff", "status": "confirmed", "pcrRoomId": null, "studioIds": [14]}],
        created_by: 9
      },
      {
        id: 12,
        name: 'Centerpoint News Updates',
        description: null,
        type: 'production',
        duration: 30,
        crew_required: [9],
        equipment: [{"color": "#ffaa00", "status": "confirmed", "pcrRoomId": null, "studioIds": [9]}],
        created_by: 9
      },
      {
        id: 13,
        name: 'Better Together',
        description: null,
        type: 'production',
        duration: 60,
        crew_required: [9, 7],
        equipment: [{"color": "#942192", "status": "confirmed", "pcrRoomId": null, "studioIds": [14, 6, 16, 7, 8, 17]}],
        created_by: 9
      },
      {
        id: 14,
        name: 'Remote Shoot',
        description: null,
        type: 'production',
        duration: 60,
        crew_required: [],
        equipment: [{"color": "#008cb4", "status": "confirmed", "pcrRoomId": null, "studioIds": [13]}],
        created_by: 9
      },
      {
        id: 15,
        name: 'SFC',
        description: 'Director: Ryan Tyler',
        type: 'production',
        duration: 420,
        crew_required: [],
        equipment: [{"color": "#ff2600", "status": "confirmed", "pcrRoomId": 64, "studioIds": [3, 4]}],
        created_by: 9
      },
      {
        id: 16,
        name: 'MSM News',
        description: null,
        type: 'production',
        duration: 750,
        crew_required: [7, 8],
        equipment: [{"color": "#800000", "status": "confirmed", "pcrRoomId": 1, "studioIds": [1, 2]}],
        created_by: 9
      },
      {
        id: 17,
        name: 'Through The Drama',
        description: null,
        type: 'production',
        duration: 180,
        crew_required: [],
        equipment: [{"color": "#008080", "status": "confirmed", "pcrRoomId": 64, "studioIds": [13]}],
        created_by: 9
      },
      {
        id: 18,
        name: 'Misc Production',
        description: 'Irving Hit Studio - Living Legacy donor will give her testimony in hit studio immediately following Praise.',
        type: 'production',
        duration: 30,
        crew_required: [],
        equipment: [{"color": "#4f7a28", "status": "confirmed", "pcrRoomId": null, "studioIds": [14]}],
        created_by: 9
      }
    ];
    
    console.log(`📋 Restoring ${originalTemplates.length} templates with proper configurations...`);
    
    // Insert each template with correct new schema structure
    for (const template of originalTemplates) {
      const equipment = template.equipment[0]; // Get first equipment configuration
      const studioIds = equipment.studioIds || [];
      const pcrRoomId = equipment.pcrRoomId;
      const color = equipment.color;
      const status = equipment.status;
      const notifyList = template.crew_required || [];
      
      await query(`
        INSERT INTO templates (
          id, name, description, type, duration, created_by,
          studio_ids, pcr_room_id, color, status, notify_list
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        template.id,
        template.name,
        template.description,
        template.type,
        template.duration,
        template.created_by,
        JSON.stringify(studioIds),
        pcrRoomId,
        color,
        status,
        JSON.stringify(notifyList)
      ]);
      
      console.log(`  ✅ Restored "${template.name}"`);
      console.log(`     Studios: [${studioIds.join(', ')}], PCR: ${pcrRoomId || 'None'}, Color: ${color}`);
    }
    
    // Reset the sequence to continue from the highest ID
    await query(`SELECT setval('templates_id_seq', (SELECT COALESCE(MAX(id), 1) FROM templates))`);
    
    console.log('\n🎉 All templates restored successfully!');
    
    // Verify restoration
    const restored = await query(`
      SELECT id, name, studio_ids, pcr_room_id, color, status
      FROM templates 
      ORDER BY id
    `);
    
    console.log(`\n📋 Verification: Found ${restored.rows.length} restored templates:`);
    restored.rows.forEach(template => {
      const studios = JSON.parse(template.studio_ids || '[]');
      console.log(`  ${template.id}. ${template.name}`);
      console.log(`     Studios: [${studios.join(', ')}], PCR: ${template.pcr_room_id || 'None'}`);
      console.log(`     Color: ${template.color}, Status: ${template.status}`);
    });
    
  } catch (error) {
    console.error('❌ Restoration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the restoration
restoreOriginalTemplates()
  .then(() => {
    console.log('\n🎉 Template restoration completed successfully!');
    console.log('Your original templates with proper studio assignments, colors, and PCR rooms have been restored.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Restoration failed:', error);
    process.exit(1);
  });