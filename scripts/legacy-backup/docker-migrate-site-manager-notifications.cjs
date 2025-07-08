/**
 * Migration script to ensure proper notification group setup for site manager notifications
 * This script ensures a site management notification group exists
 */

// No need for dotenv in Docker environment as variables are provided directly
const { Pool } = require('pg');

// Connection configuration for database
const config = {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'bookstudio',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
};

// Main migration function
async function migrateSiteManagerNotifications() {
  const pool = new Pool(config);

  try {
    console.log('Running site manager notification system migration...');

    // Check if notification_groups table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'notification_groups'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Notification groups table does not exist yet, migration will be handled by other scripts');
      return;
    }

    // Check if site management group exists
    const siteManagementGroupCheck = await pool.query(`
      SELECT * FROM notification_groups 
      WHERE name = 'Site Management' OR group_type = 'facility';
    `);

    // If no site management group exists, create one
    if (siteManagementGroupCheck.rows.length === 0) {
      console.log('Creating Site Management notification group...');
      
      // Create a site management notification group
      await pool.query(`
        INSERT INTO notification_groups (name, email, group_type, description, enabled) 
        VALUES ('Site Management', 'site-managers@bookstud.io', 'facility', 'Site managers will receive all notifications for all calendar activities', true);
      `);
      
      console.log('Site Management notification group created successfully');
    } else {
      console.log('Site Management notification group already exists, updating settings...');
      
      // Update the existing site management group to ensure it's enabled and properly configured
      await pool.query(`
        UPDATE notification_groups 
        SET enabled = true,
            description = COALESCE(description, 'Site managers will receive all notifications for all calendar activities')
        WHERE name = 'Site Management' OR group_type = 'facility';
      `);
      
      console.log('Site Management notification group updated successfully');
    }

    console.log('Site manager notification system migration completed successfully');
  } catch (error) {
    console.error('Error in site manager notification system migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
migrateSiteManagerNotifications().catch(err => {
  console.error('Unhandled error in site manager notification system migration:', err);
  process.exit(1);
});