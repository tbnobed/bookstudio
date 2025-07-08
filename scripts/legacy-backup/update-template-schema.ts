/**
 * Migration script to update template schema with booking fields
 */
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateTemplateSchema() {
  const client = await pool.connect();
  
  try {
    console.log('Starting template schema update...');
    
    // Add new columns to templates table
    await client.query(`
      ALTER TABLE templates 
      ADD COLUMN IF NOT EXISTS studio_ids JSON DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS pcr_room_id INTEGER,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed',
      ADD COLUMN IF NOT EXISTS color TEXT,
      ADD COLUMN IF NOT EXISTS notify_list JSON DEFAULT '[]'
    `);
    
    console.log('✓ Added new template columns');
    
    // Migrate existing data from crew_required and equipment to studio_ids if needed
    const existingTemplates = await client.query(`
      SELECT id, crew_required, equipment 
      FROM templates 
      WHERE crew_required IS NOT NULL OR equipment IS NOT NULL
    `);
    
    for (const template of existingTemplates.rows) {
      try {
        let studioIds = [];
        let pcrRoomId = null;
        let status = 'confirmed';
        let color = null;
        
        // Try to extract studio data from equipment field if it exists
        if (template.equipment) {
          const equipment = Array.isArray(template.equipment) ? template.equipment : [template.equipment];
          for (const item of equipment) {
            if (item && typeof item === 'object') {
              if (item.studioIds && Array.isArray(item.studioIds)) {
                studioIds = item.studioIds;
              }
              if (item.pcrRoomId) {
                pcrRoomId = item.pcrRoomId;
              }
              if (item.status) {
                status = item.status;
              }
              if (item.color) {
                color = item.color;
              }
            }
          }
        }
        
        // Update the template with migrated data
        await client.query(`
          UPDATE templates 
          SET studio_ids = $1, pcr_room_id = $2, status = $3, color = $4
          WHERE id = $5
        `, [JSON.stringify(studioIds), pcrRoomId, status, color, template.id]);
        
        console.log(`✓ Migrated data for template ${template.id}`);
      } catch (error) {
        console.log(`⚠ Could not migrate template ${template.id}:`, error.message);
      }
    }
    
    // Remove old columns that are no longer needed
    await client.query(`
      ALTER TABLE templates 
      DROP COLUMN IF EXISTS crew_required,
      DROP COLUMN IF EXISTS equipment
    `);
    
    console.log('✓ Removed old template columns');
    console.log('Template schema update completed successfully!');
    
  } catch (error) {
    console.error('Error updating template schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

updateTemplateSchema().catch(console.error);