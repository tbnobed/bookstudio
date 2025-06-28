/**
 * Comprehensive database fix script for BookStud.io
 * Fixes PCR rooms, templates, and all other database schema issues
 */

import pg from 'pg';
const { Pool } = pg;

// Retrieve database connection info from environment
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

// Create database pool
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

async function main() {
  console.log('Starting comprehensive database fix script...');
  
  try {
    // Ensure connection is successful
    await ensureConnection();
    
    // Fix each component of the database
    await ensureBookingStudiosTable();
    await ensureStudioLinks();
    await ensureStatusColumn();
    await ensurePcrRoomColumn();
    await ensureSystemSettings();
    await ensureColorColumn();
    await ensureSeverityColumn();
    
    console.log('Database schema fix completed successfully!');
  } catch (error) {
    console.error('Error fixing database schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function ensureConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection verified');
    return true;
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

async function ensureBookingStudiosTable() {
  console.log('Ensuring booking_studios table exists...');
  
  try {
    // Check if booking_studios table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'booking_studios'
      )
    `);
    
    const exists = tableExists.rows[0].exists;
    
    if (!exists) {
      console.log('Creating booking_studios table...');
      await query(`
        CREATE TABLE booking_studios (
          id SERIAL PRIMARY KEY,
          booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          studio_id INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
          UNIQUE(booking_id, studio_id)
        )
      `);
      console.log('booking_studios table created successfully');
    } else {
      console.log('booking_studios table already exists');
    }
  } catch (error) {
    console.error('Error ensuring booking_studios table:', error);
    throw error;
  }
}

async function ensureStudioLinks() {
  console.log('Ensuring all studios have booking links...');
  
  try {
    // Get all studios
    const allStudios = await query(`SELECT id, name FROM studios`);
    
    // For each studio, check if it has any booking links
    for (const studio of allStudios.rows) {
      const studioId = studio.id;
      const studioName = studio.name;
      
      const links = await query(`
        SELECT COUNT(*) as count FROM booking_studios 
        WHERE studio_id = $1
      `, [studioId]);
      
      const linkCount = parseInt(links.rows[0].count);
      
      if (linkCount === 0) {
        console.log(`Studio ${studioName} (ID: ${studioId}) has no booking links - creating link...`);
        
        // Find most recent booking
        const recentBookings = await query(`
          SELECT id FROM bookings ORDER BY created_at DESC LIMIT 1
        `);
        
        if (recentBookings.rows.length > 0) {
          const bookingId = recentBookings.rows[0].id;
          
          // Create link between studio and this booking
          await query(`
            INSERT INTO booking_studios (booking_id, studio_id)
            VALUES ($1, $2)
            ON CONFLICT (booking_id, studio_id) DO NOTHING
          `, [bookingId, studioId]);
          
          console.log(`Created link between Studio ${studioName} and Booking ID ${bookingId}`);
        } else {
          console.log('No bookings found to create links with');
        }
      } else {
        console.log(`Studio ${studioName} (ID: ${studioId}) already has ${linkCount} booking links`);
      }
    }
  } catch (error) {
    console.error('Error ensuring studio links:', error);
    throw error;
  }
}

async function ensureStatusColumn() {
  console.log('Ensuring status column exists in bookings table...');
  
  try {
    // Check if status column exists
    const columnExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'status'
      )
    `);
    
    const exists = columnExists.rows[0].exists;
    
    if (!exists) {
      console.log('Adding status column to bookings table...');
      await query(`
        ALTER TABLE bookings
        ADD COLUMN status VARCHAR(50) DEFAULT 'confirmed'
      `);
      console.log('Status column added successfully');
    } else {
      console.log('Status column already exists');
    }
  } catch (error) {
    console.error('Error ensuring status column:', error);
    throw error;
  }
}

async function ensureSeverityColumn() {
  console.log('Ensuring severity column exists in bookings table...');
  
  try {
    // Check if severity column exists
    const columnExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'severity'
      )
    `);
    
    const exists = columnExists.rows[0].exists;
    
    if (!exists) {
      console.log('Adding severity column to bookings table...');
      await query(`
        ALTER TABLE bookings
        ADD COLUMN severity VARCHAR(50) DEFAULT 'medium'
      `);
      console.log('Severity column added successfully');
    } else {
      console.log('Severity column already exists');
    }
  } catch (error) {
    console.error('Error ensuring severity column:', error);
    throw error;
  }
}

async function ensurePcrRoomColumn() {
  console.log('Ensuring pcr_room_id column exists in bookings table...');
  
  try {
    // First ensure pcr_rooms table exists
    await ensurePcrRoomsTable();
    
    // Check if pcr_room_id column exists
    const columnExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'pcr_room_id'
      )
    `);
    
    const exists = columnExists.rows[0].exists;
    
    if (!exists) {
      console.log('Adding pcr_room_id column to bookings table...');
      await query(`
        ALTER TABLE bookings
        ADD COLUMN pcr_room_id INTEGER REFERENCES pcr_rooms(id) ON DELETE SET NULL
      `);
      console.log('pcr_room_id column added successfully');
    } else {
      console.log('pcr_room_id column already exists');
    }
  } catch (error) {
    console.error('Error ensuring pcr_room_id column:', error);
    throw error;
  }
}

async function ensurePcrRoomsTable() {
  console.log('Ensuring pcr_rooms table exists...');
  
  try {
    // Check if pcr_rooms table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'pcr_rooms'
      )
    `);
    
    const exists = tableExists.rows[0].exists;
    
    if (!exists) {
      console.log('Creating pcr_rooms table...');
      await query(`
        CREATE TABLE pcr_rooms (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          status VARCHAR(50) DEFAULT 'available'
        )
      `);
      
      console.log('pcr_rooms table created successfully - ready for manual configuration');
    } else {
      console.log('pcr_rooms table already exists');
      
      console.log('pcr_rooms table ready for manual configuration');
    }
  } catch (error) {
    console.error('Error ensuring pcr_rooms table:', error);
    throw error;
  }
}

async function ensureTemplatesTable() {
  console.log('Ensuring templates table exists...');
  
  try {
    // Check if templates table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'templates'
      )
    `);
    
    const exists = tableExists.rows[0].exists;
    
    if (!exists) {
      console.log('Creating templates table...');
      await query(`
        CREATE TABLE templates (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          type VARCHAR(50) DEFAULT 'production',
          duration INTEGER,
          crew_required TEXT[],
          equipment TEXT[],
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      
      // Add default template
      await query(`
        INSERT INTO templates (name, description, type, duration, crew_required, equipment, created_by)
        VALUES (
          'DP Podcast', 
          '', 
          'production', 
          120, 
          ARRAY['Camera Operators', 'Directors', 'Lighting Technicians', 'Sound Engineers', 'Production Assistants'], 
          ARRAY['Microphones', 'Recording Equipment', 'Teleprompter', 'Cameras', 'Lights'],
          1
        )
      `);
      
      console.log('templates table created successfully with default template');
    } else {
      console.log('templates table already exists');
      
      // Check if we have any templates, if not add a default one
      const templateCount = await query(`SELECT COUNT(*) as count FROM templates`);
      
      if (parseInt(templateCount.rows[0].count) === 0) {
        console.log('Adding default template...');
        await query(`
          INSERT INTO templates (name, description, type, duration, crew_required, equipment, created_by)
          VALUES (
            'DP Podcast', 
            '', 
            'production', 
            120, 
            ARRAY['Camera Operators', 'Directors', 'Lighting Technicians', 'Sound Engineers', 'Production Assistants'], 
            ARRAY['Microphones', 'Recording Equipment', 'Teleprompter', 'Cameras', 'Lights'],
            1
          )
        `);
        console.log('Default template added');
      }
    }
  } catch (error) {
    console.error('Error ensuring templates table:', error);
    throw error;
  }
}

async function ensureSystemSettings() {
  console.log('Ensuring system_settings table exists and has necessary data...');
  
  try {
    // Check if system_settings table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'system_settings'
      )
    `);
    
    const exists = tableExists.rows[0].exists;
    
    if (!exists) {
      console.log('Creating system_settings table...');
      await query(`
        CREATE TABLE system_settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(100) UNIQUE NOT NULL,
          value TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('system_settings table created successfully');
    } else {
      console.log('system_settings table already exists');
    }
    
    // Ensure site name setting exists
    const siteName = await query(`
      SELECT COUNT(*) as count FROM system_settings WHERE key = 'siteName'
    `);
    
    if (parseInt(siteName.rows[0].count) === 0) {
      await query(`
        INSERT INTO system_settings (key, value)
        VALUES ('siteName', 'The Plex Studios')
      `);
      console.log('Added siteName setting');
    } else {
      console.log('siteName setting already exists');
    }
    
    // Add other system settings if needed
  } catch (error) {
    console.error('Error ensuring system_settings:', error);
    throw error;
  }
}

async function ensureColorColumn() {
  console.log('Ensuring color column exists in bookings table...');
  
  try {
    // Check if color column exists
    const columnExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'color'
      )
    `);
    
    const exists = columnExists.rows[0].exists;
    
    if (!exists) {
      console.log('Adding color column to bookings table...');
      await query(`
        ALTER TABLE bookings
        ADD COLUMN color VARCHAR(50)
      `);
      console.log('Color column added successfully');
    } else {
      console.log('Color column already exists');
    }
  } catch (error) {
    console.error('Error ensuring color column:', error);
    throw error;
  }
}

// Helper function to execute SQL queries
async function query(text, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// Run the script
main().catch(console.error);