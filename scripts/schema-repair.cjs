/**
 * Schema Repair Script for BookStud.io
 * This script fixes existing databases by applying necessary schema changes
 * and cleaning up contamination issues.
 */

const { Pool } = require('pg');

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

async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function repairSchema() {
  console.log('🔧 Starting schema repair...');
  
  try {
    // Step 1: Fix missing tables
    await ensureAlertsTable();
    await ensureBookingStudiosTable();
    await ensureBookingTypesTable();
    await ensureSystemSettingsTable();
    await ensurePcrRoomsTable();
    await ensureFileAttachmentsTable();
    await ensurePasswordResetTokensTable();
    await ensureInviteTokensTable();
    
    // Step 2: Fix missing columns
    await ensureBookingColumns();
    await ensureTemplateColumns();
    await ensureUserColumns();
    
    // Step 3: Fix contamination issues
    await fixSeverityContamination();
    await fixBookingStudioLinks();
    
    // Step 4: Add missing indexes
    await addPerformanceIndexes();
    
    console.log('✅ Schema repair completed successfully!');
    
  } catch (error) {
    console.error('❌ Schema repair failed:', error);
    throw error;
  }
}

async function ensureAlertsTable() {
  console.log('Ensuring alerts table exists...');
  
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'alerts'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    await query(`
      CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        start TIMESTAMP NOT NULL,
        "end" TIMESTAMP NOT NULL,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        notify_list JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Alerts table created');
  } else {
    console.log('✅ Alerts table already exists');
  }
}

async function ensureBookingStudiosTable() {
  console.log('Ensuring booking_studios table exists...');
  
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'booking_studios'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    await query(`
      CREATE TABLE booking_studios (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        studio_id INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
        UNIQUE(booking_id, studio_id)
      )
    `);
    console.log('✅ Booking_studios table created');
  } else {
    console.log('✅ Booking_studios table already exists');
  }
}

async function ensureBookingTypesTable() {
  console.log('Ensuring booking_types table exists...');
  
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'booking_types'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    await query(`
      CREATE TABLE booking_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        color TEXT,
        icon TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert default booking types
    const defaultTypes = [
      { name: 'Production', description: 'Regular production booking', color: '#3b82f6', icon: 'camera' },
      { name: 'Rehearsal', description: 'Rehearsal session', color: '#8b5cf6', icon: 'play' },
      { name: 'Meeting', description: 'Meeting or conference', color: '#10b981', icon: 'users' },
      { name: 'Training', description: 'Training session', color: '#f59e0b', icon: 'graduation-cap' },
      { name: 'Testing', description: 'Equipment or system testing', color: '#ef4444', icon: 'settings' },
      { name: 'Setup', description: 'Setup or preparation', color: '#6b7280', icon: 'tools' },
      { name: 'Other', description: 'Other type of booking', color: '#84cc16', icon: 'more-horizontal' }
    ];
    
    for (const type of defaultTypes) {
      await query(`
        INSERT INTO booking_types (name, description, color, icon)
        VALUES ($1, $2, $3, $4)
      `, [type.name, type.description, type.color, type.icon]);
    }
    
    console.log('✅ Booking_types table created with default types');
  } else {
    console.log('✅ Booking_types table already exists');
    
    // Add missing columns to existing booking_types table
    console.log('Adding missing columns to booking_types table...');
    try {
      await query(`ALTER TABLE booking_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
      console.log('✅ Added is_active column to booking_types');
    } catch (error) {
      console.log('✅ Column is_active already exists in booking_types');
    }
    
    try {
      await query(`ALTER TABLE booking_types ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;`);
      console.log('✅ Added sort_order column to booking_types');
    } catch (error) {
      console.log('✅ Column sort_order already exists in booking_types');
    }
    
    // Update color column to have NOT NULL constraint with default
    try {
      await query(`ALTER TABLE booking_types ALTER COLUMN color SET DEFAULT '#3b82f6';`);
      await query(`UPDATE booking_types SET color = '#3b82f6' WHERE color IS NULL;`);
      await query(`ALTER TABLE booking_types ALTER COLUMN color SET NOT NULL;`);
      console.log('✅ Updated color column in booking_types');
    } catch (error) {
      console.log('✅ Color column already properly configured in booking_types');
    }
  }
}

async function ensureSystemSettingsTable() {
  console.log('Ensuring system_settings table exists...');
  
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'system_settings'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    await query(`
      CREATE TABLE system_settings (
        id SERIAL PRIMARY KEY,
        setting_key TEXT NOT NULL UNIQUE,
        setting_value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ System_settings table created');
  } else {
    console.log('✅ System_settings table already exists');
  }
}

async function ensurePcrRoomsTable() {
  console.log('Ensuring pcr_rooms table exists...');
  
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'pcr_rooms'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    await query(`
      CREATE TABLE pcr_rooms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'available'
      )
    `);
    console.log('✅ PCR_rooms table created');
  } else {
    console.log('✅ PCR_rooms table already exists');
  }
}

async function ensureFileAttachmentsTable() {
  console.log('Ensuring file_attachments table exists...');
  
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'file_attachments'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    await query(`
      CREATE TABLE file_attachments (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        uploaded_by INTEGER REFERENCES users(id) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ File_attachments table created');
  } else {
    console.log('✅ File_attachments table already exists');
  }
}

async function ensurePasswordResetTokensTable() {
  console.log('Ensuring password_reset_tokens table exists...');
  
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    await query(`
      CREATE TABLE password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Password_reset_tokens table created');
  } else {
    console.log('✅ Password_reset_tokens table already exists');
  }
}

async function ensureInviteTokensTable() {
  console.log('Ensuring invite_tokens table exists...');
  
  const tableExists = await query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'invite_tokens'
    )
  `);
  
  if (!tableExists.rows[0].exists) {
    await query(`
      CREATE TABLE invite_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        email TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Invite_tokens table created');
  } else {
    console.log('✅ Invite_tokens table already exists');
  }
}

async function ensureBookingColumns() {
  console.log('Ensuring bookings table has all required columns...');
  
  const columns = [
    { name: 'severity', type: 'TEXT', default: null },
    { name: 'status', type: 'TEXT', default: "'confirmed'" },
    { name: 'pcr_room_id', type: 'INTEGER', default: null },
    { name: 'color', type: 'TEXT', default: null },
    { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' }
  ];
  
  for (const column of columns) {
    const columnExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = $1
      )
    `, [column.name]);
    
    if (!columnExists.rows[0].exists) {
      const defaultClause = column.default ? `DEFAULT ${column.default}` : '';
      await query(`ALTER TABLE bookings ADD COLUMN ${column.name} ${column.type} ${defaultClause}`);
      console.log(`✅ Added column: bookings.${column.name}`);
    } else {
      console.log(`✅ Column already exists: bookings.${column.name}`);
    }
  }
}

async function ensureTemplateColumns() {
  console.log('Ensuring templates table has all required columns...');
  
  const columns = [
    { name: 'studio_ids', type: 'JSONB', default: "'[]'" },
    { name: 'pcr_room_id', type: 'INTEGER', default: null },
    { name: 'start_time', type: 'TEXT', default: null },
    { name: 'end_time', type: 'TEXT', default: null },
    { name: 'color', type: 'TEXT', default: null },
    { name: 'notify_list', type: 'JSONB', default: "'[]'" },
    { name: 'created_by', type: 'INTEGER', default: '1' }
  ];
  
  for (const column of columns) {
    const columnExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'templates' AND column_name = $1
      )
    `, [column.name]);
    
    if (!columnExists.rows[0].exists) {
      const defaultClause = column.default ? `DEFAULT ${column.default}` : '';
      await query(`ALTER TABLE templates ADD COLUMN ${column.name} ${column.type} ${defaultClause}`);
      console.log(`✅ Added column: templates.${column.name}`);
    } else {
      console.log(`✅ Column already exists: templates.${column.name}`);
    }
  }
}

async function ensureUserColumns() {
  console.log('Ensuring users table has all required columns...');
  
  const columns = [
    { name: 'role', type: 'TEXT', default: "'producer'" }
  ];
  
  for (const column of columns) {
    const columnExists = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = $1
      )
    `, [column.name]);
    
    if (!columnExists.rows[0].exists) {
      const defaultClause = column.default ? `DEFAULT ${column.default}` : '';
      await query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type} ${defaultClause}`);
      console.log(`✅ Added column: users.${column.name}`);
    } else {
      console.log(`✅ Column already exists: users.${column.name}`);
    }
  }
}

async function fixSeverityContamination() {
  console.log('Fixing severity contamination...');
  
  // Remove DEFAULT from severity column to prevent contamination
  try {
    await query(`ALTER TABLE bookings ALTER COLUMN severity DROP DEFAULT`);
    console.log('✅ Removed DEFAULT from severity column');
  } catch (error) {
    // Ignore error if DEFAULT doesn't exist
    console.log('✅ No DEFAULT to remove from severity column');
  }
  
  // Clean contaminated production bookings
  const contaminated = await query(`
    SELECT COUNT(*) as count FROM bookings 
    WHERE type = 'production' AND severity IS NOT NULL
  `);
  
  if (contaminated.rows[0].count > 0) {
    await query(`
      UPDATE bookings 
      SET severity = NULL 
      WHERE type = 'production' AND severity IS NOT NULL
    `);
    console.log(`✅ Cleaned ${contaminated.rows[0].count} contaminated production bookings`);
  } else {
    console.log('✅ No contaminated production bookings found');
  }
}

async function fixBookingStudioLinks() {
  console.log('Fixing booking-studio links...');
  
  // Find bookings without studio links
  const missingLinks = await query(`
    SELECT b.id, b.studio_id 
    FROM bookings b 
    LEFT JOIN booking_studios bs ON b.id = bs.booking_id 
    WHERE bs.id IS NULL AND b.studio_id IS NOT NULL
  `);
  
  if (missingLinks.rows.length > 0) {
    console.log(`Found ${missingLinks.rows.length} bookings without studio links`);
    
    for (const booking of missingLinks.rows) {
      await query(`
        INSERT INTO booking_studios (booking_id, studio_id)
        VALUES ($1, $2)
        ON CONFLICT (booking_id, studio_id) DO NOTHING
      `, [booking.id, booking.studio_id]);
    }
    
    console.log(`✅ Fixed ${missingLinks.rows.length} booking-studio links`);
  } else {
    console.log('✅ All booking-studio links are present');
  }
}

async function addPerformanceIndexes() {
  console.log('Adding performance indexes...');
  
  const indexes = [
    { table: 'bookings', column: 'start', name: 'idx_bookings_start' },
    { table: 'bookings', column: 'end', name: 'idx_bookings_end' },
    { table: 'bookings', column: 'studio_id', name: 'idx_bookings_studio_id' },
    { table: 'bookings', column: 'user_id', name: 'idx_bookings_user_id' },
    { table: 'booking_studios', column: 'booking_id', name: 'idx_booking_studios_booking_id' },
    { table: 'booking_studios', column: 'studio_id', name: 'idx_booking_studios_studio_id' },
    { table: 'alerts', column: 'start', name: 'idx_alerts_start' },
    { table: 'alerts', column: 'end', name: 'idx_alerts_end' }
  ];
  
  for (const index of indexes) {
    try {
      await query(`CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table} (${index.column})`);
      console.log(`✅ Added index: ${index.name}`);
    } catch (error) {
      console.log(`✅ Index already exists: ${index.name}`);
    }
  }
}

// Run the repair
repairSchema()
  .then(() => {
    console.log('🎉 Schema repair completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Schema repair failed:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });