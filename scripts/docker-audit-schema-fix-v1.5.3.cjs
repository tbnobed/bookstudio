const { Pool } = require('pg');

async function auditSchemaFixV153() {
  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  console.log('🔧 Docker Audit Schema Fix v1.5.3 starting...');

  try {
    await pool.query('BEGIN');
    
    // Fix any schema inconsistencies after teams migration
    console.log('📋 Checking and fixing schema inconsistencies...');
    
    // Ensure all required tables exist with proper structure
    const tables = [
      { name: 'teams', required: true },
      { name: 'team_members', required: true },
      { name: 'audit_logs', required: false }
    ];
    
    for (const table of tables) {
      const exists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table.name]);
      
      if (!exists.rows[0].exists && table.required) {
        console.log(`❌ Required table ${table.name} is missing`);
        throw new Error(`Required table ${table.name} is missing. Migration may have failed.`);
      } else if (exists.rows[0].exists) {
        console.log(`✅ Table ${table.name} exists`);
      }
    }
    
    // Verify foreign key constraints exist
    console.log('🔗 Verifying foreign key constraints...');
    
    const fkConstraints = [
      { table: 'teams', constraint: 'teams_created_by_fkey', column: 'created_by' },
      { table: 'team_members', constraint: 'team_members_team_id_fkey', column: 'team_id' },
      { table: 'team_members', constraint: 'team_members_user_id_fkey', column: 'user_id' }
    ];
    
    for (const fk of fkConstraints) {
      const constraintExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.table_constraints 
          WHERE table_schema = 'public' 
          AND table_name = $1 
          AND constraint_name = $2
        );
      `, [fk.table, fk.constraint]);
      
      if (!constraintExists.rows[0].exists) {
        console.log(`⚠️ Missing foreign key constraint: ${fk.constraint}`);
        // Attempt to add missing constraint
        try {
          switch (fk.constraint) {
            case 'teams_created_by_fkey':
              await pool.query(`
                ALTER TABLE teams 
                ADD CONSTRAINT teams_created_by_fkey 
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
              `);
              break;
            case 'team_members_team_id_fkey':
              await pool.query(`
                ALTER TABLE team_members 
                ADD CONSTRAINT team_members_team_id_fkey 
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
              `);
              break;
            case 'team_members_user_id_fkey':
              await pool.query(`
                ALTER TABLE team_members 
                ADD CONSTRAINT team_members_user_id_fkey 
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
              `);
              break;
          }
          console.log(`✅ Added missing constraint: ${fk.constraint}`);
        } catch (err) {
          console.log(`ℹ️ Constraint ${fk.constraint} may already exist or conflict: ${err.message}`);
        }
      } else {
        console.log(`✅ Foreign key constraint ${fk.constraint} exists`);
      }
    }
    
    // Verify indexes exist for performance
    console.log('📊 Verifying performance indexes...');
    
    const indexes = [
      'idx_teams_created_by',
      'idx_team_members_team_id',
      'idx_team_members_user_id'
    ];
    
    for (const indexName of indexes) {
      const indexExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = $1
        );
      `, [indexName]);
      
      if (!indexExists.rows[0].exists) {
        console.log(`⚠️ Missing index: ${indexName}`);
        try {
          switch (indexName) {
            case 'idx_teams_created_by':
              await pool.query('CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);');
              break;
            case 'idx_team_members_team_id':
              await pool.query('CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);');
              break;
            case 'idx_team_members_user_id':
              await pool.query('CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);');
              break;
          }
          console.log(`✅ Created missing index: ${indexName}`);
        } catch (err) {
          console.log(`ℹ️ Index ${indexName} creation failed: ${err.message}`);
        }
      } else {
        console.log(`✅ Index ${indexName} exists`);
      }
    }
    
    // Ensure unique constraint on team_members exists
    console.log('🔒 Verifying unique constraints...');
    
    const uniqueConstraintExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'team_members' 
        AND constraint_type = 'UNIQUE'
        AND (constraint_name LIKE '%team_id%' OR constraint_name LIKE '%user_id%')
      );
    `);
    
    if (!uniqueConstraintExists.rows[0].exists) {
      console.log('⚠️ Missing unique constraint on team_members');
      try {
        await pool.query(`
          ALTER TABLE team_members 
          ADD CONSTRAINT team_members_team_user_unique 
          UNIQUE (team_id, user_id);
        `);
        console.log('✅ Added unique constraint on team_members');
      } catch (err) {
        console.log(`ℹ️ Unique constraint may already exist: ${err.message}`);
      }
    } else {
      console.log('✅ Unique constraint on team_members exists');
    }
    
    // Verify data integrity
    console.log('🔍 Verifying data integrity...');
    
    // Check for orphaned team members
    const orphanedMembers = await pool.query(`
      SELECT COUNT(*) FROM team_members tm
      LEFT JOIN teams t ON tm.team_id = t.id
      LEFT JOIN users u ON tm.user_id = u.id
      WHERE t.id IS NULL OR u.id IS NULL;
    `);
    
    if (parseInt(orphanedMembers.rows[0].count) > 0) {
      console.log(`⚠️ Found ${orphanedMembers.rows[0].count} orphaned team member records`);
      // Clean up orphaned records
      await pool.query(`
        DELETE FROM team_members 
        WHERE team_id NOT IN (SELECT id FROM teams)
        OR user_id NOT IN (SELECT id FROM users);
      `);
      console.log('✅ Cleaned up orphaned team member records');
    } else {
      console.log('✅ No orphaned team member records found');
    }
    
    // Update statistics for query optimizer
    console.log('📈 Updating table statistics...');
    await pool.query('ANALYZE teams;');
    await pool.query('ANALYZE team_members;');
    console.log('✅ Table statistics updated');
    
    await pool.query('COMMIT');
    console.log('🎉 Docker Audit Schema Fix v1.5.3 completed successfully!');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Docker Audit Schema Fix v1.5.3 failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  auditSchemaFixV153().catch(err => {
    console.error('Schema fix execution failed:', err);
    process.exit(1);
  });
}

module.exports = { auditSchemaFixV153 };