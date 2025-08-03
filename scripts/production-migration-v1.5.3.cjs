const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  console.log('🚀 Starting BookStud.io v1.5.3 Teams Feature Migration...');

  try {
    await pool.query('BEGIN');
    
    console.log('📋 Checking existing teams schema...');
    
    // Check if teams table exists
    const teamsTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'teams'
      );
    `);
    
    if (!teamsTableCheck.rows[0].exists) {
      console.log('🔧 Creating teams table...');
      await pool.query(`
        CREATE TABLE teams (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_by INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Teams table created successfully');
    } else {
      console.log('✅ Teams table already exists');
    }
    
    // Check if team_members table exists
    const teamMembersTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'team_members'
      );
    `);
    
    if (!teamMembersTableCheck.rows[0].exists) {
      console.log('🔧 Creating team_members table...');
      await pool.query(`
        CREATE TABLE team_members (
          id SERIAL PRIMARY KEY,
          team_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          role TEXT DEFAULT 'member',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(team_id, user_id)
        );
      `);
      console.log('✅ Team members table created successfully');
    } else {
      console.log('✅ Team members table already exists');
    }
    
    // Add foreign key constraints if they don't exist
    console.log('🔧 Adding foreign key constraints...');
    
    // Check and add foreign key for teams.created_by
    const teamsFkCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'teams' 
        AND constraint_name = 'teams_created_by_fkey'
      );
    `);
    
    if (!teamsFkCheck.rows[0].exists) {
      await pool.query(`
        ALTER TABLE teams 
        ADD CONSTRAINT teams_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
      `);
      console.log('✅ Teams created_by foreign key added');
    }
    
    // Check and add foreign key for team_members.team_id
    const teamMembersTeamFkCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'team_members' 
        AND constraint_name = 'team_members_team_id_fkey'
      );
    `);
    
    if (!teamMembersTeamFkCheck.rows[0].exists) {
      await pool.query(`
        ALTER TABLE team_members 
        ADD CONSTRAINT team_members_team_id_fkey 
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
      `);
      console.log('✅ Team members team_id foreign key added');
    }
    
    // Check and add foreign key for team_members.user_id
    const teamMembersUserFkCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'team_members' 
        AND constraint_name = 'team_members_user_id_fkey'
      );
    `);
    
    if (!teamMembersUserFkCheck.rows[0].exists) {
      await pool.query(`
        ALTER TABLE team_members 
        ADD CONSTRAINT team_members_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      `);
      console.log('✅ Team members user_id foreign key added');
    }
    
    // Create indexes for better performance
    console.log('🔧 Creating performance indexes...');
    
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
    
    // Add audit log entries for the migration
    console.log('📝 Adding audit log entry for migration...');
    
    const auditTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
      );
    `);
    
    if (auditTableCheck.rows[0].exists) {
      await pool.query(`
        INSERT INTO audit_logs (action, table_name, details, user_id, created_at)
        VALUES (
          'SYSTEM_MIGRATION',
          'teams_system',
          'Teams feature migration v1.5.3 completed successfully. Created teams and team_members tables with proper constraints and indexes.',
          1,
          CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Audit log entry added');
    }
    
    await pool.query('COMMIT');
    console.log('🎉 Teams Feature Migration v1.5.3 completed successfully!');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };