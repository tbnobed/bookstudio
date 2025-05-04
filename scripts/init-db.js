#!/usr/bin/env node
// Dynamically select the appropriate database connection module
// for compatibility in both Docker and development environments
let dbModule;
try {
  dbModule = await import('./db-es.js');
} catch (error) {
  // Fallback to standard db.js if db-es.js is not available
  dbModule = await import('./db.js');
}

const { db } = dbModule;
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { eq } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

async function initDb() {
  console.log('Initializing database with admin user');
  
  try {
    // Check if admin already exists
    const existingAdmin = await db.execute(
      `SELECT * FROM users WHERE username = 'admin' LIMIT 1`
    );

    if (existingAdmin.rows.length > 0) {
      console.log('Admin user already exists, skipping creation');
    } else {
      // Create admin user
      const hashedPassword = await hashPassword('admin123');
      
      await db.execute(
        `INSERT INTO users (username, password, email, name, role) VALUES ($1, $2, $3, $4, $5)`,
        ['admin', hashedPassword, 'admin@example.com', 'Admin User', 'admin']
      );

      console.log('Admin user created successfully!');

      // Add an engineer user as well
      const engineerPassword = await hashPassword('engineer123');
      
      await db.execute(
        `INSERT INTO users (username, password, email, name, role) VALUES ($1, $2, $3, $4, $5)`,
        ['engineer', engineerPassword, 'engineer@example.com', 'Engineer User', 'engineer']
      );

      console.log('Engineer user created successfully!');
    }
    
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Run the initialization
initDb()
  .then(() => {
    console.log('Database initialization completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error initializing database:', error);
    process.exit(1);
  });