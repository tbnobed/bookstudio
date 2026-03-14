/**
 * Consolidated Migration Script for BookStud.io
 * This script replaces all the individual Docker migration scripts
 * with a single, comprehensive migration system.
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection
pool.connect()
  .then(client => {
    client.release();
    console.log('✅ Database connection established');
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  });

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function consolidatedMigration() {
  console.log('🚀 Starting consolidated migration...');
  
  try {
    // Step 1: Create all core tables
    await createCoreUsers();
    await createCoreStudios();
    await createCoreNotificationGroups();
    await createCoreBookingTypes();
    await createCoreTemplates();
    await createCoreBookings();
    await createCoreAlerts();
    await createCoreSystemSettings();
    await createCorePcrRooms();
    await createCoreBookingStudios();
    await createCoreNotifications();
    await createCoreFileAttachments();
    await createCorePasswordResetTokens();
    await createCoreInviteTokens();
    await createCoreLinkedBookings();
    await createCoreAssets();
    await createCoreAssetCheckouts();
    
    // Step 2: Create default data
    await createDefaultAdmin();
    await createDefaultNotificationGroups();
    await createDefaultBookingTypes();
    await createDefaultSystemSettings();
    
    console.log('✅ Consolidated migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function createCoreUsers() {
  console.log('Creating users table...');
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'producer'
    );
  `);
}

async function createCoreStudios() {
  console.log('Creating studios table...');
  await query(`
    CREATE TABLE IF NOT EXISTS studios (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT DEFAULT 'available'
    );
  `);
}

async function createCoreNotificationGroups() {
  console.log('Creating notification_groups table...');
  await query(`
    CREATE TABLE IF NOT EXISTS notification_groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      group_type TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN DEFAULT TRUE
    );
  `);
}

async function createCoreBookingTypes() {
  console.log('Creating booking_types table...');
  await query(`
    CREATE TABLE IF NOT EXISTS booking_types (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function createCoreTemplates() {
  console.log('Creating templates table...');
  await query(`
    CREATE TABLE IF NOT EXISTS templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'production',
      duration INTEGER NOT NULL DEFAULT 120,
      start_time TEXT,
      end_time TEXT,
      studio_ids JSONB DEFAULT '[]',
      pcr_room_id INTEGER,
      status TEXT DEFAULT 'confirmed',
      color TEXT,
      notify_list JSONB DEFAULT '[]',
      created_by INTEGER NOT NULL DEFAULT 1
    );
  `);
}

async function createCoreBookings() {
  console.log('Creating bookings table...');
  await query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      studio_id INTEGER REFERENCES studios(id),
      user_id INTEGER REFERENCES users(id) NOT NULL,
      start TIMESTAMP NOT NULL,
      "end" TIMESTAMP NOT NULL,
      type TEXT NOT NULL,
      severity TEXT,
      status TEXT DEFAULT 'confirmed',
      pcr_room_id INTEGER,
      template_id INTEGER,
      notify_list JSONB DEFAULT '[]',
      color TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function createCoreAlerts() {
  console.log('Creating alerts table...');
  
  // Check if alerts table already exists
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'alerts'
    );
  `);
  
  if (tableExists.rows[0].exists) {
    console.log('✅ Alerts table already exists, checking schema...');
    
    // Check if status column exists
    const statusExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alerts' 
        AND column_name = 'status'
      );
    `);
    
    if (!statusExists.rows[0].exists) {
      console.log('Adding missing status column to alerts table...');
      await query('ALTER TABLE alerts ADD COLUMN status TEXT DEFAULT \'active\';');
    }
    
    // Check if is_all_day column exists
    const isAllDayExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alerts' 
        AND column_name = 'is_all_day'
      );
    `);
    
    if (!isAllDayExists.rows[0].exists) {
      console.log('Adding missing is_all_day column to alerts table...');
      await query('ALTER TABLE alerts ADD COLUMN is_all_day BOOLEAN DEFAULT false;');
    }
    
    // Check if created_by column exists or if we need to rename user_id
    const createdByExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alerts' 
        AND column_name = 'created_by'
      );
    `);
    
    const userIdExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'alerts' 
        AND column_name = 'user_id'
      );
    `);
    
    if (!createdByExists.rows[0].exists && userIdExists.rows[0].exists) {
      console.log('Renaming user_id column to created_by in alerts table...');
      await query('ALTER TABLE alerts RENAME COLUMN user_id TO created_by;');
    } else if (!createdByExists.rows[0].exists) {
      console.log('Adding missing created_by column to alerts table...');
      await query('ALTER TABLE alerts ADD COLUMN created_by INTEGER NOT NULL DEFAULT 1;');
    }
    
  } else {
    console.log('Creating new alerts table...');
    await query(`
      CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        start TIMESTAMP NOT NULL,
        "end" TIMESTAMP NOT NULL,
        is_all_day BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'active',
        notify_list JSON DEFAULT '[]',
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  }
  
  // Create indexes for better performance with error handling
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_alerts_start ON alerts(start);');
    console.log('✅ Created index on alerts.start');
  } catch (err) {
    console.log('Note: Index on alerts.start may already exist');
  }
  
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_alerts_end ON alerts("end");');
    console.log('✅ Created index on alerts.end');
  } catch (err) {
    console.log('Note: Index on alerts.end may already exist');
  }
  
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);');
    console.log('✅ Created index on alerts.status');
  } catch (err) {
    console.log('Note: Index on alerts.status may already exist');
  }
  
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);');
    console.log('✅ Created index on alerts.alert_type');
  } catch (err) {
    console.log('Note: Index on alerts.alert_type may already exist');
  }
  
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_alerts_created_by ON alerts(created_by);');
    console.log('✅ Created index on alerts.created_by');
  } catch (err) {
    console.log('Note: Index on alerts.created_by may already exist');
  }
}

async function createCoreSystemSettings() {
  console.log('Creating system_settings table...');
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function createCorePcrRooms() {
  console.log('Creating pcr_rooms table...');
  await query(`
    CREATE TABLE IF NOT EXISTS pcr_rooms (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'available'
    );
  `);
}

async function createCoreBookingStudios() {
  console.log('Creating booking_studios table...');
  await query(`
    CREATE TABLE IF NOT EXISTS booking_studios (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      studio_id INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
      UNIQUE(booking_id, studio_id)
    );
  `);
}

async function createCoreNotifications() {
  console.log('Creating notifications table...');
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function createCoreFileAttachments() {
  console.log('Creating file_attachments table...');
  await query(`
    CREATE TABLE IF NOT EXISTS file_attachments (
      id SERIAL PRIMARY KEY,
      booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      uploaded_by INTEGER REFERENCES users(id) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function createCorePasswordResetTokens() {
  console.log('Creating password_reset_tokens table...');
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function createCoreInviteTokens() {
  console.log('Creating invite_tokens table...');
  await query(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      email TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function createDefaultAdmin() {
  console.log('Creating default admin user...');
  
  // Check if admin user exists
  const adminExists = await query('SELECT id FROM users WHERE username = $1', ['admin']);
  
  if (adminExists.rows.length === 0) {
    // Create admin user with default password
    await query(`
      INSERT INTO users (username, password, email, role)
      VALUES ($1, $2, $3, $4)
    `, ['admin', '$2b$10$8K1p/a0dURy5AMRKj7XaB.NNnhKjQfD3xvJ8/dWCJEGTzqYCdWKoS', 'admin@bookstud.io', 'admin']);
    
    console.log('✅ Default admin user created (username: admin, password: admin)');
  } else {
    console.log('✅ Admin user already exists');
  }
}

async function createDefaultNotificationGroups() {
  console.log('Skipping default notification groups creation for Docker deployment...');
  // Default notification groups are no longer created automatically
  // Facilities should create their own notification groups as needed
}

async function createDefaultBookingTypes() {
  console.log('Creating default booking types...');
  
  // Ensure the table exists with proper schema
  await query(`
    CREATE TABLE IF NOT EXISTS booking_types (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  const defaultTypes = [
    { name: 'Production', description: 'Regular production booking', color: '#3b82f6', sortOrder: 1 },
    { name: 'Rehearsal', description: 'Rehearsal session', color: '#8b5cf6', sortOrder: 2 },
    { name: 'Meeting', description: 'Meeting or conference', color: '#10b981', sortOrder: 3 },
    { name: 'Training', description: 'Training session', color: '#f59e0b', sortOrder: 4 },
    { name: 'Testing', description: 'Equipment or system testing', color: '#ef4444', sortOrder: 5 },
    { name: 'Setup', description: 'Setup or preparation', color: '#6b7280', sortOrder: 6 },
    { name: 'Other', description: 'Other type of booking', color: '#84cc16', sortOrder: 7 }
  ];
  
  for (const type of defaultTypes) {
    try {
      const exists = await query('SELECT id FROM booking_types WHERE name = $1', [type.name]);
      
      if (exists.rows.length === 0) {
        await query(`
          INSERT INTO booking_types (name, description, color, is_active, sort_order)
          VALUES ($1, $2, $3, true, $4)
        `, [type.name, type.description, type.color, type.sortOrder]);
        
        console.log(`✅ Created booking type: ${type.name}`);
      } else {
        console.log(`✅ Booking type already exists: ${type.name}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process booking type ${type.name}:`, error.message);
      // Continue with other types instead of failing completely
    }
  }
}

async function createDefaultSystemSettings() {
  console.log('Creating default system settings...');
  
  // First, ensure the table exists (double-check)
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  
  const defaultSettings = [
    { key: 'site_name', value: 'BookStud.io', description: 'Application site name' },
    { key: 'facility_name', value: 'Production Facility', description: 'Facility display name' },
    { key: 'backup_enabled', value: 'true', description: 'Enable automated backups' },
    { key: 'backup_retention_days', value: '7', description: 'Backup retention period in days' }
  ];
  
  for (const setting of defaultSettings) {
    try {
      const exists = await query('SELECT id FROM system_settings WHERE key = $1', [setting.key]);
      
      if (exists.rows.length === 0) {
        await query(`
          INSERT INTO system_settings (key, value)
          VALUES ($1, $2)
        `, [setting.key, setting.value]);
        
        console.log(`✅ Created system setting: ${setting.key}`);
      } else {
        console.log(`✅ System setting already exists: ${setting.key}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process system setting ${setting.key}:`, error.message);
      // Continue with other settings instead of failing completely
    }
  }
}

async function createCoreLinkedBookings() {
  console.log('Creating linked_bookings table...');
  await query(`
    CREATE TABLE IF NOT EXISTS linked_bookings (
      id SERIAL PRIMARY KEY,
      primary_booking_id INTEGER NOT NULL,
      linked_booking_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(primary_booking_id, linked_booking_id),
      CHECK (primary_booking_id != linked_booking_id)
    );
  `);
  
  // Add foreign key constraints if they don't exist
  try {
    await query(`
      ALTER TABLE linked_bookings 
      ADD CONSTRAINT fk_linked_bookings_primary 
      FOREIGN KEY (primary_booking_id) 
      REFERENCES bookings(id) 
      ON DELETE CASCADE;
    `);
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('Primary booking foreign key constraint already exists');
    } else {
      console.error('Error adding primary booking foreign key:', error.message);
    }
  }
  
  try {
    await query(`
      ALTER TABLE linked_bookings 
      ADD CONSTRAINT fk_linked_bookings_linked 
      FOREIGN KEY (linked_booking_id) 
      REFERENCES bookings(id) 
      ON DELETE CASCADE;
    `);
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('Linked booking foreign key constraint already exists');
    } else {
      console.error('Error adding linked booking foreign key:', error.message);
    }
  }
  
  // Create indexes for better performance
  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_linked_bookings_primary ON linked_bookings(primary_booking_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_linked_bookings_linked ON linked_bookings(linked_booking_id);`);
  } catch (error) {
    console.error('Error creating linked bookings indexes:', error.message);
  }
  
  // Add linked booking fields to bookings table
  try {
    await query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS link_group_id TEXT;`);
    await query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_primary_in_group BOOLEAN DEFAULT FALSE;`);
    console.log('Added linked booking fields to bookings table');
  } catch (error) {
    console.error('Error adding linked booking fields:', error.message);
  }
}

async function createCoreAssets() {
  console.log('Creating assets table...');
  await query(`
    CREATE TABLE IF NOT EXISTS assets (
      id                    SERIAL PRIMARY KEY,
      name                  TEXT NOT NULL,
      category              TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'available',
      serial_number         TEXT,
      asset_tag             TEXT,
      location              TEXT,
      description           TEXT,
      notes                 TEXT,
      purchase_date         TEXT,
      last_maintenance_date TEXT,
      assigned_to           INTEGER,
      created_by            INTEGER NOT NULL,
      created_at            TIMESTAMP DEFAULT NOW(),
      updated_at            TIMESTAMP DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_assets_status   ON assets(status);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);`);
}

async function createCoreAssetCheckouts() {
  console.log('Creating asset_checkouts table...');
  await query(`
    CREATE TABLE IF NOT EXISTS asset_checkouts (
      id             SERIAL PRIMARY KEY,
      asset_id       INTEGER NOT NULL,
      checked_out_by INTEGER NOT NULL,
      checked_out_at TIMESTAMP DEFAULT NOW(),
      checked_in_at  TIMESTAMP,
      checked_in_by  INTEGER,
      notes          TEXT,
      purpose        TEXT
    );
  `);
  try {
    await query(`
      ALTER TABLE asset_checkouts
      ADD CONSTRAINT asset_checkouts_asset_id_fkey
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
    `);
  } catch (e) {
    if (!e.message.includes('already exists')) throw e;
  }
  await query(`CREATE INDEX IF NOT EXISTS idx_checkouts_asset_id   ON asset_checkouts(asset_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_checkouts_checked_in ON asset_checkouts(checked_in_at);`);
}

// Run the migration
consolidatedMigration()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });