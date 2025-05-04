import pg from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../shared/schema.js';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { eq } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);

// Function to hash a password for storage
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

// Function to initialize the database with default data
async function initDb() {
  console.log('Starting database initialization...');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('Connecting to the database...');
  const connectionString = process.env.DATABASE_URL;
  const client = pg(connectionString);
  const db = drizzle(client, { schema });
  
  try {
    // Check if admin user exists
    console.log('Checking for existing admin user...');
    const [existingAdmin] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, 'admin'));
    
    if (!existingAdmin) {
      console.log('Creating default admin user...');
      const hashedPassword = await hashPassword('admin123');
      await db.insert(schema.users).values({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@bookstud.io',
        name: 'Admin User',
        role: 'admin'
      });
      console.log('Default admin user created.');
    } else {
      console.log('Admin user already exists, skipping creation.');
    }
    
    // Check for notification groups
    console.log('Checking for existing notification groups...');
    const notificationGroups = await db
      .select()
      .from(schema.notificationGroups);
    
    if (notificationGroups.length === 0) {
      console.log('Creating default notification groups...');
      const defaultGroups = [
        {
          name: "Camera Operators",
          email: "camera-team@bookstud.io",
          groupType: "department",
          description: "All camera operators and video technicians",
          enabled: true
        },
        {
          name: "Lighting Technicians",
          email: "lighting@bookstud.io",
          groupType: "department",
          description: "Lighting setup and operation staff",
          enabled: true
        },
        {
          name: "Directors",
          email: "directors@bookstud.io",
          groupType: "department",
          description: "Program directors and assistant directors",
          enabled: true
        },
        {
          name: "Sound Engineers",
          email: "sound@bookstud.io",
          groupType: "department",
          description: "Audio and sound personnel",
          enabled: true
        },
        {
          name: "Production Assistants",
          email: "pa@bookstud.io",
          groupType: "department",
          description: "PAs and floor managers",
          enabled: true
        },
        {
          name: "Engineering",
          email: "engineering@bookstud.io",
          groupType: "department",
          description: "Engineering and maintenance team",
          enabled: true
        },
        {
          name: "IT Support",
          email: "it@bookstud.io",
          groupType: "department",
          description: "IT support and network team",
          enabled: true
        },
        {
          name: "All Staff",
          email: "all-staff@bookstud.io",
          groupType: "facility",
          description: "All facility personnel",
          enabled: true
        }
      ];
      
      for (const group of defaultGroups) {
        await db.insert(schema.notificationGroups).values(group);
      }
      console.log(`Created ${defaultGroups.length} default notification groups.`);
    } else {
      console.log(`Found ${notificationGroups.length} existing notification groups, skipping creation.`);
    }
    
    // Check for studios
    console.log('Checking for existing studios...');
    const studios = await db
      .select()
      .from(schema.studios);
    
    if (studios.length === 0) {
      console.log('Creating default studios...');
      const defaultStudios = [
        { name: "Studio A", description: "Studio A - Main News Studio", status: "available" },
        { name: "Studio B", description: "Studio B - General Production", status: "available" },
        { name: "Studio C", description: "Studio C - Talk Show Studio", status: "available" },
        { name: "Studio D", description: "Studio D - Drama Production", status: "available" },
        { name: "Studio E", description: "Studio E - Green Screen", status: "available" },
        { name: "Studio F", description: "Studio F - Morning Show", status: "available" },
        { name: "Studio G", description: "Studio G - Weather", status: "available" },
        { name: "Studio H", description: "Studio H - Sports", status: "available" }
      ];
      
      for (const studio of defaultStudios) {
        await db.insert(schema.studios).values(studio);
      }
      console.log(`Created ${defaultStudios.length} default studios.`);
    } else {
      console.log(`Found ${studios.length} existing studios, skipping creation.`);
    }
    
    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error during database initialization:', error);
    process.exit(1);
  } finally {
    // Always close the connection
    await client.end();
  }
}

// Execute initialization immediately
initDb();