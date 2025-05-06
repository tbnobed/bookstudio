/**
 * Production database initialization script
 * This script runs only once when the container starts in Docker
 */

const { Pool } = require('pg');
const { createClient } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { drizzle: drizzlePg } = require('drizzle-orm/pg-core');
const { sql } = require('drizzle-orm');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const WebSocket = require('ws');

// Import schema - this uses CommonJS require since we're in a Node.js script
const schema = require('../shared/schema');

// Promisify scrypt
const scryptAsync = promisify(scrypt);

/**
 * Hash a password for storage
 */
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

/**
 * Main database initialization function
 */
async function initDb() {
  console.log('Starting database initialization...');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  let client;
  let db;
  
  try {
    console.log('Connecting to database...');
    // Determine if we're using Neon Serverless or regular Postgres
    if (process.env.DATABASE_URL.includes('pooled')) {
      // Neon PostgreSQL with pooling support
      const neon = createClient({ connectionString: process.env.DATABASE_URL });
      db = drizzle(neon, { schema });
      client = neon;
    } else {
      // Standard PostgreSQL
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      client = pool;
      db = drizzlePg(pool, { schema });
    }

    // Test connection
    await client.query('SELECT 1');
    console.log('Successfully connected to database');
    
    // Create tables if they don't exist
    console.log('Creating tables if they don\'t exist...');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'producer'
      );
    `);
    
    // Create studios table
    await client.query(`
      CREATE TABLE IF NOT EXISTS studios (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'available'
      );
    `);
    
    // Create pcr_rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pcr_rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'available'
      );
    `);
    
    // Create templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        duration INTEGER NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id),
        crew_required JSONB,
        equipment JSONB
      );
    `);
    
    // Create bookings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start TIMESTAMP NOT NULL,
        end TIMESTAMP NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'standard',
        user_id INTEGER NOT NULL REFERENCES users(id),
        studio_id INTEGER REFERENCES studios(id),
        pcr_room_id INTEGER REFERENCES pcr_rooms(id),
        template_id INTEGER REFERENCES templates(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notify_list JSONB,
        severity VARCHAR(50)
      );
    `);
    
    // Create booking_studios junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_studios (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        studio_id INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
        UNIQUE(booking_id, studio_id)
      );
    `);
    
    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read BOOLEAN DEFAULT FALSE,
        type VARCHAR(50) NOT NULL DEFAULT 'info',
        booking_id INTEGER REFERENCES bookings(id)
      );
    `);
    
    // Create notification_groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        email VARCHAR(255) NOT NULL,
        group_type VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE
      );
    `);
    
    // Create password_reset_tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE
      );
    `);
    
    // Create invite_tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invite_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id),
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE
      );
    `);
    
    // Check if admin user exists
    const adminResult = await client.query('SELECT * FROM users WHERE username = $1', ['admin']);
    
    if (adminResult.rows.length === 0) {
      // Create admin user if it doesn't exist
      console.log('Creating admin user...');
      const hashedPassword = await hashPassword('admin');
      
      await client.query(
        'INSERT INTO users (username, email, password, name, role) VALUES ($1, $2, $3, $4, $5)',
        ['admin', 'admin@bookstud.io', hashedPassword, 'Admin User', 'admin']
      );
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists, skipping creation');
    }
    
    // Check if default studios exist
    const studiosResult = await client.query('SELECT COUNT(*) FROM studios');
    
    if (parseInt(studiosResult.rows[0].count) === 0) {
      console.log('Creating default studios...');
      
      const defaultStudios = [
        { name: 'Studio A', description: 'Studio A - Main production studio' },
        { name: 'Studio B', description: 'Studio B - Secondary production studio' },
        { name: 'Studio C', description: 'Studio C - Interview studio' },
        { name: 'Studio D', description: 'Studio D - News studio' },
        { name: 'Studio E', description: 'Studio E - Sports studio' },
        { name: 'Studio F', description: 'Studio F - Music studio' },
        { name: 'PCR 1', description: 'Production Control Room 1', type: 'pcr' },
        { name: 'PCR 2', description: 'Production Control Room 2', type: 'pcr' }
      ];
      
      for (const studio of defaultStudios) {
        if (studio.type === 'pcr') {
          await client.query(
            'INSERT INTO pcr_rooms (name, description) VALUES ($1, $2)',
            [studio.name, studio.description]
          );
        } else {
          await client.query(
            'INSERT INTO studios (name, description) VALUES ($1, $2)',
            [studio.name, studio.description]
          );
        }
      }
      
      console.log('Default studios created successfully');
    } else {
      console.log('Studios already exist, skipping creation');
    }
    
    // Create default notification groups
    const groupsResult = await client.query('SELECT COUNT(*) FROM notification_groups');
    
    if (parseInt(groupsResult.rows[0].count) === 0) {
      console.log('Creating default notification groups...');
      
      const defaultGroups = [
        { name: 'Production Crew', email: 'production@bookstud.io', groupType: 'production' },
        { name: 'Engineering', email: 'engineering@bookstud.io', groupType: 'engineering' },
        { name: 'Management', email: 'management@bookstud.io', groupType: 'management' },
        { name: 'Talent', email: 'talent@bookstud.io', groupType: 'talent' }
      ];
      
      for (const group of defaultGroups) {
        await client.query(
          'INSERT INTO notification_groups (name, email, group_type) VALUES ($1, $2, $3)',
          [group.name, group.email, group.groupType]
        );
      }
      
      console.log('Default notification groups created successfully');
    } else {
      console.log('Notification groups already exist, skipping creation');
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error during database initialization:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run initialization
initDb().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});