import { db } from '../server/db';
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
  
  // Check if notification groups already exist
  const existingGroups = await db.select().from(notificationGroups).limit(1);
  
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
      await db.insert(notificationGroups).values(group);
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
    process.exit(0);
  })
  .catch(error => {
    console.error('Error initializing database:', error);
    process.exit(1);
  });