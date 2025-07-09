const { Client } = require('pg');

async function migrateAlerts() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database for alerts migration...');

    // Create alerts table with exact schema matching shared/schema.ts
    const createAlertsTable = `
      CREATE TABLE IF NOT EXISTS alerts (
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
    `;

    await client.query(createAlertsTable);
    console.log('✓ Alerts table created successfully');

    // Create indexes for better performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_alerts_start ON alerts(start);',
      'CREATE INDEX IF NOT EXISTS idx_alerts_end ON alerts("end");',
      'CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);',
      'CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);',
      'CREATE INDEX IF NOT EXISTS idx_alerts_created_by ON alerts(created_by);'
    ];

    for (const indexQuery of createIndexes) {
      await client.query(indexQuery);
    }
    console.log('✓ Alerts table indexes created successfully');

  } catch (error) {
    console.error('Error creating alerts table:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
migrateAlerts().catch(console.error);