// Support both Docker and local development environments
let db;
try {
  // Try Docker path first (absolute path)
  const dockerDb = require('/app/server/db');
  db = dockerDb.db;
  console.log('Using Docker database connection');
} catch (error) {
  // Fall back to local development path (relative path)
  const localDb = require('../server/db');
  db = localDb.db;
  console.log('Using local development database connection');
}
import { users, notificationGroups } from '../shared/schema';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { eq } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function initDb() {
  console.log('Initializing database with admin user');
  
  // Check if admin already exists
  const existingAdmin = await db.select().from(users).where(
    eq(users.username, 'admin')
  );

  if (existingAdmin.length > 0) {
    console.log('Admin user already exists, skipping creation');
    return;
  }

  // Create admin user
  const hashedPassword = await hashPassword('admin123');
  
  await db.insert(users).values({
    username: 'admin',
    password: hashedPassword,
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin'
  });

  console.log('Admin user created successfully!');

  // Add an engineer user as well
  const engineerPassword = await hashPassword('engineer123');
  
  await db.insert(users).values({
    username: 'engineer',
    password: engineerPassword,
    email: 'engineer@example.com',
    name: 'Engineer User',
    role: 'engineer'
  });

  console.log('Engineer user created successfully!');

  // Add a site manager user
  const siteManagerPassword = await hashPassword('sitemanager123');
  
  await db.insert(users).values({
    username: 'sitemanager',
    password: siteManagerPassword,
    email: 'sitemanager@example.com',
    name: 'Site Manager User',
    role: 'site_manager'
  });

  console.log('Site Manager user created successfully!');

  // Add a producer user for testing
  const producerPassword = await hashPassword('producer123');
  
  await db.insert(users).values({
    username: 'producer',
    password: producerPassword,
    email: 'producer@example.com',
    name: 'Producer User',
    role: 'producer'
  });

  console.log('Producer user created successfully!');
  
  // Skip creating default notification groups
  // Facilities should create their own notification groups as needed
  console.log('Notification groups will be created by facility administrators as needed.');
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