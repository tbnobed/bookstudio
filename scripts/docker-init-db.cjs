/**
 * Database initialization script optimized for Docker environments
 * This is a CommonJS version of the init-db.ts script
 */
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const crypto = require('crypto');
const { promisify } = require('util');

// Ensure we have environment variables
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable must be set");
}

// Create database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Register error handler
pool.on('error', (err) => {
  console.error('Unexpected database connection error:', err);
});

// Initialize DB (without schema which we don't need to reference)
const db = drizzle(pool);

// Password hashing function
const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function initDb() {
  console.log('Initializing database with admin user');
  
  // Check if admin already exists
  const result = await db.execute(`
    SELECT id FROM users WHERE username = 'admin' LIMIT 1;
  `);
  
  const existingAdmin = result.rows;

  if (existingAdmin.length > 0) {
    console.log('Admin user already exists, skipping creation');
    return;
  }

  // Create admin user
  const hashedPassword = await hashPassword('admin123');
  
  await db.execute(`
    INSERT INTO users (username, password, email, name, role)
    VALUES ('admin', '${hashedPassword}', 'admin@example.com', 'Admin User', 'admin');
  `);

  console.log('Admin user created successfully!');

  // Add an engineer user
  const engineerPassword = await hashPassword('engineer123');
  
  await db.execute(`
    INSERT INTO users (username, password, email, name, role)
    VALUES ('engineer', '${engineerPassword}', 'engineer@example.com', 'Engineer User', 'engineer');
  `);

  console.log('Engineer user created successfully!');

  // Add a site manager user
  const siteManagerPassword = await hashPassword('sitemanager123');
  
  await db.execute(`
    INSERT INTO users (username, password, email, name, role)
    VALUES ('sitemanager', '${siteManagerPassword}', 'sitemanager@example.com', 'Site Manager User', 'site_manager');
  `);

  console.log('Site Manager user created successfully!');

  // Add a producer user for testing
  const producerPassword = await hashPassword('producer123');
  
  await db.execute(`
    INSERT INTO users (username, password, email, name, role)
    VALUES ('producer', '${producerPassword}', 'producer@example.com', 'Producer User', 'producer');
  `);

  console.log('Producer user created successfully!');
  
  // Check if notification groups already exist
  const groupsResult = await db.execute(`
    SELECT id FROM notification_groups LIMIT 1;
  `);
  
  const existingGroups = groupsResult.rows;
  
  if (existingGroups.length === 0) {
    console.log('Initializing default notification groups');
    
    // Create default notification groups
    const defaultGroups = [
      {
        name: "Camera Operators",
        email: "camera-team@bookstud.io",
        groupType: "department",
        description: "All camera operators and technicians",
        enabled: true
      },
      {
        name: "Lighting Technicians",
        email: "lighting-team@bookstud.io",
        groupType: "department",
        description: "Lighting department staff",
        enabled: true
      },
      {
        name: "Sound Engineers",
        email: "sound-team@bookstud.io",
        groupType: "department",
        description: "Audio engineers and sound technicians",
        enabled: true
      },
      {
        name: "Directors",
        email: "directors@bookstud.io",
        groupType: "department",
        description: "Show directors and production leaders",
        enabled: true
      },
      {
        name: "Facility Maintenance",
        email: "maintenance@bookstud.io",
        groupType: "facility",
        description: "Facility maintenance and operations staff",
        enabled: true
      },
      {
        name: "All Staff",
        email: "all-staff@bookstud.io",
        groupType: "facility",
        description: "All studio staff for facility-wide announcements",
        enabled: true
      }
    ];
    
    // Insert the default groups
    for (const group of defaultGroups) {
      await db.execute(`
        INSERT INTO notification_groups (name, email, group_type, description, enabled)
        VALUES (
          '${group.name}',
          '${group.email}',
          '${group.groupType}',
          '${group.description}',
          ${group.enabled}
        );
      `);
    }
    
    console.log('Default notification groups created successfully!');
  } else {
    console.log('Notification groups already exist, skipping creation');
  }
}

// Run the initialization
initDb()
  .then(() => {
    console.log('Database initialization completed');
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.error('Error initializing database:', error);
    pool.end();
    process.exit(1);
  });