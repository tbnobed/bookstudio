// CommonJS version for database initialization in Docker environment
const { db } = require('./db.cjs');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

// Function to hash a password
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function initDb() {
  console.log('Initializing database...');

  try {
    // Check if users table is empty
    const usersCount = await db.select({ count: db.sql`count(*)` })
      .from(db.users);
    
    if (parseInt(usersCount[0]?.count || '0', 10) === 0) {
      console.log('Creating initial users...');
      
      // Create admin user
      const adminUser = {
        username: 'admin',
        name: 'System Administrator',
        email: 'admin@bookstud.io',
        password: await hashPassword('admin123'),
        role: 'admin'
      };
      
      // Create producer user
      const producerUser = {
        username: 'producer',
        name: 'Test Producer',
        email: 'producer@bookstud.io',
        password: await hashPassword('producer123'),
        role: 'producer'
      };
      
      // Create engineer user
      const engineerUser = {
        username: 'engineer',
        name: 'Test Engineer',
        email: 'engineer@bookstud.io',
        password: await hashPassword('engineer123'),
        role: 'engineer'
      };
      
      // Insert users
      await db.insert(db.users).values(adminUser);
      await db.insert(db.users).values(producerUser);
      await db.insert(db.users).values(engineerUser);
      
      console.log('Initial users created successfully');
    } else {
      console.log('Users already exist, skipping user creation');
    }
    
    // Check if studios table is empty
    const studiosCount = await db.select({ count: db.sql`count(*)` })
      .from(db.studios);
    
    if (parseInt(studiosCount[0]?.count || '0', 10) === 0) {
      console.log('Creating initial studios...');
      
      // Create demo studios
      const studioNames = [
        'Studio A - News', 
        'Studio B - Drama',
        'Studio C - Talk Shows',
        'Studio D - Sports',
        'Studio E - Weather',
        'Studio F - Children',
        'Studio G - Game Shows',
        'Studio H - Multi-purpose',
        'Studio I - Cooking',
        'Studio J - Documentary',
        'Studio K - Music',
        'Studio L - Virtual Reality',
        'Studio M - Radio',
        'Studio N - Podcast',
        'Studio O - Interview',
        'Studio P - Green Screen',
        'Studio Q - Commercial',
        'Studio R - Live Audience',
        'Studio S - Post-production',
        'Studio T - Custom Events'
      ];
      
      for (let i = 0; i < studioNames.length; i++) {
        const studio = {
          name: studioNames[i],
          status: 'available',
          description: `${studioNames[i]} for television production.`
        };
        
        await db.insert(db.studios).values(studio);
      }
      
      console.log('Initial studios created successfully');
    } else {
      console.log('Studios already exist, skipping studio creation');
    }
    
    console.log('Database initialization completed successfully');
  } catch (err) {
    console.error('Error during database initialization:', err);
    process.exit(1);
  }
}

// Run the initialization
initDb()
  .then(() => {
    console.log('Database initialized');
    process.exit(0);
  })
  .catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });