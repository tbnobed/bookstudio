/**
 * Docker migration script for alerts table
 * This script creates the alerts table with proper schema matching shared/schema.ts
 */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable must be set");
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function migrateAlerts() {
  console.log('Creating alerts table...');
  
  try {
    // Create alerts table matching the exact schema from shared/schema.ts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        start TIMESTAMP NOT NULL,
        "end" TIMESTAMP NOT NULL,
        is_all_day BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'active',
        notify_list JSON DEFAULT '[]',
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✓ Alerts table created successfully');
    
    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_alerts_alert_type ON alerts(alert_type);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_alerts_start_end ON alerts(start, "end");
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_alerts_created_by ON alerts(created_by);
    `);
    
    console.log('✓ Alerts table indexes created successfully');
    
    // Check if we need to migrate any existing alert data from bookings table
    const alertBookingsResult = await pool.query(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE type IN ('maintenance', 'it_support') 
      AND studio_id IS NULL
    `);
    
    const alertBookingsCount = parseInt(alertBookingsResult.rows[0].count);
    
    if (alertBookingsCount > 0) {
      console.log(`Found ${alertBookingsCount} alert-type bookings to migrate...`);
      
      // Migrate alert-type bookings to alerts table
      await pool.query(`
        INSERT INTO alerts (title, description, alert_type, severity, start, "end", is_all_day, status, notify_list, created_by, created_at)
        SELECT 
          title,
          description,
          CASE 
            WHEN type = 'maintenance' THEN 'maintenance'
            WHEN type = 'it_support' THEN 'site_alert'
            ELSE 'facility_alert'
          END as alert_type,
          COALESCE(severity, 'medium') as severity,
          start,
          "end",
          (EXTRACT(EPOCH FROM ("end" - start)) >= 86400) as is_all_day,
          CASE 
            WHEN status = 'confirmed' THEN 'active'
            WHEN status = 'cancelled' THEN 'cancelled'
            ELSE 'active'
          END as status,
          COALESCE(notify_list, '[]') as notify_list,
          user_id as created_by,
          created_at
        FROM bookings 
        WHERE type IN ('maintenance', 'it_support') 
        AND studio_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM alerts 
          WHERE alerts.title = bookings.title 
          AND alerts.start = bookings.start
          AND alerts.created_by = bookings.user_id
        )
      `);
      
      console.log(`✓ Migrated ${alertBookingsCount} alert-type bookings to alerts table`);
    }
    
    console.log('✓ Alerts migration completed successfully');
    
  } catch (error) {
    console.error('Error during alerts migration:', error);
    throw error;
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateAlerts()
    .then(() => {
      console.log('Alerts migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Alerts migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateAlerts };