#!/usr/bin/env node

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bookstudio',
  ssl: false
});

async function debugTemplates() {
  console.log('🔍 Debugging template data structure...\n');

  try {
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection established\n');

    // Get raw template data to see actual structure
    const result = await pool.query(`
      SELECT id, name, description, studio_ids, start_time, end_time, 
             pcr_room_id, status, color, notify_list, type, duration,
             created_by
      FROM templates 
      ORDER BY id
      LIMIT 3;
    `);

    console.log('Raw template data from database:');
    result.rows.forEach(template => {
      console.log(`\nTemplate ID ${template.id} - "${template.name}":`);
      console.log(`  studio_ids: ${JSON.stringify(template.studio_ids)} (type: ${typeof template.studio_ids})`);
      console.log(`  start_time: ${template.start_time}`);
      console.log(`  end_time: ${template.end_time}`);
      console.log(`  pcr_room_id: ${template.pcr_room_id}`);
      console.log(`  status: ${template.status}`);
      console.log(`  color: ${template.color}`);
      console.log(`  notify_list: ${JSON.stringify(template.notify_list)} (type: ${typeof template.notify_list})`);
      console.log(`  type: ${template.type}`);
      console.log(`  duration: ${template.duration}`);
    });

    // Check if there are any studio assignments at all
    const studioCount = await pool.query('SELECT COUNT(*) FROM studios;');
    console.log(`\nTotal studios in database: ${studioCount.rows[0].count}`);

    const studioList = await pool.query('SELECT id, name FROM studios ORDER BY id;');
    console.log('\nAvailable studios:');
    studioList.rows.forEach(studio => {
      console.log(`  - ID: ${studio.id}, Name: "${studio.name}"`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugTemplates();