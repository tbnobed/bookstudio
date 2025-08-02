#!/usr/bin/env node

/**
 * Docker cleanup script for invalid notification references
 * This script removes any notifications that reference non-existent users
 * to prevent foreign key constraint violations during deployment
 */

const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'bookstudio',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

async function cleanInvalidNotifications() {
  console.log('=== Cleaning invalid notification references ===');
  
  try {
    // Check if notifications table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('Notifications table does not exist - no cleanup needed');
      return;
    }
    
    // Find and delete notifications that reference non-existent users
    const cleanupResult = await pool.query(`
      DELETE FROM notifications 
      WHERE user_id NOT IN (SELECT id FROM users);
    `);
    
    if (cleanupResult.rowCount > 0) {
      console.log(`Cleaned up ${cleanupResult.rowCount} invalid notification entries`);
    } else {
      console.log('No invalid notification entries found');
    }
    
    // Show remaining notification count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM notifications');
    console.log(`${countResult.rows[0].count} valid notifications remain in database`);
    
    console.log('Notification cleanup completed successfully');
    
  } catch (error) {
    console.error('Error cleaning invalid notifications:', error);
    throw error;
  }
}

async function main() {
  console.log('Starting notification cleanup for BookStudio...');
  
  try {
    await cleanInvalidNotifications();
    console.log('=== Notification cleanup completed successfully ===');
    
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { main, cleanInvalidNotifications };