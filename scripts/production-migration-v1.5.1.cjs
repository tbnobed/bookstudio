#!/usr/bin/env node

/**
 * Production Migration Script v1.5.1
 * Fixes for alert display and database schema consistency
 * Auto-runs during Docker deployment
 */

const { Pool } = require('pg');

// Create connection pool - no SSL for Docker internal connections
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'bookstudio',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  ssl: false, // Docker internal connections don't use SSL
});

async function fixColumnNaming() {
  console.log('=== Fixing database column naming consistency ===');
  
  try {
    // Check if linked_group_id column exists (old name)
    const oldColumnExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings' 
        AND column_name = 'linked_group_id'
      );
    `);
    
    // Check if link_group_id column exists (new name)
    const newColumnExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bookings' 
        AND column_name = 'link_group_id'
      );
    `);
    
    if (oldColumnExists.rows[0].exists && !newColumnExists.rows[0].exists) {
      console.log('Renaming linked_group_id to link_group_id for schema consistency...');
      await pool.query(`
        ALTER TABLE bookings 
        RENAME COLUMN linked_group_id TO link_group_id;
      `);
      console.log('Column renamed successfully');
    } else if (newColumnExists.rows[0].exists) {
      console.log('link_group_id column already exists - schema is consistent');
    } else if (!oldColumnExists.rows[0].exists && !newColumnExists.rows[0].exists) {
      console.log('Adding link_group_id column...');
      await pool.query(`
        ALTER TABLE bookings 
        ADD COLUMN link_group_id TEXT;
      `);
      console.log('link_group_id column added successfully');
    }
    
  } catch (error) {
    console.error('Error fixing column naming:', error);
    throw error;
  }
}

async function cleanInvalidNotifications() {
  console.log('=== Cleaning invalid notification references ===');
  
  try {
    // Remove notifications that reference non-existent users
    const cleanupResult = await pool.query(`
      DELETE FROM notifications 
      WHERE user_id NOT IN (SELECT id FROM users);
    `);
    
    if (cleanupResult.rowCount > 0) {
      console.log(`Removed ${cleanupResult.rowCount} invalid notification references`);
    } else {
      console.log('No invalid notification references found');
    }
    
  } catch (error) {
    console.error('Error cleaning notifications:', error);
    // Don't throw - this is cleanup, not critical
  }
}

async function fixSystemSettingsTable() {
  console.log('=== Fixing system_settings table schema ===');
  
  try {
    // Check if system_settings uses old column names
    const oldSchemaCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings' 
        AND column_name = 'setting_key'
      );
    `);
    
    const newSchemaCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings' 
        AND column_name = 'key'
      );
    `);
    
    if (oldSchemaCheck.rows[0].exists && !newSchemaCheck.rows[0].exists) {
      console.log('Updating system_settings table to new schema...');
      await pool.query('ALTER TABLE system_settings RENAME COLUMN setting_key TO key;');
      await pool.query('ALTER TABLE system_settings RENAME COLUMN setting_value TO value;');
      console.log('System_settings table updated successfully');
    } else if (newSchemaCheck.rows[0].exists) {
      console.log('System_settings table already uses correct schema');
    }
    
  } catch (error) {
    console.error('Error fixing system_settings table:', error);
    // Don't throw - this is a non-critical fix
  }
}

async function ensureRequiredTables() {
  console.log('=== Ensuring required tables exist ===');
  
  try {
    // Check if alerts table exists
    const alertsTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'alerts'
      );
    `);
    
    if (!alertsTableExists.rows[0].exists) {
      console.log('Creating alerts table...');
      await pool.query(`
        CREATE TABLE alerts (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          severity TEXT NOT NULL DEFAULT 'medium',
          alert_type TEXT NOT NULL DEFAULT 'maintenance',
          status TEXT NOT NULL DEFAULT 'active',
          start TIMESTAMPTZ NOT NULL,
          "end" TIMESTAMPTZ NOT NULL,
          created_by INTEGER NOT NULL REFERENCES users(id),
          notify_list JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('Alerts table created successfully');
    }
    
  } catch (error) {
    console.error('Error ensuring tables:', error);
    throw error;
  }
}

async function main() {
  console.log('Starting BookStud.io Production Migration v1.5.1...');
  console.log('Fixes: Alert display separation, database schema consistency, notification cleanup');
  
  try {
    await fixColumnNaming();
    await cleanInvalidNotifications();
    await fixSystemSettingsTable();
    await ensureRequiredTables();
    
    console.log('=== Production Migration v1.5.1 completed successfully ===');
    console.log('Alert display fixes and database consistency improvements applied');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { main };