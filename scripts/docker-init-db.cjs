#!/usr/bin/env node
// CommonJS version of the initialization script specifically for Docker environment
const { Pool } = require('pg');
const crypto = require('crypto');
const util = require('util');

// Configure scrypt function
const scryptAsync = util.promisify(crypto.scrypt);

// Create database connection
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set. Initialization failed.");
  process.exit(1);
}

// Create a PostgreSQL connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Hash password function
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

// Main initialization function
async function initDb() {
  console.log('Initializing database with admin user');
  
  try {
    // Check if admin already exists
    const existingAdmin = await pool.query(
      `SELECT * FROM users WHERE username = 'admin' LIMIT 1`
    );

    if (existingAdmin.rows && existingAdmin.rows.length > 0) {
      console.log('Admin user already exists, skipping creation');
    } else {
      console.log('Creating initial users...');
      
      // Create admin user
      const hashedPassword = await hashPassword('admin123');
      
      // Use the raw pool.query instead of drizzle's execute
      await pool.query(
        `INSERT INTO users (username, password, email, name, role) VALUES ($1, $2, $3, $4, $5)`,
        ['admin', hashedPassword, 'admin@example.com', 'Admin User', 'admin']
      );

      console.log('Admin user created successfully!');

      // Add an engineer user as well
      const engineerPassword = await hashPassword('engineer123');
      
      await pool.query(
        `INSERT INTO users (username, password, email, name, role) VALUES ($1, $2, $3, $4, $5)`,
        ['engineer', engineerPassword, 'engineer@example.com', 'Engineer User', 'engineer']
      );

      console.log('Engineer user created successfully!');
      
      // Add some initial studios
      console.log('Creating initial studios...');
      for (let i = 1; i <= 20; i++) {
        await pool.query(
          `INSERT INTO studios (name, status, description) VALUES ($1, $2, $3)`,
          [`Studio ${i}`, 'active', `Television studio ${i} with standard equipment`]
        );
      }
      console.log('Studios created successfully!');
    }
    
    console.log('Database initialization completed');
    // Close the connection pool
    await pool.end();
  } catch (error) {
    console.error('Error initializing database:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run the initialization
initDb()
  .then(() => {
    console.log('Database initialization completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error initializing database:', error);
    process.exit(1);
  });