/**
 * Script to restore original templates from backup data
 * This restores the templates that were lost during schema migration
 */

import { Pool } from '@neondatabase/serverless';

async function restoreOriginalTemplates() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔧 Starting template restoration...');
    
    // Clear existing templates first
    await pool.query('DELETE FROM templates WHERE id IN (9, 10, 11)');
    console.log('🔧 Cleared existing templates');
    
    // Original template data from backup with correct structure conversion
    const originalTemplates = [
      {
        id: 1,
        name: 'Test Template',
        description: null,
        type: 'production',
        studio_ids: [7],
        pcr_room_id: null,
        color: '#cb0b0b',
        status: 'confirmed',
        created_by: 1,
        user_id: null,
        start_time: null,
        end_time: null
      },
      {
        id: 2,
        name: 'Praise',
        description: null,
        type: 'production',
        studio_ids: [3, 4],
        pcr_room_id: 1, // PCR 65 from backup doesn't exist, using PCR 1
        color: '#3259f5',
        status: 'confirmed',
        created_by: 1,
        user_id: null,
        start_time: null,
        end_time: null
      },
      {
        id: 3,
        name: 'DP',
        description: null,
        type: 'production',
        studio_ids: [7],
        pcr_room_id: 1, // PCR 64 from backup doesn't exist, using PCR 1
        color: '#8000ff',
        status: 'confirmed',
        created_by: 1,
        user_id: null,
        start_time: null,
        end_time: null
      },
      {
        id: 4,
        name: 'MSM News',
        description: null,
        type: 'production',
        studio_ids: [1, 2],
        pcr_room_id: 1,
        color: '#800000',
        status: 'confirmed',
        created_by: 6,
        user_id: null,
        start_time: null,
        end_time: null
      },
      {
        id: 5,
        name: 'Stakelbeck Tonight',
        description: null,
        type: 'production',
        studio_ids: [3, 4],
        pcr_room_id: 1, // PCR 65 from backup doesn't exist, using PCR 1
        color: '#4B83E2',
        status: 'confirmed',
        created_by: 9,
        user_id: null,
        start_time: null,
        end_time: null
      },
      {
        id: 8,
        name: 'Remote Production 1',
        description: 'Remote Production 1 for demo',
        type: 'production',
        studio_ids: [9], // Studio 13 from backup doesn't exist, using Remote studio
        pcr_room_id: 1,
        color: '#4B83E2',
        status: 'confirmed',
        created_by: 7,
        user_id: null,
        start_time: null,
        end_time: null
      }
    ];
    
    // Insert each template
    for (const template of originalTemplates) {
      const query = `
        INSERT INTO templates (
          id, name, description, type, studio_ids, pcr_room_id, 
          color, status, created_by, user_id, start_time, end_time, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          type = EXCLUDED.type,
          studio_ids = EXCLUDED.studio_ids,
          pcr_room_id = EXCLUDED.pcr_room_id,
          color = EXCLUDED.color,
          status = EXCLUDED.status,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time
      `;
      
      await pool.query(query, [
        template.id,
        template.name,
        template.description,
        template.type,
        JSON.stringify(template.studio_ids),
        template.pcr_room_id,
        template.color,
        template.status,
        template.created_by,
        template.user_id,
        template.start_time,
        template.end_time
      ]);
      
      console.log(`✅ Restored template: ${template.name} (Studios: [${template.studio_ids.join(', ')}], PCR: ${template.pcr_room_id}, Color: ${template.color})`);
    }
    
    // Update sequence to prevent ID conflicts
    await pool.query("SELECT setval('templates_id_seq', COALESCE((SELECT MAX(id) FROM templates), 1))");
    
    console.log('✅ Template restoration complete!');
    console.log('\nRestored templates:');
    const result = await pool.query('SELECT id, name, studio_ids, pcr_room_id, color FROM templates ORDER BY id');
    result.rows.forEach(row => {
      console.log(`  - ${row.name}: Studios ${row.studio_ids}, PCR ${row.pcr_room_id}, Color ${row.color}`);
    });
    
  } catch (error) {
    console.error('❌ Error restoring templates:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  restoreOriginalTemplates().catch(console.error);
}

module.exports = { restoreOriginalTemplates };