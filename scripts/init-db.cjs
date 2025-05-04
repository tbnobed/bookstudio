// CommonJS version for database initialization in Docker environment
const crypto = require('crypto');
const util = require('util');
const { db } = require('./db.cjs');

const scryptAsync = util.promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function initDb() {
  console.log('Initializing database with sample data...');
  
  try {
    // Create initial users if they don't exist
    const existingUsers = await db.query.users.findMany();
    
    if (existingUsers.length === 0) {
      console.log('Creating initial users...');
      
      // Create admin user
      await db.insert(db.users).values({
        username: 'admin',
        password: await hashPassword('admin123'),
        email: 'admin@bookstud.io',
        name: 'Admin User',
        role: 'admin'
      });
      
      // Create producer user
      await db.insert(db.users).values({
        username: 'producer',
        password: await hashPassword('producer123'),
        email: 'producer@bookstud.io',
        name: 'Producer User',
        role: 'producer'
      });
      
      // Create engineer user
      await db.insert(db.users).values({
        username: 'engineer',
        password: await hashPassword('engineer123'),
        email: 'engineer@bookstud.io',
        name: 'Engineer User',
        role: 'engineer'
      });
      
      console.log('Initial users created successfully');
    } else {
      console.log('Users already exist, skipping user creation');
    }
    
    // Create initial studios if they don't exist
    const existingStudios = await db.query.studios.findMany();
    
    if (existingStudios.length === 0) {
      console.log('Creating initial studios...');
      
      const studioNames = [
        'Studio A',
        'Studio B',
        'Studio C',
        'Control Room 1',
        'Control Room 2',
        'Production Suite',
        'Edit Bay 1',
        'Edit Bay 2',
        'Audio Room',
        'Green Screen',
      ];
      
      for (let i = 0; i < studioNames.length; i++) {
        await db.insert(db.studios).values({
          name: studioNames[i],
          status: 'available',
          description: `${studioNames[i]} - Multi-purpose production space`
        });
      }
      
      console.log('Initial studios created successfully');
    } else {
      console.log('Studios already exist, skipping studio creation');
    }
    
    // Create initial templates if they don't exist
    const existingTemplates = await db.query.templates.findMany();
    
    if (existingTemplates.length === 0) {
      console.log('Creating initial templates...');
      
      // Get admin user ID
      const adminUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.username, 'admin')
      });
      
      if (adminUser) {
        await db.insert(db.templates).values({
          name: 'DP Podcast',
          description: '',
          type: 'podcast',
          duration: 90,
          crewRequired: JSON.stringify(['Host', 'Producer', 'Audio Engineer']),
          equipment: JSON.stringify(['Microphones (4)', 'Audio Mixer', 'DSLR Camera']),
          createdBy: adminUser.id
        });
        
        await db.insert(db.templates).values({
          name: 'News Interview',
          description: 'Standard news interview setup',
          type: 'interview',
          duration: 45,
          crewRequired: JSON.stringify(['Host', 'Camera Operator', 'Guest Coordinator']),
          equipment: JSON.stringify(['Interview Set', 'Lavalier Mics (2)', 'Studio Lighting']),
          createdBy: adminUser.id
        });
        
        console.log('Initial templates created successfully');
      } else {
        console.log('Admin user not found, skipping template creation');
      }
    } else {
      console.log('Templates already exist, skipping template creation');
    }
    
    console.log('Database initialization completed successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

// Run the initialization
initDb()
  .then(() => {
    console.log('Database initialization completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });