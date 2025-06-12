/**
 * Fix production template schema to match current Drizzle schema
 * 
 * This script:
 * 1. Renames snake_case columns to camelCase to match current schema
 * 2. Ensures all required columns exist
 * 3. Migrates existing template data
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function fixProductionTemplateSchema() {
  console.log('🔧 Fixing production template schema...');

  try {
    // Check current table structure
    console.log('\nChecking current templates table structure...');
    const tableInfo = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'templates' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('Current columns:');
    tableInfo.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    const columnNames = tableInfo.rows.map(row => row.column_name);

    // Step 1: Add new camelCase columns if they don't exist
    const requiredColumns = [
      { name: 'studioIds', type: 'json', default: "'[]'::json", snakeCase: 'studio_ids' },
      { name: 'pcrRoomId', type: 'integer', default: null, snakeCase: 'pcr_room_id' },
      { name: 'notifyList', type: 'json', default: "'[]'::json", snakeCase: 'notify_list' },
      { name: 'startTime', type: 'text', default: null, snakeCase: 'start_time' },
      { name: 'endTime', type: 'text', default: null, snakeCase: 'end_time' },
      { name: 'createdBy', type: 'integer', default: null, snakeCase: 'created_by' },
      { name: 'status', type: 'text', default: "'confirmed'::text", snakeCase: null },
      { name: 'color', type: 'text', default: null, snakeCase: null }
    ];

    console.log('\n🔄 Adding missing camelCase columns...');
    
    for (const col of requiredColumns) {
      if (!columnNames.includes(col.name)) {
        console.log(`  Adding column: ${col.name}`);
        const defaultClause = col.default ? `DEFAULT ${col.default}` : '';
        await query(`ALTER TABLE templates ADD COLUMN "${col.name}" ${col.type} ${defaultClause}`);
      } else {
        console.log(`  Column ${col.name} already exists`);
      }
    }

    // Step 2: Migrate data from old equipment/crew_required columns to new schema
    console.log('\n📋 Migrating data from old equipment column to new schema...');
    
    if (columnNames.includes('equipment') && columnNames.includes('crew_required')) {
      console.log('  Extracting studio IDs, PCR room IDs, colors, and status from equipment column...');
      
      // Extract data from equipment JSON column
      await query(`
        UPDATE templates SET 
          "studioIds" = COALESCE((equipment->0->>'studioIds')::json, '[]'::json),
          "pcrRoomId" = (equipment->0->>'pcrRoomId')::integer,
          "color" = equipment->0->>'color',
          "status" = COALESCE(equipment->0->>'status', 'confirmed'),
          "notifyList" = COALESCE(crew_required, '[]'::json),
          "createdBy" = COALESCE(created_by, 1)
        WHERE equipment IS NOT NULL AND equipment != '[]'::jsonb
      `);
      
      console.log('  Migration from equipment column completed');
    } else if (columnNames.includes('created_by')) {
      // Handle case where we only have created_by column
      console.log('  Copying created_by to createdBy...');
      await query(`UPDATE templates SET "createdBy" = COALESCE(created_by, 1)`);
    } else {
      console.log('  Setting default values for templates without equipment data...');
      await query(`
        UPDATE templates SET 
          "studioIds" = '[]'::json,
          "color" = '#3B82F6',
          "status" = 'confirmed',
          "notifyList" = '[]'::json,
          "createdBy" = 1
        WHERE "createdBy" IS NULL
      `);
    }

    // Step 3: Set createdBy to NOT NULL with default value for existing records
    console.log('\n🔧 Fixing createdBy column constraints...');
    
    // Update any NULL createdBy values to 1 (assuming user ID 1 exists)
    await query(`UPDATE templates SET "createdBy" = 1 WHERE "createdBy" IS NULL`);
    
    // Add NOT NULL constraint
    if (columnNames.includes('createdBy')) {
      try {
        await query(`ALTER TABLE templates ALTER COLUMN "createdBy" SET NOT NULL`);
        console.log('  Set createdBy as NOT NULL');
      } catch (error) {
        if (!error.message.includes('column "createdBy" of relation "templates" is already not null')) {
          console.log('  Warning: Could not set createdBy as NOT NULL:', error.message);
        }
      }
    }

    // Step 4: Drop old snake_case columns (optional - can be commented out for safety)
    console.log('\n🧹 Cleaning up old snake_case columns...');
    
    const columnsToKeep = ['id', 'name', 'description', 'type', 'duration', 'status', 'color'];
    
    for (const col of requiredColumns) {
      if (columnNames.includes(col.snakeCase) && !columnsToKeep.includes(col.snakeCase)) {
        console.log(`  Dropping old column: ${col.snakeCase}`);
        try {
          await query(`ALTER TABLE templates DROP COLUMN IF EXISTS ${col.snakeCase}`);
        } catch (error) {
          console.log(`  Warning: Could not drop ${col.snakeCase}:`, error.message);
        }
      }
    }

    // Drop legacy columns that are no longer needed
    const legacyColumns = ['equipment', 'crew_required', 'user_id', 'created_at'];
    for (const legacyCol of legacyColumns) {
      if (columnNames.includes(legacyCol)) {
        console.log(`  Dropping legacy column: ${legacyCol}`);
        try {
          await query(`ALTER TABLE templates DROP COLUMN IF EXISTS ${legacyCol}`);
        } catch (error) {
          console.log(`  Warning: Could not drop ${legacyCol}:`, error.message);
        }
      }
    }

    // Step 5: Verify final schema
    console.log('\n✅ Final schema verification...');
    const finalSchema = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'templates' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('Final templates table structure:');
    finalSchema.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    // Test template data
    const templateCount = await query('SELECT COUNT(*) as count FROM templates');
    console.log(`\n📊 Total templates: ${templateCount.rows[0].count}`);

    if (parseInt(templateCount.rows[0].count) > 0) {
      const sampleTemplate = await query('SELECT id, name, "studioIds", "pcrRoomId", "createdBy" FROM templates LIMIT 1');
      console.log('Sample template data:');
      console.log(`  ID: ${sampleTemplate.rows[0].id}, Name: ${sampleTemplate.rows[0].name}`);
      console.log(`  Studios: ${sampleTemplate.rows[0].studioIds}, PCR: ${sampleTemplate.rows[0].pcrRoomId}`);
      console.log(`  Created by: ${sampleTemplate.rows[0].createdBy}`);
    }

    console.log('\n🎉 Production template schema fix completed successfully!');

  } catch (error) {
    console.error('❌ Schema fix failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  fixProductionTemplateSchema()
    .then(() => {
      console.log('✅ Schema fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Schema fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixProductionTemplateSchema };