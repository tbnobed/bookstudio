import { db, pool } from '../server/db';
import { resources, bookingResources } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function migrateResourcesSchema() {
  try {
    console.log('Starting resources schema migration...');

    // Check if resources table exists
    const resourcesTableExists = await checkTableExists('resources');
    if (!resourcesTableExists) {
      console.log('Creating resources table...');
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS resources (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          category TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          is_available BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('Resources table created successfully');
    } else {
      console.log('Resources table already exists, skipping creation');
    }

    // Check if booking_resources table exists
    const bookingResourcesTableExists = await checkTableExists('booking_resources');
    if (!bookingResourcesTableExists) {
      console.log('Creating booking_resources table...');
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS booking_resources (
          id SERIAL PRIMARY KEY,
          booking_id INTEGER NOT NULL,
          resource_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          notes TEXT,
          FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
          FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
        );
      `);
      console.log('Booking resources table created successfully');
    } else {
      console.log('Booking resources table already exists, skipping creation');
    }

    // Seed some initial resource categories if the table is new
    if (!resourcesTableExists) {
      await seedInitialResources();
    }

    console.log('Resources schema migration completed successfully');
  } catch (error) {
    console.error('Error in resources schema migration:', error);
    throw error;
  }
}

async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `, [tableName]);
  
  return result.rows[0].exists;
}

async function seedInitialResources() {
  console.log('Seeding initial resources...');
  
  // Define common resource categories with example items
  const initialResources = [
    // Camera equipment
    { name: 'Sony FX6 Camera', description: 'Full-frame cinema camera with 4K recording', category: 'camera', quantity: 2 },
    { name: 'Canon C300 Mark III', description: 'Super 35mm cinema camera', category: 'camera', quantity: 3 },
    
    // Lighting equipment
    { name: 'ARRI SkyPanel S60-C', description: 'LED soft light with RGBW color control', category: 'lighting', quantity: 4 },
    { name: 'Aputure 300d Mark II', description: 'LED spotlight with bowens mount', category: 'lighting', quantity: 6 },
    
    // Audio equipment
    { name: 'Sennheiser MKH 416', description: 'Short shotgun microphone', category: 'audio', quantity: 5 },
    { name: 'Shure SM7B', description: 'Dynamic vocal microphone', category: 'audio', quantity: 8 },
    
    // Personnel
    { name: 'Camera Operator', description: 'Professional camera operator', category: 'personnel', quantity: 4 },
    { name: 'Audio Engineer', description: 'Professional audio technician', category: 'personnel', quantity: 3 },
    
    // Support equipment
    { name: 'Tripod', description: 'Professional fluid head tripod', category: 'support', quantity: 10 },
    { name: 'V-Mount Battery', description: '150Wh V-Mount battery', category: 'power', quantity: 15 },
  ];
  
  // Insert the initial resources
  for (const resource of initialResources) {
    await db.insert(resources).values(resource);
  }
  
  console.log('Initial resources seeded successfully');
}

// Run the migration
migrateResourcesSchema()
  .then(() => {
    console.log('Resources migration complete, exiting...');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });