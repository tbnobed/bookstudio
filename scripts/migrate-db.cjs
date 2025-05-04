#!/usr/bin/env node
// CommonJS version of migrate-db for Docker compatibility
const { db } = require('./db.cjs');
const { sql } = require('drizzle-orm');

async function migrateDb() {
  console.log('Creating notification_groups table...');
  
  try {
    // Create the notification_groups table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        group_type TEXT NOT NULL,
        description TEXT,
        enabled BOOLEAN DEFAULT TRUE
      );
    `);
    
    console.log('notification_groups table created successfully!');

    // Check if notification groups already exist
    const existingGroups = await db.execute(sql`SELECT * FROM notification_groups LIMIT 1`);
    
    if (existingGroups.rows.length === 0) {
      console.log('Adding default notification groups...');
      
      // Create default notification groups
      const defaultGroups = [
        {
          name: "Camera Operators",
          email: "camera-team@bookstud.io",
          group_type: "department",
          description: "All camera operators and technicians",
          enabled: true
        },
        {
          name: "Lighting Technicians",
          email: "lighting-team@bookstud.io",
          group_type: "department",
          description: "Lighting department staff",
          enabled: true
        },
        {
          name: "Sound Engineers",
          email: "sound-team@bookstud.io",
          group_type: "department",
          description: "Audio engineers and sound technicians",
          enabled: true
        },
        {
          name: "Directors",
          email: "directors@bookstud.io",
          group_type: "department",
          description: "Show directors and production leaders",
          enabled: true
        },
        {
          name: "Facility Maintenance",
          email: "maintenance@bookstud.io",
          group_type: "facility",
          description: "Facility maintenance and operations staff",
          enabled: true
        },
        {
          name: "All Staff",
          email: "all-staff@bookstud.io",
          group_type: "facility",
          description: "All studio staff for facility-wide announcements",
          enabled: true
        }
      ];
      
      // Insert the default groups
      for (const group of defaultGroups) {
        await db.execute(sql`
          INSERT INTO notification_groups (name, email, group_type, description, enabled)
          VALUES (${group.name}, ${group.email}, ${group.group_type}, ${group.description}, ${group.enabled})
        `);
      }
      
      console.log('Default notification groups created successfully!');
    } else {
      console.log('Notification groups already exist, skipping creation');
    }
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateDb()
  .then(() => {
    console.log('Database migration completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error during migration:', error);
    process.exit(1);
  });