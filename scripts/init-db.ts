import { db } from '../server/db';
import { users } from '../shared/schema';
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