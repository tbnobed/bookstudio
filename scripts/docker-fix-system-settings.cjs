#!/usr/bin/env node
// This script fixes the system_settings table schema to ensure it has an 'id' primary key column
// It's designed to be run in the Docker environment to fix existing tables

const { Pool } = require('pg');

// Create a connection to the database
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'bookstudio',
});

async function fixSystemSettingsTable() {
  try {
    console.log('Checking system_settings table structure...');
    
    const client = await pool.connect();
    
    try {
      // Check if the table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = 'system_settings'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        console.log('System settings table exists, checking structure...');
        
        // Check if id column exists
        const idCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'system_settings'
            AND column_name = 'id'
          );
        `);
        
        if (!idCheck.rows[0].exists) {
          console.log('Column "id" does not exist. Backing up and rebuilding table...');
          
          // Create a backup table
          await client.query(`
            CREATE TABLE system_settings_backup AS
            SELECT * FROM system_settings;
          `);
          console.log('Backup created as system_settings_backup');
          
          // Get the primary key constraint name
          const constraintQuery = await client.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'system_settings' 
            AND constraint_type = 'PRIMARY KEY';
          `);
          
          if (constraintQuery.rows.length > 0) {
            const pkConstraint = constraintQuery.rows[0].constraint_name;
            console.log(`Dropping primary key constraint: ${pkConstraint}`);
            
            // Drop the primary key constraint
            await client.query(`
              ALTER TABLE system_settings 
              DROP CONSTRAINT "${pkConstraint}";
            `);
          }
          
          // Add id column
          console.log('Adding id column as PRIMARY KEY...');
          await client.query(`
            ALTER TABLE system_settings 
            ADD COLUMN id SERIAL PRIMARY KEY;
          `);
          
          // Add other columns if missing
          const createdAtCheck = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_schema = 'public'
              AND table_name = 'system_settings'
              AND column_name = 'created_at'
            );
          `);
          
          if (!createdAtCheck.rows[0].exists) {
            console.log('Adding created_at column...');
            await client.query(`
              ALTER TABLE system_settings 
              ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            `);
          }
          
          const updatedAtCheck = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_schema = 'public'
              AND table_name = 'system_settings'
              AND column_name = 'updated_at'
            );
          `);
          
          if (!updatedAtCheck.rows[0].exists) {
            console.log('Adding updated_at column...');
            await client.query(`
              ALTER TABLE system_settings 
              ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            `);
          }
          
          // Ensure key column has UNIQUE constraint
          console.log('Making sure key column has UNIQUE constraint...');
          await client.query(`
            ALTER TABLE system_settings 
            ADD CONSTRAINT system_settings_key_unique UNIQUE (key);
          `).catch(err => {
            // Unique constraint might already exist, which is fine
            console.log('Note: unique constraint may already exist');
          });
          
          console.log('System settings table structure fixed successfully!');
        } else {
          console.log('System settings table already has the correct structure with id column.');
        }
      } else {
        console.log('System settings table does not exist, no fix needed (it will be created correctly by other scripts).');
      }
    } finally {
      client.release();
    }
    
    console.log('System settings table check/fix completed.');
  } catch (error) {
    console.error('Error fixing system settings table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
fixSystemSettingsTable().catch(err => {
  console.error('Unhandled error in system settings fix:', err);
  process.exit(1);
});