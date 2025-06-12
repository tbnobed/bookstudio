#!/usr/bin/env node

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bookstudio',
  ssl: false
});

async function populateTemplates() {
  console.log('🔧 Populating templates with studio assignments and settings...\n');

  try {
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection established\n');

    // Get available studios
    const studios = await pool.query('SELECT id, name FROM studios ORDER BY id;');
    console.log('Available studios:');
    studios.rows.forEach(studio => {
      console.log(`  - ID: ${studio.id}, Name: "${studio.name}"`);
    });

    // Get available PCR rooms
    const pcrRooms = await pool.query('SELECT id, name FROM pcr_rooms ORDER BY id;');
    console.log('\nAvailable PCR rooms:');
    pcrRooms.rows.forEach(pcr => {
      console.log(`  - ID: ${pcr.id}, Name: "${pcr.name}"`);
    });

    // Template configurations based on typical usage
    const templateConfigs = {
      'Test Template': {
        studio_ids: '[1]',
        pcr_room_id: 1,
        start_time: '09:00',
        end_time: '10:00',
        color: '#3b82f6',
        description: 'General test template for studio bookings'
      },
      'Praise': {
        studio_ids: '[1,2]',
        pcr_room_id: 1,
        start_time: '08:00',
        end_time: '10:00',
        color: '#22c55e',
        description: 'Praise worship service production'
      },
      'DP': {
        studio_ids: '[1]',
        pcr_room_id: 1,
        start_time: '14:00',
        end_time: '19:00',
        color: '#f59e0b',
        description: 'Daily program production'
      },
      'MSM News': {
        studio_ids: '[2,3]',
        pcr_room_id: 1,
        start_time: '06:00',
        end_time: '19:00',
        color: '#ef4444',
        description: 'MSM News broadcast production'
      },
      'Stakelbeck Tonight': {
        studio_ids: '[2]',
        pcr_room_id: 1,
        start_time: '18:00',
        end_time: '22:30',
        color: '#8b5cf6',
        description: 'Stakelbeck Tonight show production'
      },
      'Remote Production 1': {
        studio_ids: '[9]',
        pcr_room_id: null,
        start_time: '10:00',
        end_time: '17:00',
        color: '#06b6d4',
        description: 'Remote production setup'
      },
      'Pope watch': {
        studio_ids: '[1,2]',
        pcr_room_id: 1,
        start_time: '12:00',
        end_time: '22:00',
        color: '#ec4899',
        description: 'Pope watch special coverage'
      }
    };

    // Update each template
    const templates = await pool.query('SELECT id, name FROM templates ORDER BY id;');
    
    console.log('\n🔄 Updating templates with studio assignments...\n');

    for (const template of templates.rows) {
      const config = templateConfigs[template.name];
      
      if (config) {
        console.log(`Updating: ${template.name} (ID: ${template.id})`);
        
        await pool.query(`
          UPDATE templates 
          SET 
            studio_ids = $1,
            pcr_room_id = $2,
            start_time = $3,
            end_time = $4,
            color = $5,
            description = $6
          WHERE id = $7
        `, [
          config.studio_ids,
          config.pcr_room_id,
          config.start_time,
          config.end_time,
          config.color,
          config.description,
          template.id
        ]);
        
        console.log(`  ✓ Studios: ${config.studio_ids}`);
        console.log(`  ✓ PCR Room: ${config.pcr_room_id || 'None'}`);
        console.log(`  ✓ Times: ${config.start_time} - ${config.end_time}`);
        console.log(`  ✓ Color: ${config.color}`);
      } else {
        // Default configuration for unknown templates
        console.log(`Setting defaults for: ${template.name} (ID: ${template.id})`);
        
        await pool.query(`
          UPDATE templates 
          SET 
            studio_ids = '[1]',
            pcr_room_id = 1,
            start_time = '09:00',
            end_time = '10:00',
            color = '#6b7280'
          WHERE id = $1
        `, [template.id]);
        
        console.log(`  ✓ Default: Studio [1], PCR 1, 09:00-10:00, Gray color`);
      }
      console.log('');
    }

    // Show final results
    console.log('📊 Final template configuration:');
    const finalTemplates = await pool.query(`
      SELECT id, name, studio_ids, pcr_room_id, start_time, end_time, color, description
      FROM templates 
      ORDER BY id;
    `);

    finalTemplates.rows.forEach(template => {
      console.log(`\n- ${template.name} (ID: ${template.id})`);
      console.log(`  Studios: ${template.studio_ids}`);
      console.log(`  PCR Room: ${template.pcr_room_id || 'None'}`);
      console.log(`  Times: ${template.start_time} - ${template.end_time}`);
      console.log(`  Color: ${template.color}`);
      if (template.description) {
        console.log(`  Description: ${template.description}`);
      }
    });

    console.log('\n🎉 Template population completed successfully!');
    console.log('\nYour templates now have studio assignments and will populate form fields correctly.');

  } catch (error) {
    console.error('❌ Error populating templates:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

populateTemplates();