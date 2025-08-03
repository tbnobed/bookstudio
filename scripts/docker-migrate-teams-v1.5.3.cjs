const { Pool } = require('pg');

async function migrateTeamsFeature() {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  console.log('🚀 Docker Teams Feature Migration v1.5.3 starting...');

  try {
    await pool.query('BEGIN');
    
    // Check if migration has already been run
    const migrationCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'teams'
      ) AND EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'team_members'
      );
    `);
    
    if (migrationCheck.rows[0].exists) {
      console.log('✅ Teams feature migration already completed, skipping...');
      await pool.query('COMMIT');
      return;
    }
    
    console.log('📋 Creating teams feature schema...');
    
    // Create teams table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Teams table created');
    
    // Create team_members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id, user_id)
      );
    `);
    console.log('✅ Team members table created');
    
    // Add foreign key constraints (with error handling for existing constraints)
    console.log('🔧 Adding foreign key constraints...');
    
    try {
      await pool.query(`
        ALTER TABLE teams 
        ADD CONSTRAINT teams_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
      `);
    } catch (err) {
      if (!err.message.includes('already exists')) {
        throw err;
      }
      console.log('ℹ️ Teams created_by foreign key already exists');
    }
    
    try {
      await pool.query(`
        ALTER TABLE team_members 
        ADD CONSTRAINT team_members_team_id_fkey 
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
      `);
    } catch (err) {
      if (!err.message.includes('already exists')) {
        throw err;
      }
      console.log('ℹ️ Team members team_id foreign key already exists');
    }
    
    try {
      await pool.query(`
        ALTER TABLE team_members 
        ADD CONSTRAINT team_members_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      `);
    } catch (err) {
      if (!err.message.includes('already exists')) {
        throw err;
      }
      console.log('ℹ️ Team members user_id foreign key already exists');
    }
    
    // Create performance indexes
    console.log('📊 Creating performance indexes...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
    `);
    
    console.log('✅ Performance indexes created');
    
    // Create demo team for testing (only if no teams exist)
    const existingTeamsCount = await pool.query('SELECT COUNT(*) FROM teams;');
    
    if (parseInt(existingTeamsCount.rows[0].count) === 0) {
      console.log('🎭 Creating demo team for testing...');
      
      // Find admin user
      const adminUser = await pool.query(`
        SELECT id FROM users WHERE role = 'admin' OR username = 'admin' LIMIT 1;
      `);
      
      if (adminUser.rows.length > 0) {
        const adminId = adminUser.rows[0].id;
        
        // Create demo team
        const teamResult = await pool.query(`
          INSERT INTO teams (name, description, created_by, created_at, updated_at)
          VALUES ('Demo Production Team', 'Example team for collaborative booking management', $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id;
        `, [adminId]);
        
        const teamId = teamResult.rows[0].id;
        
        // Add admin as team member
        await pool.query(`
          INSERT INTO team_members (team_id, user_id, role, joined_at)
          VALUES ($1, $2, 'admin', CURRENT_TIMESTAMP);
        `, [teamId, adminId]);
        
        console.log(`✅ Demo team created with ID ${teamId}`);
      } else {
        console.log('ℹ️ No admin user found, skipping demo team creation');
      }
    }
    
    await pool.query('COMMIT');
    console.log('🎉 Docker Teams Feature Migration v1.5.3 completed successfully!');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Docker Teams migration failed:', error);
    throw error; // Re-throw to fail the container startup
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrateTeamsFeature().catch(err => {
    console.error('Migration execution failed:', err);
    process.exit(1);
  });
}

module.exports = { migrateTeamsFeature };